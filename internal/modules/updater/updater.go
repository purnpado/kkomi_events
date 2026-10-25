// Package updater 는 GitHub 릴리즈를 확인하여 새로운 버전이 있을 때
// 사용자에게 업데이트를 안내하고, 원클릭으로 새 버전을 다운로드하여
// 스스로 교체 후 재시작(In-place Self Update)하는 모듈입니다.
package updater

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/core/paths"
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
	m.svc.paths = c.Paths
	m.svc.log = c.Log

	// 이전 업데이트 잔여 파일(.old)이 있으면 정리
	go cleanupOldBinary()

	return nil
}

// OnStartup 은 프로그램 실행 시 백그라운드에서 업데이트를 점검합니다. (Starter 인터페이스 구현)
func (m *Module) OnStartup(ctx context.Context) {
	// 앱 시작 후 2초 뒤 백그라운드에서 조용히 업데이트 체크
	go func() {
		time.Sleep(2 * time.Second)
		info, err := m.svc.CheckUpdate()
		if err == nil && info != nil {
			if m.svc.log != nil {
				m.svc.log.Info("자동 업데이트 점검 완료", "hasUpdate", info.HasUpdate, "latest", info.LatestVersion, "current", info.CurrentVersion)
			}
			if info.HasUpdate && m.svc.bus != nil {
				m.svc.bus.Publish("updater", "updater.available", info)
			}
		}
	}()
}

// Binding 은 화면에 노출할 서비스 구조체를 돌려줍니다.
func (m *Module) Binding() any { return m.svc }

// Service 는 화면에서 호출하는 업데이트 관련 함수들입니다.
type Service struct {
	bus   *eventbus.Bus
	paths *paths.Paths
	log   *slog.Logger
}

// CheckUpdate 는 GitHub에서 최신 릴리즈 정보를 조회하고 현재 버전과 비교합니다.
func (s *Service) CheckUpdate() (*UpdateInfo, error) {
	client := &http.Client{Timeout: 12 * time.Second}
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
		lower := strings.ToLower(asset.Name)
		if strings.HasSuffix(lower, ".exe") || strings.HasSuffix(lower, ".zip") {
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

// ApplyUpdate 는 다운로드 URL에서 새 실행 파일을 받아 현재 프로그램을 자가 교체(In-place)하고 재시작합니다.
func (s *Service) ApplyUpdate(downloadURL string) error {
	if downloadURL == "" {
		return errors.New("다운로드 주소가 올바르지 않습니다.")
	}

	// 1. 현재 실행 중인 파일 경로 확인
	currExe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("현재 실행 파일 경로 확인 실패: %w", err)
	}
	currExe, err = filepath.EvalSymlinks(currExe)
	if err != nil {
		return fmt.Errorf("실행 파일 경로 해석 실패: %w", err)
	}

	appDir := filepath.Dir(currExe)
	tempFile := filepath.Join(appDir, "kkomi_update.tmp")
	_ = os.Remove(tempFile)

	// 2. 파일 다운로드
	s.publishProgress(10, "최신 업데이트 파일 다운로드 중...")
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("다운로드 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("다운로드 서버 응답 오류 (상태 코드: %d)", resp.StatusCode)
	}

	out, err := os.Create(tempFile)
	if err != nil {
		return fmt.Errorf("임시 파일 생성 실패: %w", err)
	}

	// 다운로드 진행률 기록
	totalBytes := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)
	lastPercent := 10

	for {
		nr, er := resp.Body.Read(buf)
		if nr > 0 {
			nw, ew := out.Write(buf[0:nr])
			if ew != nil {
				out.Close()
				return fmt.Errorf("파일 쓰기 실패: %w", ew)
			}
			downloaded += int64(nw)
			if totalBytes > 0 {
				percent := 10 + int(float64(downloaded)/float64(totalBytes)*70)
				if percent > lastPercent+5 && percent <= 80 {
					lastPercent = percent
					s.publishProgress(percent, fmt.Sprintf("다운로드 중 (%d%%)...", percent))
				}
			}
		}
		if er != nil {
			if er != io.EOF {
				out.Close()
				return fmt.Errorf("다운로드 도중 오류: %w", er)
			}
			break
		}
	}
	out.Close()

	// 3. zip 파일인 경우 압축 해제하여 exe 추출
	targetNewExe := tempFile
	if strings.HasSuffix(strings.ToLower(downloadURL), ".zip") {
		s.publishProgress(85, "압축 해제 및 실행 파일 준비 중...")
		extractedExe, err := extractExeFromZip(tempFile, appDir)
		if err != nil {
			_ = os.Remove(tempFile)
			return fmt.Errorf("압축 해제 실패: %w", err)
		}
		_ = os.Remove(tempFile)
		targetNewExe = extractedExe
	}

	// 4. In-Place 자가 교체 (Windows Safe Replace)
	// Windows에서는 실행 중인 exe를 삭제하거나 덮어쓸 수는 없지만, 이름 변경(Rename)은 허용됩니다!
	s.publishProgress(95, "프로그램 교체 및 재시작 준비 중...")
	oldExe := currExe + ".old"
	_ = os.Remove(oldExe) // 기존 .old 파일 제거

	if err := os.Rename(currExe, oldExe); err != nil {
		_ = os.Remove(targetNewExe)
		return fmt.Errorf("기존 프로그램 이름 변경 실패: %w", err)
	}

	if err := os.Rename(targetNewExe, currExe); err != nil {
		// 복구 시도
		_ = os.Rename(oldExe, currExe)
		return fmt.Errorf("새 프로그램 적용 실패: %w", err)
	}

	s.publishProgress(100, "업데이트 완료! 새 버전으로 재시작합니다.")

	// 5. 새 실행 파일 백그라운드 시작 후 현재 프로세스 정상 종료
	go func() {
		time.Sleep(1 * time.Second)
		cmd := exec.Command(currExe)
		cmd.Dir = appDir
		_ = cmd.Start()
		os.Exit(0)
	}()

	return nil
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

func (s *Service) publishProgress(percent int, msg string) {
	if s.bus != nil {
		s.bus.Publish("updater", "updater.progress", map[string]any{
			"percent": percent,
			"message": msg,
		})
	}
}

// IsNewerVersion 은 latest 버전이 current 버전보다 최신인지 비교합니다.
// 예: latest="v0.1.2", current="0.1.1" -> true
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

// zip 파일에서 .exe 압축 해제
func extractExeFromZip(zipPath, destDir string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	for _, f := range r.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".exe") {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			defer rc.Close()

			targetPath := filepath.Join(destDir, "kkomi_extracted.tmp")
			outFile, err := os.Create(targetPath)
			if err != nil {
				return "", err
			}
			defer outFile.Close()

			if _, err := io.Copy(outFile, rc); err != nil {
				return "", err
			}
			return targetPath, nil
		}
	}
	return "", errors.New("zip 압축 파일 내에 실행 파일(.exe)이 없습니다.")
}

// 이전 실행 시 남겨둔 .old 임시 백업 파일 정리
func cleanupOldBinary() {
	time.Sleep(5 * time.Second)
	currExe, err := os.Executable()
	if err == nil {
		_ = os.Remove(currExe + ".old")
	}
}
