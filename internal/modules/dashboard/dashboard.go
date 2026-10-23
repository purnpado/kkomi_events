// Package dashboard 는 대시보드 요약 지표와 통계(Canvas 차트용)를 계산하는 모듈입니다.
package dashboard

import (
	"database/sql"
	"fmt"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

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
		Monthly:    []MonthlyStat{},
		Categories: []CategoryStat{},
	}

	// 1. 받은 총액 및 건수
	_ = s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM received WHERE deleted_at IS NULL`).
		Scan(&data.TotalReceivedAmount, &data.TotalReceivedCount)

	// 2. 보낸 총액 및 건수
	_ = s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM sent WHERE deleted_at IS NULL`).
		Scan(&data.TotalSentAmount, &data.TotalSentCount)

	data.NetBalance = data.TotalReceivedAmount - data.TotalSentAmount

	// 3. 다가오는 일정 건수 (오늘 이후)
	today := time.Now().Format("2006-01-02")
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM sent WHERE event_date >= ? AND deleted_at IS NULL`, today).
		Scan(&data.UpcomingCount)

	// 4. 최근 6개월 월별 수입/지출 데이터 생성
	now := time.Now()
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		monthStr := t.Format("2006-01")

		var rAmt, sAmt int64
		// 받은 돈: my_event.event_date 기준
		_ = s.db.QueryRow(`SELECT COALESCE(SUM(r.amount), 0) FROM received r
			JOIN my_event e ON r.my_event_id=e.id
			WHERE e.event_date LIKE ? AND r.deleted_at IS NULL`, monthStr+"%").Scan(&rAmt)

		// 보낸 돈: sent.event_date 기준
		_ = s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM sent
			WHERE event_date LIKE ? AND deleted_at IS NULL`, monthStr+"%").Scan(&sAmt)

		data.Monthly = append(data.Monthly, MonthlyStat{
			Month:          fmt.Sprintf("%d월", t.Month()),
			ReceivedAmount: rAmt,
			SentAmount:     sAmt,
		})
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
