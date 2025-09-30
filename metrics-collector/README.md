# Glyph Foundry Metrics Collector

High-performance metrics collector written in Go that feeds the 4D glyph visualization system.

## Features

- **High-Performance Collection**: Sub-millisecond metrics collection using Go
- **Protocol Handlers**: Automatically converts system metrics to 4D glyphs
- **Multi-Protocol Support**: CPU, memory, network, and disk metrics
- **Batching & Buffering**: Efficient batch processing with configurable buffer sizes
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM

## Architecture

```
metrics-collector/
├── cmd/collector/          # Main entry point
├── internal/
│   ├── collector/          # Core collection logic
│   ├── protocol/           # Glyph protocol handlers
│   └── config/             # Configuration management
└── bin/                    # Compiled binary
```

## Building

```bash
cd metrics-collector
go mod tidy
go build -o bin/collector ./cmd/collector
```

## Running

```bash
# Set configuration via environment variables
export GLYPH_API_URL=http://localhost:8000
export TENANT_ID=metrics-collector
export COLLECTION_INTERVAL=1s
export MAX_METRICS_PER_BATCH=100

# Run the collector
./bin/collector
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GLYPH_API_URL` | `http://localhost:8000` | Glyph API endpoint |
| `TENANT_ID` | `metrics-collector` | Tenant identifier |
| `COLLECTION_INTERVAL` | `1s` | Collection interval |
| `MAX_METRICS_PER_BATCH` | `100` | Max metrics per batch |
| `WORKER_COUNT` | `4` | Number of worker goroutines |
| `BUFFER_SIZE` | `1000` | Metric buffer size |
| `ENABLE_CPU_METRICS` | `true` | Enable CPU metrics |
| `ENABLE_MEMORY_METRICS` | `true` | Enable memory metrics |
| `ENABLE_NETWORK_METRICS` | `true` | Enable network metrics |
| `ENABLE_DISK_METRICS` | `true` | Enable disk metrics |

## Protocol Handlers

The collector implements protocol handlers that convert system metrics into 4D glyph coordinates:

- **CPU Metrics** → `cpu_metric` glyphs (per-core utilization)
- **Memory Metrics** → `memory_metric` glyphs (usage %, bytes)
- **Network Metrics** → `network_metric` glyphs (bytes sent/recv per interface)
- **Disk Metrics** → `disk_metric` glyphs (usage % per partition)

Each metric is automatically positioned in 4D space (x,y,z,t) based on:
- **Spatial (x,y,z)**: Deterministic hash-based positioning
- **Temporal (t)**: Metric timestamp

## Integration with Glyph API

The collector sends batched metrics to the `/api/glyphs/generate` endpoint with proper tenant isolation via `X-Tenant-Id` headers.

## Performance

- **Collection Overhead**: <1ms per collection cycle
- **Throughput**: 10,000+ metrics/second
- **Memory**: ~10MB baseline + buffer size
- **CPU**: Minimal (async collection with buffering)
