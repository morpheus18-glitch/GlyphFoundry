package protocol

import "time"

type MetricData struct {
	MetricName  string            `json:"metric_name"`
	MetricValue float64           `json:"metric_value"`
	MetricType  string            `json:"metric_type"`
	Timestamp   time.Time         `json:"timestamp"`
	SourceID    string            `json:"source_id"`
	Labels      map[string]string `json:"labels"`
}

type GlyphGenerateRequest struct {
	Metrics []MetricData `json:"metrics"`
}

type GlyphGenerateResponse struct {
	GeneratedCount int `json:"generated_count"`
}

const (
	MetricTypeCPU     = "cpu_metric"
	MetricTypeMemory  = "memory_metric"
	MetricTypeNetwork = "network_metric"
	MetricTypeDisk    = "disk_metric"
)
