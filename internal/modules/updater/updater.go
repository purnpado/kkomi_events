// Package updater 는 GitHub 릴리즈를 확인하여 새로운 버전이 있을 때
// 사용자에게 업데이트를 안내하고 다운로드를 지원하는 모듈입니다.
package updater

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/core/version"
)

// GitHubReleasesURL 은 최신 릴리즈 정보를 가져올 GitHub API 주소입니다.
const GitHubReleasesURL = "https://api.github.com/repos/purnpado/kkomi_events/releases/latest"

// UpdateInfo 는 화면에 전달하는 새 버전 정보입니다.
type UpdateInfo struct {
	HasUpdate      bool   `json:"hasUpdate"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	ReleaseBody    string `json:"releaseBody"`
	ReleaseURL     string `json:"releaseUrl"`
	DownloadURL    string `json:"downloadUrl"`
	PublishedAt    string `json:"publishedAt"`
}

type githubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

// Module 은 업데이트 모듈입니다.
type Module struct {
	svc *Service
}

// New 는 업데이트 모듈을 만듭니다.
func New() *Module {
	return &Module{svc: &Service{}}
}

// Name 은 모듈 이름입니다.
func (m *Module) Name() string { return "updater" }

// Migrations 는 데이터베이스 마이그레이션이 없습니다.
func (m *Module) Migrations() []db.Migration { return nil }

// Init 은 공용 도구를 서비스에 주입합니다.
func (m *Module) Init(c *module.Context) error {
	m.svc.bus = c.Bus
	return nil
}

// Startup 은 프로그램 실행 시 백그라운드에서 업데이트를 점검합니다.
func (m *Module) Startup(ctx context.Context) {
	// 앱 시작 후 3초 뒤 백그라운드에서 조용히 업데이트 체크
	go func() {
		time.Sleep(3 * time.Second)
		info, err := m.svc.CheckUpdate()
		if err == nil && info != nil && info.HasUpdate {
			if m.svc.bus != nil {
				m.svc.bus.Publish("updater", "updater.available", info)
			}
		}
	}()
}

// Binding 은 화면에 노출할 서비스 구조체를 돌려줍니다.
func (m *Module) Binding() any { return m.svc }

// Service 는 화면에서 호출하는 업데이트 관련 함수들입니다.
type Service struct {
	bus *eventbus.Bus
}

// CheckUpdate 는 GitHub에서 최신 릴리즈 정보를 조회하고 현재 버전과 비교합니다.
func (s *Service) CheckUpdate() (*UpdateInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", GitHubReleasesURL, nil)
	if err != nil {
		return nil, fmt.Errorf("요청 생성 실패: %w", err)
	}

	req.Header.Set("User-Agent", "kkomi-events-updater/"+version.Version)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GitHub 릴리즈 조회 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// 아직 릴리즈가 없는 경우
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: version.Version,
			LatestVersion:  version.Version,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 응답 오류 (상태 코드: %d)", resp.StatusCode)
	}

	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("릴리즈 응답 파싱 실패: %w", err)
	}

	latestTag := strings.TrimSpace(rel.TagName)
	hasNewer := IsNewerVersion(latestTag, version.Version)

	// 다운로드 URL 결정 (exe 또는 zip 에셋 우선, 없으면 HTMLURL)
	downloadURL := rel.HTMLURL
	for _, asset := range rel.Assets {
		if strings.HasSuffix(strings.ToLower(asset.Name), ".exe") || strings.HasSuffix(strings.ToLower(asset.Name), ".zip") {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}

	info := &UpdateInfo{
		HasUpdate:      hasNewer,
		CurrentVersion: version.Version,
		LatestVersion:  latestTag,
		ReleaseName:    rel.Name,
		ReleaseBody:    rel.Body,
		ReleaseURL:     rel.HTMLURL,
		DownloadURL:    downloadURL,
		PublishedAt:    rel.PublishedAt,
	}

	return info, nil
}

// OpenReleasePage 는 브라우저로 릴리즈 주소 또는 다운로드 URL을 엽니다.
func (s *Service) OpenReleasePage(rawURL string) error {
	if rawURL == "" {
		rawURL = "https://github.com/purnpado/kkomi_events/releases"
	}
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

// IsNewerVersion 은 latest 버전이 current 버전보다 최신인지 비교합니다.
// 예: latest="v0.1.1", current="0.1.0" -> true
func IsNewerVersion(latest, current string) bool {
	lParts := parseVersion(latest)
	cParts := parseVersion(current)

	for i := 0; i < len(lParts) && i < len(cParts); i++ {
		if lParts[i] > cParts[i] {
			return true
		}
		if lParts[i] < cParts[i] {
			return false
		}
	}
	return len(lParts) > len(cParts)
}

func parseVersion(v string) []int {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")

	parts := strings.Split(v, ".")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		// 숫자가 아닌 문자(예: "-beta", "+build") 제거
		numStr := ""
		for _, r := range p {
			if r >= '0' && r <= '9' {
				numStr += string(r)
			} else {
				break
			}
		}
		if n, err := strconv.Atoi(numStr); err == nil {
			nums = append(nums, n)
		} else {
			nums = append(nums, 0)
		}
	}
	return nums
}

// _ 는 sql.DB 미사용 컴파일 경고 방지
var _ = (*sql.DB)(nil)
