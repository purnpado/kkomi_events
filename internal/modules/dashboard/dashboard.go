// Package dashboard 는 대시보드 요약 지표와 통계(Canvas 차트용)를 계산하는 모듈입니다.
package dashboard

import (
	"database/sql"
	"sort"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// SummaryData 는 대시보드 메인 요약 데이터입니다.
// SummaryData 는 대시보드 메인 요약 데이터입니다.
type SummaryData struct {
	TotalReceivedAmount int64          `json:"totalReceivedAmount"`
	TotalReceivedCount  int            `json:"totalReceivedCount"`
	TotalSentAmount     int64          `json:"totalSentAmount"`
	TotalSentCount      int            `json:"totalSentCount"`
	NetBalance          int64          `json:"netBalance"`
	NeedPayCount        int            `json:"needPayCount"`
	NeedPayTotal        int64          `json:"needPayTotal"`
	UpcomingCount       int            `json:"upcomingCount"`
	Monthly             []MonthlyStat  `json:"monthly"`
	Categories          []CategoryStat `json:"categories"`
	RecentEvents        []RecentItem   `json:"recentEvents"`
	UpcomingEvents      []UpcomingItem `json:"upcomingEvents"`
}

// RecentItem 은 최근 발생한 입출 경조사 기록입니다.
type RecentItem struct {
	Type          string `json:"type"`          // "received" 또는 "sent"
	Name          string `json:"name"`          // 지인 이름
	EventTitle    string `json:"eventTitle"`    // 행사명 (예: 우리 결혼식, 친구 결혼식 등)
	EventTypeIcon string `json:"eventTypeIcon"` // 이모지 아이콘
	EventDate     string `json:"eventDate"`     // 행사 날짜
	Amount        int64  `json:"amount"`        // 금액
	Attendance    string `json:"attendance"`    // 참석 여부
	CreatedAt     string `json:"createdAt"`     // 등록 일시
}

// UpcomingItem 은 다가오는 예정 경조사입니다.
type UpcomingItem struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	EventTitle    string `json:"eventTitle"`
	EventTypeIcon string `json:"eventTypeIcon"`
	EventDate     string `json:"eventDate"`
	DaysLeft      int    `json:"daysLeft"`
	Amount        int64  `json:"amount"`
	Source        string `json:"source"` // "local" 또는 "google"
}

// MonthlyStat 은 특정 월의 수입(받음)과 지출(보냄) 금액입니다.
type MonthlyStat struct {
	Month          string `json:"month"` // "YYYY-MM"
	ReceivedAmount int64  `json:"receivedAmount"`
	SentAmount     int64  `json:"sentAmount"`
}

// CategoryStat 은 경조사 종류별 금액 및 건수입니다.
type CategoryStat struct {
	Name   string `json:"name"`
	Icon   string `json:"icon"`
	Amount int64  `json:"amount"`
	Count  int    `json:"count"`
}

// Module 은 대시보드 모듈입니다.
type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "dashboard" }

func (m *Module) Migrations() []db.Migration { return nil }

func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	return nil
}

func (m *Module) Binding() any { return m.svc }

type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
}

// GetSummary 는 대시보드 전체 통계와 차트 데이터를 계산하여 돌려줍니다.
func (s *Service) GetSummary() (*SummaryData, error) {
	data := &SummaryData{
		Monthly:        []MonthlyStat{},
		Categories:     []CategoryStat{},
		RecentEvents:   []RecentItem{},
		UpcomingEvents: []UpcomingItem{},
	}

	// 1. 받은 총액 및 건수
	_ = s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM received WHERE deleted_at IS NULL`).
		Scan(&data.TotalReceivedAmount, &data.TotalReceivedCount)

	// 2. 보낸 총액 및 건수
	_ = s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM sent WHERE deleted_at IS NULL`).
		Scan(&data.TotalSentAmount, &data.TotalSentCount)

	data.NetBalance = data.TotalReceivedAmount - data.TotalSentAmount

	// 3. 다가오는 일정 건수 및 목록 (오늘 이후 로컬 + 구글 캘린더 캐시 통합)
	today := time.Now().Format("2006-01-02")
	todayTime, _ := time.Parse("2006-01-02", today)

	upRows, err := s.db.Query(`SELECT s.id, s.name, COALESCE(t.name, '기타'), COALESCE(t.icon, '💌'), s.event_date, s.amount
		FROM sent s
		LEFT JOIN event_type t ON s.event_type_id=t.id
		WHERE s.event_date >= ? AND s.deleted_at IS NULL
		ORDER BY s.event_date ASC
		LIMIT 10`, today)
	if err == nil {
		defer upRows.Close()
		for upRows.Next() {
			var up UpcomingItem
			up.Source = "local"
			if err := upRows.Scan(&up.ID, &up.Name, &up.EventTitle, &up.EventTypeIcon, &up.EventDate, &up.Amount); err == nil {
				if dTime, err := time.Parse("2006-01-02", up.EventDate); err == nil {
					up.DaysLeft = int(dTime.Sub(todayTime).Hours() / 24)
				}
				data.UpcomingEvents = append(data.UpcomingEvents, up)
			}
		}
	}

	// 캘린더 캐시 테이블이 존재하면 동기화된 구글 캘린더 일정 병합
	calRows, err := s.db.Query(`SELECT id, title, event_date, COALESCE(location, ''), source FROM calendar_events_cache WHERE event_date >= ? ORDER BY event_date ASC LIMIT 10`, today)
	if err == nil {
		defer calRows.Close()
		for calRows.Next() {
			var id, title, eventDate, loc, src string
			if err := calRows.Scan(&id, &title, &eventDate, &loc, &src); err == nil {
				var daysLeft int
				if dTime, err := time.Parse("2006-01-02", eventDate); err == nil {
					daysLeft = int(dTime.Sub(todayTime).Hours() / 24)
				}
				data.UpcomingEvents = append(data.UpcomingEvents, UpcomingItem{
					ID:            0,
					Name:          title,
					EventTitle:    loc,
					EventTypeIcon: "📅",
					EventDate:     eventDate,
					DaysLeft:      daysLeft,
					Amount:        0,
					Source:        "google",
				})
			}
		}
	}

	// D-Day 순 정렬 및 상위 6건 추출
	sort.Slice(data.UpcomingEvents, func(i, j int) bool {
		return data.UpcomingEvents[i].DaysLeft < data.UpcomingEvents[j].DaysLeft
	})
	if len(data.UpcomingEvents) > 6 {
		data.UpcomingEvents = data.UpcomingEvents[:6]
	}
	data.UpcomingCount = len(data.UpcomingEvents)

	// 4. 최근 경조사 내역 (받은 내역 + 보낸 내역 통합 최신 8건)
	recentRows, err := s.db.Query(`
		SELECT 'received' as type, r.name, e.title as event_title, COALESCE(t.icon, '🎎') as icon, e.event_date, r.amount, r.attendance, r.created_at
		FROM received r
		JOIN my_event e ON r.my_event_id=e.id
		LEFT JOIN event_type t ON e.event_type_id=t.id
		WHERE r.deleted_at IS NULL AND e.deleted_at IS NULL
		UNION ALL
		SELECT 'sent' as type, s.name, COALESCE(t.name, '기타') as event_title, COALESCE(t.icon, '💌') as icon, s.event_date, s.amount, 
			CASE WHEN s.attended=1 THEN '직접 참석' ELSE '불참 송금' END as attendance, s.created_at
		FROM sent s
		LEFT JOIN event_type t ON s.event_type_id=t.id
		WHERE s.deleted_at IS NULL
		ORDER BY event_date DESC, created_at DESC
		LIMIT 8`)
	if err == nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var item RecentItem
			if err := recentRows.Scan(&item.Type, &item.Name, &item.EventTitle, &item.EventTypeIcon, &item.EventDate, &item.Amount, &item.Attendance, &item.CreatedAt); err == nil {
				data.RecentEvents = append(data.RecentEvents, item)
			}
		}
	}

	// 5. 경조사 종류별 지출 분포
	catRows, err := s.db.Query(`SELECT t.name, t.icon, COALESCE(SUM(s.amount), 0), COUNT(s.id)
		FROM event_type t
		LEFT JOIN sent s ON s.event_type_id=t.id AND s.deleted_at IS NULL
		WHERE t.is_hidden = 0
		GROUP BY t.id
		ORDER BY SUM(s.amount) DESC`)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cs CategoryStat
			if err := catRows.Scan(&cs.Name, &cs.Icon, &cs.Amount, &cs.Count); err == nil {
				data.Categories = append(data.Categories, cs)
			}
		}
	}

	return data, nil
}
