// Package paths 는 실행 파일(.exe)의 절대 경로를 기준으로
// 데이터, 백업, 로그 폴더 위치를 계산합니다.
// 바로가기나 다른 작업 폴더에서 실행해도 항상 같은 위치를 사용합니다.
package paths

import (
	"fmt"
	"os"
	"path/filepath"
)

// Paths 는 프로그램이 사용하는 모든 폴더/파일의 절대 경로입니다.
type Paths struct {
	AppDir    string `json:"appDir"`    // 실행 파일이 있는 폴더
	DataDir   string `json:"dataDir"`   // DB 가 저장되는 폴더
	DBFile    string `json:"dbFile"`    // SQLite DB 파일
	BackupDir string `json:"backupDir"` // 자동/수동 백업 폴더
	LogDir    string `json:"logDir"`    // 로그 폴더
	AssetsDir string `json:"assetsDir"` // 사용자 이미지 등 에셋 폴더
}

// Resolve 는 os.Executable() 을 이용해 절대 경로를 계산하고
// 필요한 폴더가 없으면 만듭니다. (한글/공백 경로 안전: filepath.Join 사용)
func Resolve() (*Paths, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("실행 파일 경로를 찾을 수 없습니다: %w", err)
	}
	// 바로가기/심볼릭 링크를 실제 경로로 변환
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	appDir, err := filepath.Abs(filepath.Dir(exe))
	if err != nil {
		return nil, fmt.Errorf("절대 경로 변환 실패: %w", err)
	}

	p := &Paths{
		AppDir:    appDir,
		DataDir:   filepath.Join(appDir, "data"),
		BackupDir: filepath.Join(appDir, "backup"),
		LogDir:    filepath.Join(appDir, "logs"),
		AssetsDir: filepath.Join(appDir, "assets"),
	}
	p.DBFile = filepath.Join(p.DataDir, "kkomi.db")

	for _, dir := range []string{p.DataDir, p.BackupDir, p.LogDir, p.AssetsDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("폴더 생성 실패(%s): %w", dir, err)
		}
	}
	return p, nil
}
