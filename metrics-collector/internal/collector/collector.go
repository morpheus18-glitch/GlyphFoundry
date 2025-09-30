package collector

import (
	"context"
	"fmt"
	"log"
	"os"
	"runtime"
	"sync"
	"time"

	"glyph-foundry/metrics-collector/internal/protocol"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type Collector struct {
	handler    *protocol.Handler
	sourceID   string
	interval   time.Duration
	batchSize  int
	buffer     chan protocol.MetricData
	enableCPU  bool
	enableMem  bool
	enableNet  bool
	enableDisk bool
}

func New(handler *protocol.Handler, sourceID string, interval time.Duration, batchSize int, bufferSize int,
	enableCPU, enableMem, enableNet, enableDisk bool) *Collector {
	
	if sourceID == "" {
		hostname, _ := os.Hostname()
		sourceID = fmt.Sprintf("%s-%d", hostname, os.Getpid())
	}

	return &Collector{
		handler:    handler,
		sourceID:   sourceID,
		interval:   interval,
		batchSize:  batchSize,
		buffer:     make(chan protocol.MetricData, bufferSize),
		enableCPU:  enableCPU,
		enableMem:  enableMem,
		enableNet:  enableNet,
		enableDisk: enableDisk,
	}
}

func (c *Collector) Start(ctx context.Context) error {
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		c.collectLoop(ctx)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		c.sendLoop(ctx)
	}()

	<-ctx.Done()
	close(c.buffer)
	wg.Wait()
	
	return nil
}

func (c *Collector) collectLoop(ctx context.Context) {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.collectMetrics()
		}
	}
}

func (c *Collector) collectMetrics() {
	labels := map[string]string{
		"collector": "glyph-metrics",
		"runtime":   runtime.Version(),
	}

	if c.enableCPU {
		c.collectCPUMetrics(labels)
	}
	if c.enableMem {
		c.collectMemoryMetrics(labels)
	}
	if c.enableNet {
		c.collectNetworkMetrics(labels)
	}
	if c.enableDisk {
		c.collectDiskMetrics(labels)
	}
}

func (c *Collector) collectCPUMetrics(labels map[string]string) {
	percentages, err := cpu.Percent(0, true)
	if err == nil {
		for i, pct := range percentages {
			cpuLabels := copyLabels(labels)
			cpuLabels["cpu"] = fmt.Sprintf("cpu%d", i)
			
			c.buffer <- protocol.CreateMetric(
				"cpu_usage_percent",
				pct,
				protocol.MetricTypeCPU,
				c.sourceID,
				cpuLabels,
			)
		}
	}
}

func (c *Collector) collectMemoryMetrics(labels map[string]string) {
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		c.buffer <- protocol.CreateMetric(
			"memory_usage_percent",
			vmStat.UsedPercent,
			protocol.MetricTypeMemory,
			c.sourceID,
			labels,
		)
		
		c.buffer <- protocol.CreateMetric(
			"memory_used_bytes",
			float64(vmStat.Used),
			protocol.MetricTypeMemory,
			c.sourceID,
			labels,
		)
	}
}

func (c *Collector) collectNetworkMetrics(labels map[string]string) {
	ioCounters, err := net.IOCounters(true)
	if err == nil {
		for _, counter := range ioCounters {
			netLabels := copyLabels(labels)
			netLabels["interface"] = counter.Name
			
			c.buffer <- protocol.CreateMetric(
				"network_bytes_sent",
				float64(counter.BytesSent),
				protocol.MetricTypeNetwork,
				c.sourceID,
				netLabels,
			)
			
			c.buffer <- protocol.CreateMetric(
				"network_bytes_recv",
				float64(counter.BytesRecv),
				protocol.MetricTypeNetwork,
				c.sourceID,
				netLabels,
			)
		}
	}
}

func (c *Collector) collectDiskMetrics(labels map[string]string) {
	partitions, err := disk.Partitions(false)
	if err == nil {
		for _, partition := range partitions {
			usage, err := disk.Usage(partition.Mountpoint)
			if err == nil {
				diskLabels := copyLabels(labels)
				diskLabels["device"] = partition.Device
				diskLabels["mountpoint"] = partition.Mountpoint
				
				c.buffer <- protocol.CreateMetric(
					"disk_usage_percent",
					usage.UsedPercent,
					protocol.MetricTypeDisk,
					c.sourceID,
					diskLabels,
				)
			}
		}
	}
}

func (c *Collector) sendLoop(ctx context.Context) {
	batch := make([]protocol.MetricData, 0, c.batchSize)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			if len(batch) > 0 {
				c.sendBatch(batch)
			}
			return
		case metric, ok := <-c.buffer:
			if !ok {
				if len(batch) > 0 {
					c.sendBatch(batch)
				}
				return
			}
			batch = append(batch, metric)
			if len(batch) >= c.batchSize {
				c.sendBatch(batch)
				batch = make([]protocol.MetricData, 0, c.batchSize)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				c.sendBatch(batch)
				batch = make([]protocol.MetricData, 0, c.batchSize)
			}
		}
	}
}

func (c *Collector) sendBatch(batch []protocol.MetricData) {
	if err := c.handler.SendMetrics(batch); err != nil {
		log.Printf("Failed to send metrics batch: %v", err)
	}
}

func copyLabels(labels map[string]string) map[string]string {
	copied := make(map[string]string, len(labels))
	for k, v := range labels {
		copied[k] = v
	}
	return copied
}
