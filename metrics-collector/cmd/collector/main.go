package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"glyph-foundry/metrics-collector/internal/collector"
	"glyph-foundry/metrics-collector/internal/config"
	"glyph-foundry/metrics-collector/internal/protocol"
)

func main() {
	log.Println("Starting Glyph Foundry Metrics Collector...")

	cfg := config.Load()
	log.Printf("Configuration: API=%s, Interval=%s, Batch=%d, Workers=%d",
		cfg.GlyphAPIURL, cfg.CollectionInterval, cfg.MaxMetricsPerBatch, cfg.WorkerCount)

	handler := protocol.NewHandler(cfg.GlyphAPIURL, cfg.TenantID)

	sourceID := os.Getenv("SOURCE_ID")
	c := collector.New(
		handler,
		sourceID,
		cfg.CollectionInterval,
		cfg.MaxMetricsPerBatch,
		cfg.BufferSize,
		cfg.EnableCPUMetrics,
		cfg.EnableMemoryMetrics,
		cfg.EnableNetworkMetrics,
		cfg.EnableDiskMetrics,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Received shutdown signal, stopping collector...")
		cancel()
	}()

	log.Println("Metrics collector started successfully")
	if err := c.Start(ctx); err != nil {
		log.Fatalf("Collector failed: %v", err)
	}

	log.Println("Metrics collector stopped")
}
