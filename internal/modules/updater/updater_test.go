package updater

import "testing"

func TestIsNewerVersion(t *testing.T) {
	tests := []struct {
		latest   string
		current  string
		expected bool
	}{
		{"v0.1.1", "0.1.0", true},
		{"V0.1.1", "0.1.0", true},
		{"0.1.1", "0.1.0", true},
		{"v0.1.0", "0.1.0", false},
		{"v0.0.9", "0.1.0", false},
		{"v1.0.0", "0.1.0", true},
		{"v0.1.0", "0.1.1", false},
		{"v0.1.1.1", "0.1.1", true},
	}

	for _, tt := range tests {
		got := IsNewerVersion(tt.latest, tt.current)
		if got != tt.expected {
			t.Errorf("IsNewerVersion(%q, %q) = %v; want %v", tt.latest, tt.current, got, tt.expected)
		}
	}
}
