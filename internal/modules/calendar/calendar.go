package calendar

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// SyncConfig 는 캘린더 연동 설정입니다.
type SyncConfig struct {
	Mode         string `json:"mode"`         // "none", "ical", "api"
	IcalURL      string `json:"icalUrl"`      // 비공개 iCal 주소 (.ics)
	APIKey       string `json:"apiKey"`       // Google Cloud API Key
	CalendarID   string `json:"calendarId"`   // Google Calendar ID (기본: primary)
	LastSyncAt   string `json:"lastSyncAt"`   // 마지막 동기화 일시
	LastSyncMsg  string `json:"lastSyncMsg"`  // 동기화 상태 메시지
	SyncCount    int    `json:"syncCount"`    // 최근 가져온 경조사 일정 수
}

// CalendarEvent 는 동기화된 캘린더 경조사 일정입니다.
type CalendarEvent struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	EventDate   string `json:"eventDate"`
	DDay        int    `json:"dDay"`
	Location    string `json:"location"`
	Description string `json:"description"`
	Source      string `json:"source"` // "google_ical", "google_api"
}

// Service 는 캘린더 동기화 서비스입니다.
type Service struct {
	db     *sql.DB
	bus    *eventbus.Bus
	mu     sync.Mutex
	client *http.Client
}

// Module 은 캘린더 모듈입니다.
type Module struct {
	service *Service
}

func New() *Module {
	return &Module{}
}

func (m *Module) Name() string {
	return "calendar"
}

func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "캘린더 설정 및 캐시 테이블 생성",
			SQL: `CREATE TABLE IF NOT EXISTS calendar_config (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS calendar_events_cache (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				event_date TEXT NOT NULL,
				location TEXT,
				description TEXT,
				source TEXT NOT NULL,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
		},
	}
}

func (m *Module) Init(ctx *module.Context) error {
	m.service = &Service{
		db:  ctx.DB,
		bus: ctx.Bus,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
	return nil
}

func (m *Module) Binding() any {
	return m.service
}

// GetService 는 서비스 싱글톤을 반환합니다.
func (m *Module) GetService() *Service {
	return m.service
}

// GetConfig 는 현재 구글 캘린더 연동 설정을 조회합니다.
func (s *Service) GetConfig() (*SyncConfig, error) {
	cfg := &SyncConfig{
		Mode:       "none",
		CalendarID: "primary",
	}

	rows, err := s.db.Query(`SELECT key, value FROM calendar_config`)
	if err != nil {
		return cfg, nil
	}
	defer rows.Close()

	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err == nil {
			switch k {
			case "mode":
				cfg.Mode = v
			case "ical_url":
				cfg.IcalURL = v
			case "api_key":
				cfg.APIKey = v
			case "calendar_id":
				if v != "" {
					cfg.CalendarID = v
				}
			case "last_sync_at":
				cfg.LastSyncAt = v
			case "last_sync_msg":
				cfg.LastSyncMsg = v
			}
		}
	}

	// 캐시된 일정 수 조회
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM calendar_events_cache`).Scan(&cfg.SyncCount)

	return cfg, nil
}

// SaveConfig 는 구글 캘린더 연동 설정을 저장합니다.
func (s *Service) SaveConfig(mode, icalUrl, apiKey, calendarId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if mode == "" {
		mode = "none"
	}
	if calendarId == "" {
		calendarId = "primary"
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	upsert := `INSERT INTO calendar_config (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`

	pairs := map[string]string{
		"mode":        mode,
		"ical_url":    strings.TrimSpace(icalUrl),
		"api_key":     strings.TrimSpace(apiKey),
		"calendar_id": strings.TrimSpace(calendarId),
	}

	for k, v := range pairs {
		if _, err := tx.Exec(upsert, k, v); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if s.bus != nil {
		s.bus.Publish("calendar", "calendar.config.updated", mode)
	}

	return nil
}

// OpenURL 은 기본 웹 브라우저로 지정된 URL을 엽니다.
func (s *Service) OpenURL(rawURL string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	case "darwin":
		cmd = exec.Command("open", rawURL)
	default:
		cmd = exec.Command("xdg-open", rawURL)
	}
	return cmd.Start()
}

// TestAndSync 는 선택한 모드로 즉시 동기화를 테스트하고 일정을 캐시합니다.
func (s *Service) TestAndSync(mode, icalUrl, apiKey, calendarId string) (*SyncConfig, error) {
	if mode == "" || mode == "none" {
		return s.GetConfig()
	}

	var events []CalendarEvent
	var err error

	switch mode {
	case "ical":
		if icalUrl == "" {
			return nil, fmt.Errorf("iCal 비공개 URL을 입력해주세요.")
		}
		events, err = s.fetchFromIcal(icalUrl)
	case "api":
		if apiKey == "" {
			return nil, fmt.Errorf("Google Calendar API Key를 입력해주세요.")
		}
		if calendarId == "" {
			calendarId = "primary"
		}
		events, err = s.fetchFromAPI(apiKey, calendarId)
	default:
		return nil, fmt.Errorf("지원하지 않는 연동 방식입니다: %s", mode)
	}

	if err != nil {
		return nil, err
	}

	// 동기화 성공 시 설정 저장 및 캐시 갱신
	nowStr := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf("성공: 경조사 관련 일정 %d건을 가져왔습니다.", len(events))

	_ = s.SaveConfig(mode, icalUrl, apiKey, calendarId)

	// 캐시 테이블 갱신
	tx, err := s.db.Begin()
	if err == nil {
		_, _ = tx.Exec(`DELETE FROM calendar_events_cache`)
		stmt, err := tx.Prepare(`INSERT INTO calendar_events_cache (id, title, event_date, location, description, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
		if err == nil {
			for _, e := range events {
				_, _ = stmt.Exec(e.ID, e.Title, e.EventDate, e.Location, e.Description, e.Source, nowStr)
			}
			stmt.Close()
		}
		_, _ = tx.Exec(`INSERT INTO calendar_config (key, value) VALUES ('last_sync_at', ?), ('last_sync_msg', ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value`, nowStr, msg)
		_ = tx.Commit()
	}

	if s.bus != nil {
		s.bus.Publish("calendar", "calendar.synced", len(events))
	}

	cfg, _ := s.GetConfig()
	cfg.SyncCount = len(events)
	cfg.LastSyncAt = nowStr
	cfg.LastSyncMsg = msg
	return cfg, nil
}

// GetCachedEvents 는 캐시된 캘린더 경조사 일정 목록을 조회합니다.
func (s *Service) GetCachedEvents() ([]CalendarEvent, error) {
	cfg, _ := s.GetConfig()
	if cfg.Mode == "none" {
		return nil, nil
	}

	today := time.Now().Format("2006-01-02")
	rows, err := s.db.Query(`SELECT id, title, event_date, location, description, source
		FROM calendar_events_cache
		WHERE event_date >= ?
		ORDER BY event_date ASC
		LIMIT 20`, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CalendarEvent
	now := time.Now()
	for rows.Next() {
		var e CalendarEvent
		if err := rows.Scan(&e.ID, &e.Title, &e.EventDate, &e.Location, &e.Description, &e.Source); err == nil {
			if t, err := time.Parse("2006-01-02", e.EventDate); err == nil {
				e.DDay = int(t.Sub(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())).Hours() / 24)
			}
			list = append(list, e)
		}
	}

	return list, nil
}

// ── iCal (.ics) 파싱 로직 ──
func (s *Service) fetchFromIcal(icalUrl string) ([]CalendarEvent, error) {
	resp, err := s.client.Get(icalUrl)
	if err != nil {
		return nil, fmt.Errorf("iCal 주소에 연결할 수 없습니다: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("iCal 서버 응답 오류 (HTTP %d)", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("iCal 데이터를 읽을 수 없습니다: %w", err)
	}

	return parseIcsContent(string(body))
}

// 경조사 관련 키워드 정규식 (결혼, 돌잔치, 장례, 생신, 회갑, 집들이, 개업, 부조, 축의 등)
var eventKeywordRegex = regexp.MustCompile(`(결혼|웨딩|돌잔치|장례|부고|부친상|모친상|조문|회갑|칠순|고희|집들이|개업|경조사|축의|부의|생일|생신)`)

func parseIcsContent(content string) ([]CalendarEvent, error) {
	// 줄바꿈 정규화
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")

	var events []CalendarEvent
	var curSummary, curDtStart, curLocation, curDesc, curUid string
	inVevent := false

	todayStr := time.Now().Format("2006-01-02")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "BEGIN:VEVENT" {
			inVevent = true
			curSummary = ""
			curDtStart = ""
			curLocation = ""
			curDesc = ""
			curUid = ""
			continue
		}
		if line == "END:VEVENT" {
			if inVevent && curSummary != "" && curDtStart != "" {
				// 경조사 관련 키워드가 제목이나 설명에 포함되어 있는지 검사
				isRelevant := eventKeywordRegex.MatchString(curSummary) || eventKeywordRegex.MatchString(curDesc)
				if isRelevant && curDtStart >= todayStr {
					events = append(events, CalendarEvent{
						ID:          curUid,
						Title:       curSummary,
						EventDate:   curDtStart,
						Location:    curLocation,
						Description: curDesc,
						Source:      "google_ical",
					})
				}
			}
			inVevent = false
			continue
		}

		if inVevent {
			if strings.HasPrefix(line, "SUMMARY:") {
				curSummary = strings.TrimPrefix(line, "SUMMARY:")
			} else if strings.HasPrefix(line, "DTSTART") {
				// DTSTART:20260516T100000Z 또는 DTSTART;VALUE=DATE:20260516
				parts := strings.Split(line, ":")
				if len(parts) >= 2 {
					val := parts[1]
					if len(val) >= 8 {
						curDtStart = fmt.Sprintf("%s-%s-%s", val[0:4], val[4:6], val[6:8])
					}
				}
			} else if strings.HasPrefix(line, "LOCATION:") {
				curLocation = strings.TrimPrefix(line, "LOCATION:")
			} else if strings.HasPrefix(line, "DESCRIPTION:") {
				curDesc = strings.TrimPrefix(line, "DESCRIPTION:")
			} else if strings.HasPrefix(line, "UID:") {
				curUid = strings.TrimPrefix(line, "UID:")
			}
		}
	}

	return events, nil
}

// ── Google Calendar REST API 호출 로직 ──
func (s *Service) fetchFromAPI(apiKey, calendarId string) ([]CalendarEvent, error) {
	timeMin := time.Now().Format(time.RFC3339)
	encodedCalId := url.PathEscape(calendarId)

	apiEndpoint := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/%s/events?key=%s&timeMin=%s&singleEvents=true&orderBy=startTime&maxResults=100",
		encodedCalId, apiKey, url.QueryEscape(timeMin))

	resp, err := s.client.Get(apiEndpoint)
	if err != nil {
		return nil, fmt.Errorf("구글 캘린더 API 호출 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("캘린더를 찾을 수 없습니다 (404 오류).\n• 원인 1: 단순 API 키 방식에서는 'primary' 대신 본인의 구글 이메일(예: abc@gmail.com)을 캘린더 ID에 입력해야 합니다.\n• 원인 2: 구글 보안 정책상 개인 비공개 캘린더는 단순 API 키로 조회가 차단됩니다.\n👉 해결책: 개인 캘린더 연동은 상단의 '[간편] iCal 비공개 URL' 방식을 사용하시면 가장 안전하고 정확하게 연동됩니다.")
		}
		if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
			return nil, fmt.Errorf("구글 API 인증/권한 오류 (HTTP %d).\nGoogle Cloud Console에서 'Google Calendar API'가 사용 설정되어 있는지 확인해주세요.", resp.StatusCode)
		}
		return nil, fmt.Errorf("구글 API 오류 (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Items []struct {
			ID          string `json:"id"`
			Summary     string `json:"summary"`
			Description string `json:"description"`
			Location    string `json:"location"`
			Start       struct {
				Date     string `json:"date"`
				DateTime string `json:"dateTime"`
			} `json:"start"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("구글 API 응답 파싱 실패: %w", err)
	}

	var events []CalendarEvent
	todayStr := time.Now().Format("2006-01-02")

	for _, item := range result.Items {
		dateStr := item.Start.Date
		if dateStr == "" && len(item.Start.DateTime) >= 10 {
			dateStr = item.Start.DateTime[0:10]
		}

		if dateStr == "" || dateStr < todayStr {
			continue
		}

		// 경조사 관련 키워드 검사
		isRelevant := eventKeywordRegex.MatchString(item.Summary) || eventKeywordRegex.MatchString(item.Description)
		if isRelevant {
			events = append(events, CalendarEvent{
				ID:          item.ID,
				Title:       item.Summary,
				EventDate:   dateStr,
				Location:    item.Location,
				Description: item.Description,
				Source:      "google_api",
			})
		}
	}

	return events, nil
}
