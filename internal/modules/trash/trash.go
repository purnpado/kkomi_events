// Package trash 는 삭제된 내역(소프트 삭제)을 조회하고 복원하거나 영구 삭제하는 휴지통 모듈입니다.
package trash

import (
	"database/sql"
	"fmt"
	"sort"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// TrashItem 은 휴지통에 보관된 항목 정보입니다.
type TrashItem struct {
	ID        int64  `json:"id"`
	ItemType  string `json:"itemType"`  // "received", "sent", "my_event"
	TypeLabel string `json:"typeLabel"` // "받은 축의·부의금", "보낸 경조사비", "나의 행사"
	Title     string `json:"title"`     // 이름 또는 행사명
	Subtitle  string `json:"subtitle"`  // 관계, 소속 행사명, 주인공 등
	EventDate string `json:"eventDate"` // 행사 일자
	Amount    int64  `json:"amount"`    // 금액 (행사인 경우 0)
	DeletedAt string `json:"deletedAt"` // 삭제 일시
}

type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "trash" }

func (m *Module) Migrations() []db.Migration {
	return nil // 기존 테이블의 deleted_at 컬럼을 활용하므로 새 테이블이 필요 없습니다.
}

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

// List 는 휴지통에 있는 모든 삭제된 항목(받은 돈, 보낸 돈, 나의 행사)을 삭제일시 최신순으로 조회합니다.
func (s *Service) List() ([]TrashItem, error) {
	var items []TrashItem

	// 1. 받은 축의·부의금 (received)
	rRows, err := s.db.Query(`SELECT r.id, r.name, r.relationship, r.amount, COALESCE(e.event_date, ''), COALESCE(e.title, ''), r.deleted_at
		FROM received r
		LEFT JOIN my_event e ON r.my_event_id = e.id
		WHERE r.deleted_at IS NOT NULL`)
	if err == nil {
		defer rRows.Close()
		for rRows.Next() {
			var it TrashItem
			var rel, eventTitle string
			it.ItemType = "received"
			it.TypeLabel = "받은 돈 (나의 경조사)"
			if err := rRows.Scan(&it.ID, &it.Title, &rel, &it.Amount, &it.EventDate, &eventTitle, &it.DeletedAt); err == nil {
				if eventTitle != "" {
					it.Subtitle = fmt.Sprintf("[%s] %s", eventTitle, rel)
				} else {
					it.Subtitle = rel
				}
				items = append(items, it)
			}
		}
	}

	// 2. 보낸 경조사비 (sent)
	sRows, err := s.db.Query(`SELECT s.id, s.name, s.relationship, s.amount, s.event_date, COALESCE(t.name, ''), s.deleted_at
		FROM sent s
		LEFT JOIN event_type t ON s.event_type_id = t.id
		WHERE s.deleted_at IS NOT NULL`)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var it TrashItem
			var rel, typeName string
			it.ItemType = "sent"
			it.TypeLabel = "보낸 돈 (타인 경조사)"
			if err := sRows.Scan(&it.ID, &it.Title, &rel, &it.Amount, &it.EventDate, &typeName, &it.DeletedAt); err == nil {
				if typeName != "" {
					it.Subtitle = fmt.Sprintf("[%s] %s", typeName, rel)
				} else {
					it.Subtitle = rel
				}
				items = append(items, it)
			}
		}
	}

	// 3. 나의 행사 (my_event)
	eRows, err := s.db.Query(`SELECT e.id, e.title, e.target_name, e.event_date, e.deleted_at, COALESCE(t.name, '')
		FROM my_event e
		LEFT JOIN event_type t ON e.event_type_id = t.id
		WHERE e.deleted_at IS NOT NULL`)
	if err == nil {
		defer eRows.Close()
		for eRows.Next() {
			var it TrashItem
			var targetName, typeName string
			it.ItemType = "my_event"
			it.TypeLabel = "나의 행사"
			it.Amount = 0
			if err := eRows.Scan(&it.ID, &it.Title, &targetName, &it.EventDate, &it.DeletedAt, &typeName); err == nil {
				if targetName != "" {
					it.Subtitle = fmt.Sprintf("[%s] 주인공: %s", typeName, targetName)
				} else {
					it.Subtitle = typeName
				}
				items = append(items, it)
			}
		}
	}

	// 삭제일시 최신순(내림차순) 정렬
	sort.Slice(items, func(i, j int) bool {
		return items[i].DeletedAt > items[j].DeletedAt
	})

	return items, nil
}

// GetCount 는 휴지통에 보관된 총 삭제 항목 건수를 반환합니다.
func (s *Service) GetCount() (int, error) {
	var count int
	_ = s.db.QueryRow(`SELECT 
		(SELECT COUNT(*) FROM received WHERE deleted_at IS NOT NULL) +
		(SELECT COUNT(*) FROM sent WHERE deleted_at IS NOT NULL) +
		(SELECT COUNT(*) FROM my_event WHERE deleted_at IS NOT NULL)`).Scan(&count)
	return count, nil
}

// Restore 는 선택한 항목을 휴지통에서 다시 정상 목록으로 복원합니다.
func (s *Service) Restore(itemType string, id int64) error {
	switch itemType {
	case "received":
		// 복원 시 해당 행사가 아직 존재하는지 확인
		var eventDeletedAt sql.NullString
		err := s.db.QueryRow(`SELECT e.deleted_at FROM received r LEFT JOIN my_event e ON r.my_event_id = e.id WHERE r.id=?`, id).Scan(&eventDeletedAt)
		if err == nil && eventDeletedAt.Valid {
			return fmt.Errorf("소속된 나의 경조사 행사가 삭제된 상태입니다. 행사를 먼저 복원해주세요.")
		}

		res, err := s.db.Exec(`UPDATE received SET deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, id)
		if err != nil {
			return fmt.Errorf("받은 내역 복원 실패: %w", err)
		}
		if n, _ := res.RowsAffected(); n > 0 && s.bus != nil {
			s.bus.Publish("received", "received.restored", id)
			s.bus.Publish("trash", "trash.restored", map[string]any{"type": "received", "id": id})
		}

	case "sent":
		res, err := s.db.Exec(`UPDATE sent SET deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, id)
		if err != nil {
			return fmt.Errorf("보낸 내역 복원 실패: %w", err)
		}
		if n, _ := res.RowsAffected(); n > 0 && s.bus != nil {
			s.bus.Publish("sent", "sent.restored", id)
			s.bus.Publish("trash", "trash.restored", map[string]any{"type": "sent", "id": id})
		}

	case "my_event":
		res, err := s.db.Exec(`UPDATE my_event SET deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, id)
		if err != nil {
			return fmt.Errorf("행사 복원 실패: %w", err)
		}
		if n, _ := res.RowsAffected(); n > 0 && s.bus != nil {
			s.bus.Publish("myevent", "myevent.restored", id)
			s.bus.Publish("trash", "trash.restored", map[string]any{"type": "my_event", "id": id})
		}

	default:
		return fmt.Errorf("알 수 없는 항목 종류입니다: %s", itemType)
	}

	return nil
}

// RestoreAll 은 휴지통에 있는 모든 항목을 한 번에 복원합니다.
func (s *Service) RestoreAll() (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// 1. 행사 먼저 복원
	res1, _ := tx.Exec(`UPDATE my_event SET deleted_at=NULL WHERE deleted_at IS NOT NULL`)
	n1, _ := res1.RowsAffected()

	// 2. 받은 내역 복원
	res2, _ := tx.Exec(`UPDATE received SET deleted_at=NULL WHERE deleted_at IS NOT NULL`)
	n2, _ := res2.RowsAffected()

	// 3. 보낸 내역 복원
	res3, _ := tx.Exec(`UPDATE sent SET deleted_at=NULL WHERE deleted_at IS NOT NULL`)
	n3, _ := res3.RowsAffected()

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	total := int(n1 + n2 + n3)
	if s.bus != nil {
		s.bus.Publish("trash", "trash.restored_all", total)
	}
	return total, nil
}

// Purge 는 휴지통의 특정 항목을 영구적으로 삭제합니다. (되돌릴 수 없음)
func (s *Service) Purge(itemType string, id int64) error {
	switch itemType {
	case "received":
		_, err := s.db.Exec(`DELETE FROM received WHERE id=? AND deleted_at IS NOT NULL`, id)
		if err != nil {
			return fmt.Errorf("받은 내역 영구 삭제 실패: %w", err)
		}
	case "sent":
		_, err := s.db.Exec(`DELETE FROM sent WHERE id=? AND deleted_at IS NOT NULL`, id)
		if err != nil {
			return fmt.Errorf("보낸 내역 영구 삭제 실패: %w", err)
		}
	case "my_event":
		// 행사에 딸린 받은 내역도 함께 영구 삭제
		_, _ = s.db.Exec(`DELETE FROM received WHERE my_event_id=?`, id)
		_, err := s.db.Exec(`DELETE FROM my_event WHERE id=? AND deleted_at IS NOT NULL`, id)
		if err != nil {
			return fmt.Errorf("행사 영구 삭제 실패: %w", err)
		}
	default:
		return fmt.Errorf("알 수 없는 항목 종류입니다: %s", itemType)
	}

	if s.bus != nil {
		s.bus.Publish("trash", "trash.purged", map[string]any{"type": itemType, "id": id})
	}
	return nil
}

// PurgeAll 은 휴지통의 모든 항목을 완전히 영구 삭제(비우기)합니다.
func (s *Service) PurgeAll() (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res1, _ := tx.Exec(`DELETE FROM received WHERE deleted_at IS NOT NULL`)
	n1, _ := res1.RowsAffected()

	res2, _ := tx.Exec(`DELETE FROM sent WHERE deleted_at IS NOT NULL`)
	n2, _ := res2.RowsAffected()

	res3, _ := tx.Exec(`DELETE FROM my_event WHERE deleted_at IS NOT NULL`)
	n3, _ := res3.RowsAffected()

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	total := int(n1 + n2 + n3)
	if s.bus != nil {
		s.bus.Publish("trash", "trash.purged_all", total)
	}
	return total, nil
}
