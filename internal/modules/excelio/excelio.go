// Package excelio 는 경조사비 장부를 엑셀(.xlsx) 파일로 내보내거나
// 기존 엑셀 장부를 대량으로 불러오는 기능을 제공하는 모듈입니다.
package excelio

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xuri/excelize/v2"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// ImportResult 는 엑셀 가져오기 결과입니다.
type ImportResult struct {
	TotalRows   int      `json:"totalRows"`
	SuccessRows int      `json:"successRows"`
	SkippedRows int      `json:"skippedRows"`
	Errors      []string `json:"errors"`
}

type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "excelio" }

func (m *Module) Migrations() []db.Migration {
	return nil // 엑셀 입출력은 별도 테이블이 필요 없습니다.
}

func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	return nil
}

func (m *Module) OnStartup(ctx context.Context) {
	m.svc.ctx = ctx
}

func (m *Module) Binding() any { return m.svc }

type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
	ctx context.Context
}

// ExportMyEvent 는 선택한 행사의 받은 내역 장부를 서식 있는 엑셀 파일로 내보냅니다.
func (s *Service) ExportMyEvent(myEventId int64) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("윈도우 화면 컨텍스트가 준비되지 않았습니다.")
	}

	// 1. 행사 정보 조회
	var title, eventDate, location, targetName, notes string
	err := s.db.QueryRow(`SELECT title, event_date, location, target_name, notes FROM my_event WHERE id=?`, myEventId).
		Scan(&title, &eventDate, &location, &targetName, &notes)
	if err != nil {
		return "", fmt.Errorf("행사 정보를 찾을 수 없습니다: %w", err)
	}

	// 2. 저장 경로 다이얼로그 띄우기
	defaultName := fmt.Sprintf("꼬미경조사_%s_%s.xlsx", sanitizeFileName(title), eventDate)
	savePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "나의 경조사 장부 엑셀 내보내기",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel 통합 문서 (*.xlsx)", Pattern: "*.xlsx"},
		},
	})
	if err != nil || savePath == "" {
		return "", nil // 취소
	}
	if !strings.HasSuffix(strings.ToLower(savePath), ".xlsx") {
		savePath += ".xlsx"
	}

	// 3. 받은 내역 목록 조회
	rows, err := s.db.Query(`SELECT id, name, phone, relationship, amount, payment_method, COALESCE(attendance, '직접 참석'), is_thanked, member_side, notes
		FROM received WHERE my_event_id=? AND deleted_at IS NULL ORDER BY id ASC`, myEventId)
	if err != nil {
		return "", fmt.Errorf("내역 조회 실패: %w", err)
	}
	defer rows.Close()

	type Item struct {
		ID         int64
		Name       string
		Phone      string
		Relation   string
		Amount     int64
		Method     string
		Attendance string
		IsThanked  int
		MemberSide string
		Notes      string
	}
	var items []Item
	var recIds []int64
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Phone, &it.Relation, &it.Amount, &it.Method, &it.Attendance, &it.IsThanked, &it.MemberSide, &it.Notes); err == nil {
			items = append(items, it)
			recIds = append(recIds, it.ID)
		}
	}

	// 맞춤 항목 목록 조회
	var customFields []struct {
		ID   int64
		Name string
		Type string
	}
	cfRows, _ := s.db.Query(`SELECT id, field_name, field_type FROM custom_field WHERE target_menu='myevent' ORDER BY sort_order ASC, id ASC`)
	if cfRows != nil {
		for cfRows.Next() {
			var cf struct {
				ID   int64
				Name string
				Type string
			}
			if err := cfRows.Scan(&cf.ID, &cf.Name, &cf.Type); err == nil {
				customFields = append(customFields, cf)
			}
		}
		cfRows.Close()
	}

	// 맞춤 항목 값 맵 구성
	cfValues := make(map[int64]map[int64]string)
	if len(recIds) > 0 {
		q := fmt.Sprintf(`SELECT record_id, field_id, val FROM custom_field_value WHERE record_id IN (%s)`, joinInt64s(recIds))
		if vRows, err := s.db.Query(q); err == nil {
			for vRows.Next() {
				var rId, fId int64
				var val string
				if err := vRows.Scan(&rId, &fId, &val); err == nil {
					if cfValues[rId] == nil {
						cfValues[rId] = make(map[int64]string)
					}
					cfValues[rId][fId] = val
				}
			}
			vRows.Close()
		}
	}

	// 4. 엑셀 파일 생성
	f := excelize.NewFile()
	defer f.Close()
	sheetName := "축의부의금장부"
	f.SetSheetName("Sheet1", sheetName)

	// 스타일 정의
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 16, Color: "1F2937"},
	})
	subTitleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Size: 10, Color: "4B5563"},
	})
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"E06346"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "D1D5DB", Style: 1},
			{Type: "top", Color: "D1D5DB", Style: 1},
			{Type: "bottom", Color: "D1D5DB", Style: 1},
			{Type: "right", Color: "D1D5DB", Style: 1},
		},
	})
	moneyStyle, _ := f.NewStyle(&excelize.Style{
		CustomNumFmt: strPtr("#,##0\"원\""),
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})
	centerStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})
	leftStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})

	// 상단 제목 및 행사 정보
	f.SetCellValue(sheetName, "A1", fmt.Sprintf("🌸 %s 축의·부의금 장부", title))
	f.SetCellStyle(sheetName, "A1", "A1", titleStyle)

	infoText := fmt.Sprintf("일시: %s  |  장소: %s  |  주인공: %s  |  총 인원: %d명", eventDate, location, targetName, len(items))
	f.SetCellValue(sheetName, "A2", infoText)
	f.SetCellStyle(sheetName, "A2", "A2", subTitleStyle)

	// 헤더 컬럼 목록 빌드
	headers := []string{"번호", "이름", "전화번호", "관계", "금액", "참석여부", "구분", "답례완료"}
	for _, cf := range customFields {
		headers = append(headers, cf.Name)
	}
	headers = append(headers, "비고")

	headerRow := 4
	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, headerRow)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}
	f.SetRowHeight(sheetName, headerRow, 28)

	// 데이터 행 작성
	var totalAmount int64
	for rowIdx, it := range items {
		r := headerRow + 1 + rowIdx
		totalAmount += it.Amount

		thankedStr := "미답례"
		if it.IsThanked == 1 {
			thankedStr = "완료"
		}

		c1, _ := excelize.CoordinatesToCellName(1, r)
		c2, _ := excelize.CoordinatesToCellName(2, r)
		c3, _ := excelize.CoordinatesToCellName(3, r)
		c4, _ := excelize.CoordinatesToCellName(4, r)
		c5, _ := excelize.CoordinatesToCellName(5, r)
		c6, _ := excelize.CoordinatesToCellName(6, r)
		c7, _ := excelize.CoordinatesToCellName(7, r)
		c8, _ := excelize.CoordinatesToCellName(8, r)

		f.SetCellValue(sheetName, c1, rowIdx+1)
		f.SetCellValue(sheetName, c2, it.Name)
		f.SetCellValue(sheetName, c3, it.Phone)
		f.SetCellValue(sheetName, c4, it.Relation)
		f.SetCellValue(sheetName, c5, it.Amount)
		f.SetCellValue(sheetName, c6, it.Attendance)
		f.SetCellValue(sheetName, c7, it.MemberSide)
		f.SetCellValue(sheetName, c8, thankedStr)

		f.SetCellStyle(sheetName, c1, c1, centerStyle)
		f.SetCellStyle(sheetName, c2, c2, leftStyle)
		f.SetCellStyle(sheetName, c3, c3, centerStyle)
		f.SetCellStyle(sheetName, c4, c4, centerStyle)
		f.SetCellStyle(sheetName, c5, c5, moneyStyle)
		f.SetCellStyle(sheetName, c6, c6, centerStyle)
		f.SetCellStyle(sheetName, c7, c7, centerStyle)
		f.SetCellStyle(sheetName, c8, c8, centerStyle)

		colOffset := 9
		for _, cf := range customFields {
			cell, _ := excelize.CoordinatesToCellName(colOffset, r)
			val := cfValues[it.ID][cf.ID]
			if cf.Type == "checkbox" {
				if val == "true" || val == "1" {
					val = "예"
				} else {
					val = "아니오"
				}
			}
			f.SetCellValue(sheetName, cell, val)
			f.SetCellStyle(sheetName, cell, cell, centerStyle)
			colOffset++
		}

		notesCell, _ := excelize.CoordinatesToCellName(colOffset, r)
		f.SetCellValue(sheetName, notesCell, it.Notes)
		f.SetCellStyle(sheetName, notesCell, notesCell, leftStyle)

		f.SetRowHeight(sheetName, r, 22)
	}

	// 합계 행 작성
	totalRow := headerRow + 1 + len(items)
	tCellA, _ := excelize.CoordinatesToCellName(1, totalRow)
	tCellD, _ := excelize.CoordinatesToCellName(4, totalRow)
	tCellE, _ := excelize.CoordinatesToCellName(5, totalRow)
	f.MergeCell(sheetName, tCellA, tCellD)
	f.SetCellValue(sheetName, tCellA, "합 계")
	f.SetCellValue(sheetName, tCellE, totalAmount)

	sumStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "991B1B"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FEE2E2"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "991B1B", Style: 2},
			{Type: "bottom", Color: "991B1B", Style: 2},
		},
	})
	sumMoneyStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Bold: true, Size: 12, Color: "991B1B"},
		Fill:         excelize.Fill{Type: "pattern", Color: []string{"FEE2E2"}, Pattern: 1},
		CustomNumFmt: strPtr("#,##0\"원\""),
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "991B1B", Style: 2},
			{Type: "bottom", Color: "991B1B", Style: 2},
		},
	})
	f.SetCellStyle(sheetName, tCellA, tCellD, sumStyle)
	f.SetCellStyle(sheetName, tCellE, tCellE, sumMoneyStyle)
	f.SetRowHeight(sheetName, totalRow, 26)

	// 열 너비 설정
	f.SetColWidth(sheetName, "A", "A", 8)
	f.SetColWidth(sheetName, "B", "B", 14)
	f.SetColWidth(sheetName, "C", "C", 16)
	f.SetColWidth(sheetName, "D", "D", 12)
	f.SetColWidth(sheetName, "E", "E", 18)
	f.SetColWidth(sheetName, "F", "F", 12)
	f.SetColWidth(sheetName, "G", "G", 12)
	f.SetColWidth(sheetName, "H", "H", 12)
	lastColName, _ := excelize.ColumnNumberToName(len(headers))
	f.SetColWidth(sheetName, "I", lastColName, 18)

	// 파일 저장
	if err := f.SaveAs(savePath); err != nil {
		return "", fmt.Errorf("엑셀 파일 저장 실패: %w", err)
	}

	s.bus.Publish("excelio", "excelio.exported", map[string]any{"path": savePath, "type": "myevent"})
	return savePath, nil
}

// ExportSent 는 타인의 경조사 보낸 내역 지출 장부를 엑셀로 내보냅니다.
func (s *Service) ExportSent(eventTypeId int64) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("윈도우 화면 컨텍스트가 준비되지 않았습니다.")
	}

	nowStr := time.Now().Format("2006-01-02")
	defaultName := fmt.Sprintf("꼬미경조사_보낸내역_%s.xlsx", nowStr)
	savePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "보낸 경조사비 장부 엑셀 내보내기",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel 통합 문서 (*.xlsx)", Pattern: "*.xlsx"},
		},
	})
	if err != nil || savePath == "" {
		return "", nil
	}
	if !strings.HasSuffix(strings.ToLower(savePath), ".xlsx") {
		savePath += ".xlsx"
	}

	// 쿼리 작성
	query := `SELECT s.id, s.name, s.phone, s.relationship, COALESCE(e.name, '기타'), s.event_date,
		s.amount, s.payment_method, s.attended, s.member_side, s.notes
		FROM sent s
		LEFT JOIN event_type e ON s.event_type_id = e.id
		WHERE s.deleted_at IS NULL`
	var args []any
	if eventTypeId > 0 {
		query += ` AND s.event_type_id = ?`
		args = append(args, eventTypeId)
	}
	query += ` ORDER BY s.event_date DESC, s.id DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	type Item struct {
		ID         int64
		Name       string
		Phone      string
		Relation   string
		TypeName   string
		EventDate  string
		Amount     int64
		Method     string
		Attended   int
		MemberSide string
		Notes      string
	}
	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Phone, &it.Relation, &it.TypeName, &it.EventDate,
			&it.Amount, &it.Method, &it.Attended, &it.MemberSide, &it.Notes); err == nil {
			items = append(items, it)
		}
	}

	f := excelize.NewFile()
	defer f.Close()
	sheetName := "보낸경조사비"
	f.SetSheetName("Sheet1", sheetName)

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 16, Color: "1F2937"},
	})
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"3B82F6"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "D1D5DB", Style: 1},
			{Type: "top", Color: "D1D5DB", Style: 1},
			{Type: "bottom", Color: "D1D5DB", Style: 1},
			{Type: "right", Color: "D1D5DB", Style: 1},
		},
	})
	moneyStyle, _ := f.NewStyle(&excelize.Style{
		CustomNumFmt: strPtr("#,##0\"원\""),
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})
	centerStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})
	leftStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
		},
	})

	f.SetCellValue(sheetName, "A1", "🌿 보낸 경조사비 지출 장부")
	f.SetCellStyle(sheetName, "A1", "A1", titleStyle)

	headers := []string{"번호", "날짜", "상대방", "전화번호", "관계", "경조사 종류", "금액", "지출수단", "참석여부", "구분", "비고"}
	headerRow := 3
	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, headerRow)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}
	f.SetRowHeight(sheetName, headerRow, 28)

	var totalAmount int64
	for rowIdx, it := range items {
		r := headerRow + 1 + rowIdx
		totalAmount += it.Amount

		attStr := "불참(송금)"
		if it.Attended == 1 {
			attStr = "참석"
		}

		c1, _ := excelize.CoordinatesToCellName(1, r)
		c2, _ := excelize.CoordinatesToCellName(2, r)
		c3, _ := excelize.CoordinatesToCellName(3, r)
		c4, _ := excelize.CoordinatesToCellName(4, r)
		c5, _ := excelize.CoordinatesToCellName(5, r)
		c6, _ := excelize.CoordinatesToCellName(6, r)
		c7, _ := excelize.CoordinatesToCellName(7, r)
		c8, _ := excelize.CoordinatesToCellName(8, r)
		c9, _ := excelize.CoordinatesToCellName(9, r)
		c10, _ := excelize.CoordinatesToCellName(10, r)
		c11, _ := excelize.CoordinatesToCellName(11, r)

		f.SetCellValue(sheetName, c1, rowIdx+1)
		f.SetCellValue(sheetName, c2, it.EventDate)
		f.SetCellValue(sheetName, c3, it.Name)
		f.SetCellValue(sheetName, c4, it.Phone)
		f.SetCellValue(sheetName, c5, it.Relation)
		f.SetCellValue(sheetName, c6, it.TypeName)
		f.SetCellValue(sheetName, c7, it.Amount)
		f.SetCellValue(sheetName, c8, it.Method)
		f.SetCellValue(sheetName, c9, attStr)
		f.SetCellValue(sheetName, c10, it.MemberSide)
		f.SetCellValue(sheetName, c11, it.Notes)

		f.SetCellStyle(sheetName, c1, c1, centerStyle)
		f.SetCellStyle(sheetName, c2, c2, centerStyle)
		f.SetCellStyle(sheetName, c3, c3, leftStyle)
		f.SetCellStyle(sheetName, c4, c4, centerStyle)
		f.SetCellStyle(sheetName, c5, c5, centerStyle)
		f.SetCellStyle(sheetName, c6, c6, centerStyle)
		f.SetCellStyle(sheetName, c7, c7, moneyStyle)
		f.SetCellStyle(sheetName, c8, c8, centerStyle)
		f.SetCellStyle(sheetName, c9, c9, centerStyle)
		f.SetCellStyle(sheetName, c10, c10, centerStyle)
		f.SetCellStyle(sheetName, c11, c11, leftStyle)

		f.SetRowHeight(sheetName, r, 22)
	}

	// 합계
	totalRow := headerRow + 1 + len(items)
	tCellA, _ := excelize.CoordinatesToCellName(1, totalRow)
	tCellF, _ := excelize.CoordinatesToCellName(6, totalRow)
	tCellG, _ := excelize.CoordinatesToCellName(7, totalRow)
	f.MergeCell(sheetName, tCellA, tCellF)
	f.SetCellValue(sheetName, tCellA, "합 계")
	f.SetCellValue(sheetName, tCellG, totalAmount)

	sumStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "1E40AF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"DBEAFE"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "1E40AF", Style: 2},
			{Type: "bottom", Color: "1E40AF", Style: 2},
		},
	})
	sumMoneyStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Bold: true, Size: 12, Color: "1E40AF"},
		Fill:         excelize.Fill{Type: "pattern", Color: []string{"DBEAFE"}, Pattern: 1},
		CustomNumFmt: strPtr("#,##0\"원\""),
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "1E40AF", Style: 2},
			{Type: "bottom", Color: "1E40AF", Style: 2},
		},
	})
	f.SetCellStyle(sheetName, tCellA, tCellF, sumStyle)
	f.SetCellStyle(sheetName, tCellG, tCellG, sumMoneyStyle)
	f.SetRowHeight(sheetName, totalRow, 26)

	f.SetColWidth(sheetName, "A", "A", 8)
	f.SetColWidth(sheetName, "B", "B", 13)
	f.SetColWidth(sheetName, "C", "C", 14)
	f.SetColWidth(sheetName, "D", "D", 16)
	f.SetColWidth(sheetName, "E", "E", 12)
	f.SetColWidth(sheetName, "F", "F", 14)
	f.SetColWidth(sheetName, "G", "G", 18)
	f.SetColWidth(sheetName, "H", "H", 12)
	f.SetColWidth(sheetName, "I", "I", 12)
	f.SetColWidth(sheetName, "J", "J", 12)
	f.SetColWidth(sheetName, "K", "K", 24)

	if err := f.SaveAs(savePath); err != nil {
		return "", fmt.Errorf("엑셀 파일 저장 실패: %w", err)
	}

	s.bus.Publish("excelio", "excelio.exported", map[string]any{"path": savePath, "type": "sent"})
	return savePath, nil
}

// DownloadTemplate 은 가져오기용 표준 엑셀 서식을 다운로드합니다.
func (s *Service) DownloadTemplate() (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("윈도우 화면 컨텍스트가 준비되지 않았습니다.")
	}

	savePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "축의·부의금 엑셀 가져오기 양식 저장",
		DefaultFilename: "축의부의금_가져오기_양식.xlsx",
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel 통합 문서 (*.xlsx)", Pattern: "*.xlsx"},
		},
	})
	if err != nil || savePath == "" {
		return "", nil
	}
	if !strings.HasSuffix(strings.ToLower(savePath), ".xlsx") {
		savePath += ".xlsx"
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "가져오기양식"
	f.SetSheetName("Sheet1", sheet)

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4B5563"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	headers := []string{"이름(필수)", "전화번호", "관계", "금액(필수)", "참석여부(직접참석/불참지인전달/불참송금)", "구분", "답례완료(예/아니오)", "비고"}
	for i, h := range headers {
		c, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, c, h)
		f.SetCellStyle(sheet, c, c, headerStyle)
	}

	// 샘플 데이터 2줄
	f.SetCellValue(sheet, "A2", "홍길동")
	f.SetCellValue(sheet, "B2", "010-1234-5678")
	f.SetCellValue(sheet, "C2", "친구")
	f.SetCellValue(sheet, "D2", 50000)
	f.SetCellValue(sheet, "E2", "직접 참석")
	f.SetCellValue(sheet, "F2", "신랑측")
	f.SetCellValue(sheet, "G2", "예")
	f.SetCellValue(sheet, "H2", "고등학교 동창")

	f.SetCellValue(sheet, "A3", "김철수")
	f.SetCellValue(sheet, "B3", "010-9876-5432")
	f.SetCellValue(sheet, "C3", "직장/동료")
	f.SetCellValue(sheet, "D3", 100000)
	f.SetCellValue(sheet, "E3", "불참 (계좌 송금)")
	f.SetCellValue(sheet, "F3", "신랑측")
	f.SetCellValue(sheet, "G3", "아니오")
	f.SetCellValue(sheet, "H3", "동행인 1명")

	f.SetColWidth(sheet, "A", "A", 15)
	f.SetColWidth(sheet, "B", "B", 18)
	f.SetColWidth(sheet, "C", "C", 14)
	f.SetColWidth(sheet, "D", "D", 16)
	f.SetColWidth(sheet, "E", "E", 18)
	f.SetColWidth(sheet, "F", "F", 14)
	f.SetColWidth(sheet, "G", "G", 18)
	f.SetColWidth(sheet, "H", "H", 25)

	if err := f.SaveAs(savePath); err != nil {
		return "", err
	}
	return savePath, nil
}

// ImportReceived 은 사용자가 선택한 엑셀 파일로부터 특정 행사의 축의/부의금 명부를 일괄 가져옵니다.
func (s *Service) ImportReceived(myEventId int64) (*ImportResult, error) {
	if s.ctx == nil {
		return nil, fmt.Errorf("윈도우 화면 컨텍스트가 준비되지 않았습니다.")
	}

	openPath, err := runtime.OpenFileDialog(s.ctx, runtime.OpenDialogOptions{
		Title: "축의·부의금 엑셀 파일 선택",
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel 통합 문서 (*.xlsx)", Pattern: "*.xlsx"},
		},
	})
	if err != nil || openPath == "" {
		return nil, nil // 취소
	}

	f, err := excelize.OpenFile(openPath)
	if err != nil {
		return nil, fmt.Errorf("엑셀 파일을 열 수 없습니다: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("엑셀 파일에 시트가 없습니다.")
	}
	rows, err := f.GetRows(sheets[0])
	if err != nil || len(rows) < 2 {
		return nil, fmt.Errorf("데이터가 없거나 읽을 수 없습니다.")
	}

	// 헤더 분석 (어떤 열이 이름, 금액인지 지능적 매핑)
	headerRow := rows[0]
	nameCol, phoneCol, relCol, amtCol, attCol, methodCol, sideCol, thankedCol, notesCol := -1, -1, -1, -1, -1, -1, -1, -1, -1

	for idx, cell := range headerRow {
		clean := strings.ReplaceAll(strings.TrimSpace(cell), " ", "")
		switch {
		case strings.Contains(clean, "이름") || strings.Contains(clean, "성명") || strings.Contains(clean, "참석자") || strings.Contains(clean, "입금자"):
			if nameCol == -1 {
				nameCol = idx
			}
		case strings.Contains(clean, "전화") || strings.Contains(clean, "연락처") || strings.Contains(clean, "핸드폰"):
			if phoneCol == -1 {
				phoneCol = idx
			}
		case strings.Contains(clean, "관계") || strings.Contains(clean, "소속"):
			if relCol == -1 {
				relCol = idx
			}
		case strings.Contains(clean, "금액") || strings.Contains(clean, "축의금") || strings.Contains(clean, "부의금") || strings.Contains(clean, "입금액"):
			if amtCol == -1 {
				amtCol = idx
			}
		case strings.Contains(clean, "참석") || strings.Contains(clean, "출석"):
			if attCol == -1 {
				attCol = idx
			}
		case strings.Contains(clean, "수납") || strings.Contains(clean, "방법") || strings.Contains(clean, "지불"):
			if methodCol == -1 {
				methodCol = idx
			}
		case strings.Contains(clean, "구분") || strings.Contains(clean, "측") || strings.Contains(clean, "손님"):
			if sideCol == -1 {
				sideCol = idx
			}
		case strings.Contains(clean, "답례"):
			if thankedCol == -1 {
				thankedCol = idx
			}
		case strings.Contains(clean, "비고") || strings.Contains(clean, "메모"):
			if notesCol == -1 {
				notesCol = idx
			}
		}
	}

	if nameCol == -1 || amtCol == -1 {
		return nil, fmt.Errorf("엑셀 첫 줄에서 '이름'과 '금액' 열을 찾을 수 없습니다.\n양식을 확인해주세요.")
	}

	result := &ImportResult{
		TotalRows: len(rows) - 1,
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	now := time.Now().Format(time.RFC3339)
	stmt, err := tx.Prepare(`INSERT INTO received(my_event_id, name, phone, phone_clean, relationship, amount, payment_method, attendance, is_thanked, member_side, notes, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for rIdx := 1; rIdx < len(rows); rIdx++ {
		row := rows[rIdx]
		if len(row) == 0 {
			result.SkippedRows++
			continue
		}

		name := getCell(row, nameCol)
		if strings.TrimSpace(name) == "" {
			result.SkippedRows++
			continue
		}

		amtStr := getCell(row, amtCol)
		amt := parseAmount(amtStr)
		if amt <= 0 {
			result.SkippedRows++
			result.Errors = append(result.Errors, fmt.Sprintf("%d행: '%s' 님의 금액이 올바르지 않아 건너뛰었습니다.", rIdx+1, name))
			continue
		}

		phone := getCell(row, phoneCol)
		cleanP := cleanPhone(phone)
		rel := getCell(row, relCol)
		if rel == "" {
			rel = "지인"
		}
		attendance := "직접 참석"
		if attCol != -1 {
			if a := getCell(row, attCol); a != "" {
				attendance = a
			}
		}
		method := getCell(row, methodCol)
		if method == "" {
			method = "현금"
		}
		side := getCell(row, sideCol)
		thankedStr := strings.TrimSpace(getCell(row, thankedCol))
		thankedInt := 0
		if thankedStr == "예" || thankedStr == "완료" || thankedStr == "1" || strings.EqualFold(thankedStr, "true") {
			thankedInt = 1
		}
		notes := getCell(row, notesCol)

		_, err := stmt.Exec(myEventId, name, phone, cleanP, rel, amt, method, attendance, thankedInt, side, notes, now, now)
		if err != nil {
			result.SkippedRows++
			result.Errors = append(result.Errors, fmt.Sprintf("%d행: DB 저장 오류 (%v)", rIdx+1, err))
		} else {
			result.SuccessRows++
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("데이터베이스 저장 완료 실패: %w", err)
	}

	s.bus.Publish("received", "received.created", map[string]any{"imported": result.SuccessRows})
	s.bus.Publish("myevent", "myevent.updated", map[string]any{"id": myEventId})
	return result, nil
}

func getCell(row []string, idx int) string {
	if idx >= 0 && idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func parseAmount(s string) int64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "원", "")
	s = strings.ReplaceAll(s, " ", "")
	val, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		// 부동소수점 시도
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			return int64(f)
		}
		return 0
	}
	return val
}

func cleanPhone(p string) string {
	var sb strings.Builder
	for _, r := range p {
		if r >= '0' && r <= '9' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func sanitizeFileName(name string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_", " ", "_")
	return replacer.Replace(name)
}

func joinInt64s(ids []int64) string {
	var sb strings.Builder
	for i, id := range ids {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(strconv.FormatInt(id, 10))
	}
	return sb.String()
}

func strPtr(s string) *string {
	return &s
}
