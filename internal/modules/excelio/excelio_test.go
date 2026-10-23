package excelio

import (
	"testing"
)

func TestParseAmount(t *testing.T) {
	tests := []struct {
		input    string
		expected int64
	}{
		{"50,000원", 50000},
		{"100000", 100000},
		{" 200,000 ", 200000},
		{"30000.0", 30000},
		{"abc", 0},
		{"", 0},
	}

	for _, tc := range tests {
		actual := parseAmount(tc.input)
		if actual != tc.expected {
			t.Errorf("parseAmount(%q) = %d, 기대값: %d", tc.input, actual, tc.expected)
		}
	}
}

func TestCleanPhone(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"010-1234-5678", "01012345678"},
		{"010 9876 5432", "01098765432"},
		{"02-123-4567", "021234567"},
		{"", ""},
	}

	for _, tc := range tests {
		actual := cleanPhone(tc.input)
		if actual != tc.expected {
			t.Errorf("cleanPhone(%q) = %s, 기대값: %s", tc.input, actual, tc.expected)
		}
	}
}
