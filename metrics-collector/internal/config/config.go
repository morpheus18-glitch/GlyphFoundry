package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	// Collector settings
	CollectionInterval time.Duration
	GlyphAPIURL        string
	TenantID           string
	
	// Performance settings
	MaxMetricsPerBatch int
	WorkerCount        int
	BufferSize         int
	
	// Protocol settings
	EnableCPUMetrics     bool
	EnableMemoryMetrics  bool
	EnableNetworkMetrics bool
	EnableDiskMetrics    bool
}

func Load() *Config {
	return &Config{
		CollectionInterval:   getDuration("COLLECTION_INTERVAL", 1*time.Second),
		GlyphAPIURL:         getEnv("GLYPH_API_URL", "http://localhost:8000"),
		TenantID:            getEnv("TENANT_ID", "metrics-collector"),
		MaxMetricsPerBatch:  getInt("MAX_METRICS_PER_BATCH", 100),
		WorkerCount:         getInt("WORKER_COUNT", 4),
		BufferSize:          getInt("BUFFER_SIZE", 1000),
		EnableCPUMetrics:    getBool("ENABLE_CPU_METRICS", true),
		EnableMemoryMetrics: getBool("ENABLE_MEMORY_METRICS", true),
		EnableNetworkMetrics: getBool("ENABLE_NETWORK_METRICS", true),
		EnableDiskMetrics:   getBool("ENABLE_DISK_METRICS", true),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

func getDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
