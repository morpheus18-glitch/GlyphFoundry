package protocol

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type Handler struct {
	apiURL   string
	tenantID string
	client   *http.Client
}

func NewHandler(apiURL, tenantID string) *Handler {
	return &Handler{
		apiURL:   apiURL,
		tenantID: tenantID,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (h *Handler) SendMetrics(metrics []MetricData) error {
	if len(metrics) == 0 {
		return nil
	}

	jsonData, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %w", err)
	}

	req, err := http.NewRequest("POST", h.apiURL+"/api/glyphs/generate", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-Id", h.tenantID)

	resp, err := h.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result GlyphGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("Successfully generated %d glyphs from %d metrics", result.GeneratedCount, len(metrics))
	return nil
}

func CreateMetric(name string, value float64, metricType string, sourceID string, labels map[string]string) MetricData {
	return MetricData{
		MetricName:  name,
		MetricValue: value,
		MetricType:  metricType,
		Timestamp:   time.Now(),
		SourceID:    sourceID,
		Labels:      labels,
	}
}
