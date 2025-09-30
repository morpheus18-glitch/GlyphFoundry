# Production Infrastructure Setup Guide

## Overview

This guide provides complete setup instructions for the distributed infrastructure components required for the Glyph Foundry knowledge graph platform.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   API    │  │ Workers  │  │Collector │  │   MCP    │   │
│  │ (FastAPI)│  │ (Python) │  │   (Go)   │  │  Server  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │  Redis   │  │  Kafka   │  │  MinIO   │   │
│  │+pgvector │  │  Cache   │  │ Streams  │  │   S3     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Kubernetes Orchestration Layer                   │
│  - Auto-scaling (HPA)                                        │
│  - Service mesh                                              │
│  - Health checks & self-healing                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. PostgreSQL with pgvector

### Installation (Managed Service Recommended)

**Digital Ocean Managed Database:**
```bash
# Create managed PostgreSQL cluster with pgvector support
doctl databases create glyph-foundry-db \
  --engine pg \
  --version 15 \
  --size db-s-4vcpu-8gb \
  --region nyc3 \
  --num-nodes 2

# Enable pgvector extension
doctl databases sql glyph-foundry-db --command "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Self-Hosted (Docker Compose):**
```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: glyph_foundry
      POSTGRES_USER: glyph_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    command:
      - "postgres"
      - "-c" 
      - "shared_preload_libraries=pg_stat_statements,pgvector"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=2GB"
      - "-c"
      - "effective_cache_size=6GB"
      - "-c"
      - "maintenance_work_mem=512MB"
      - "-c"
      - "random_page_cost=1.1"
      - "-c"
      - "effective_io_concurrency=200"
      - "-c"
      - "work_mem=10MB"

volumes:
  pgdata:
```

### Schema Deployment

```bash
# Apply production schema
psql $DATABASE_URL -f backend/sql/03-production-schema.sql

# Verify extensions
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname IN ('vector', 'pgcrypto', 'uuid-ossp');"
```

### Performance Configuration

```sql
-- Vector index optimization
SET vector.hnsw.ef_search = 64;  -- Accuracy/speed tradeoff (40-80 typical)
SET vector.hnsw.ef_construction = 128;  -- Build quality

-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
```

---

## 2. Redis for Caching & Coordination

### Installation

**Managed Service (Digital Ocean):**
```bash
doctl databases create glyph-foundry-redis \
  --engine redis \
  --version 7 \
  --size db-s-2vcpu-4gb \
  --region nyc3
```

**Self-Hosted (Docker Compose with Security):**
```yaml
redis:
  image: redis:7.2-alpine  # Pinned version
  ports:
    - "6380:6380"  # TLS port only
  command: >
    redis-server
    --port 0
    --tls-port 6380
    --requirepass ${REDIS_PASSWORD}
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --tls-cert-file /tls/redis.crt
    --tls-key-file /tls/redis.key
    --tls-ca-cert-file /tls/ca.crt
    --tls-auth-clients no
  volumes:
    - redis-data:/data
    - ./tls:/tls:ro
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD}

# Client connection string: rediss://:${REDIS_PASSWORD}@redis:6380
```

### Cache Architecture

#### Key Patterns

```python
# Node cache
t:{tenant_id}:node:{node_id}                    # TTL: 120s
t:{tenant_id}:edges:out:{node_id}               # TTL: 120s
t:{tenant_id}:edges:in:{node_id}                # TTL: 120s
t:{tenant_id}:graph:recent:{window_minutes}     # TTL: 60s

# Glyph cache
t:{tenant_id}:glyphs:time:{start}:{end}         # TTL: 30s
t:{tenant_id}:glyphs:type:{type}                # TTL: 60s

# Embeddings cache
emb:{model}:{obj_type}:{obj_id}                 # TTL: 3600s

# API rate limiting
ratelimit:{tenant_id}:{endpoint}                # TTL: 60s
```

#### Python Client Setup

```python
import redis.asyncio as redis
from typing import Optional
import json

class CacheService:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url, decode_responses=True)
    
    async def get_node(self, tenant_id: str, node_id: str) -> Optional[dict]:
        key = f"t:{tenant_id}:node:{node_id}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
    
    async def set_node(self, tenant_id: str, node_id: str, data: dict, ttl: int = 120):
        key = f"t:{tenant_id}:node:{node_id}"
        await self.redis.setex(key, ttl, json.dumps(data))
    
    async def invalidate_graph(self, tenant_id: str):
        pattern = f"t:{tenant_id}:graph:*"
        async for key in self.redis.scan_iter(match=pattern):
            await self.redis.delete(key)
```

---

## 3. Apache Kafka for Event Streaming

### Installation

**Using Strimzi Operator (Kubernetes):**
```bash
# Install Strimzi operator
kubectl create namespace kafka
kubectl apply -f 'https://strimzi.io/install/latest?namespace=kafka' -n kafka

# Deploy Kafka cluster
kubectl apply -f - <<EOF
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: glyph-foundry
  namespace: kafka
spec:
  kafka:
    version: 3.5.0
    replicas: 3
    listeners:
      - name: tls
        port: 9093
        type: internal
        tls: true
        authentication:
          type: scram-sha-512
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      log.retention.hours: 168
    storage:
      type: persistent-claim
      size: 100Gi
      class: do-block-storage
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
      class: do-block-storage
  entityOperator:
    topicOperator: {}
    userOperator: {}
EOF
```

**Self-Hosted (Docker Compose with Redpanda + Security):**
```yaml
redpanda:
  image: vectorized/redpanda:v23.2.8  # Pinned version
  command:
    - redpanda
    - start
    - --smp 2
    - --memory 4G
    - --reserve-memory 1G
    - --overprovisioned
    - --node-id 0
    - --kafka-addr SSL://0.0.0.0:9093
    - --advertise-kafka-addr SSL://redpanda:9093
    - --pandaproxy-addr 0.0.0.0:8082
  ports:
    - "9093:9093"
    - "9644:9644"
    - "8082:8082"
  volumes:
    - ./redpanda-config.yaml:/etc/redpanda/redpanda.yaml
    - ./tls:/etc/redpanda/tls:ro
    - redpanda-data:/var/lib/redpanda/data

# redpanda-config.yaml with SASL/TLS:
# kafka_api:
#   - address: 0.0.0.0
#     port: 9093
#     name: external
#     authentication_method: sasl
# kafka_api_tls:
#   - enabled: true
#     cert_file: /etc/redpanda/tls/server.crt
#     key_file: /etc/redpanda/tls/server.key
#     truststore_file: /etc/redpanda/tls/ca.crt
```

### Kafka Security (SASL/TLS Configuration)

**Create SASL Users:**
```bash
# For Kafka (using Strimzi)
kubectl apply -f - <<EOF
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaUser
metadata:
  name: glyph-producer
  namespace: kafka
  labels:
    strimzi.io/cluster: glyph-foundry
spec:
  authentication:
    type: scram-sha-512
  authorization:
    type: simple
    acls:
    - resource:
        type: topic
        name: kg.
        patternType: prefix
      operation: Write
    - resource:
        type: topic
        name: kg.
        patternType: prefix
      operation: Describe
EOF

kubectl apply -f - <<EOF
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaUser
metadata:
  name: glyph-consumer
  namespace: kafka
  labels:
    strimzi.io/cluster: glyph-foundry
spec:
  authentication:
    type: scram-sha-512
  authorization:
    type: simple
    acls:
    - resource:
        type: topic
        name: kg.
        patternType: prefix
      operation: Read
    - resource:
        type: topic
        name: kg.
        patternType: prefix
      operation: Describe
    - resource:
        type: group
        name: node-processor
        patternType: literal
      operation: Read
EOF

# Extract credentials
kubectl get secret glyph-producer -n kafka -o jsonpath='{.data.password}' | base64 -d
kubectl get secret glyph-consumer -n kafka -o jsonpath='{.data.password}' | base64 -d
```

**For Redpanda (Self-Hosted):**
```bash
# Create SASL user
rpk security user create glyph-producer \
  --password ${PRODUCER_PASSWORD} \
  --api-urls localhost:9644

rpk security user create glyph-consumer \
  --password ${CONSUMER_PASSWORD} \
  --api-urls localhost:9644

# Create ACLs
rpk security acl create \
  --allow-principal User:glyph-producer \
  --operation write,describe \
  --topic "kg.*" \
  --api-urls localhost:9644

rpk security acl create \
  --allow-principal User:glyph-consumer \
  --operation read,describe \
  --topic "kg.*" \
  --group "node-processor" \
  --api-urls localhost:9644
```

### Topic Configuration

```bash
# Create topics with proper partitioning
kafka-topics.sh --create --topic kg.nodes.v1 \
  --partitions 12 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config compression.type=lz4 \
  --bootstrap-server localhost:9092

kafka-topics.sh --create --topic kg.edges.v1 \
  --partitions 12 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --bootstrap-server localhost:9092

kafka-topics.sh --create --topic kg.events.v1 \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --bootstrap-server localhost:9092

kafka-topics.sh --create --topic embeddings.v1 \
  --partitions 8 \
  --replication-factor 3 \
  --config retention.ms=2592000000 \
  --bootstrap-server localhost:9092

kafka-topics.sh --create --topic glyphs.v1 \
  --partitions 16 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --bootstrap-server localhost:9092

kafka-topics.sh --create --topic audit.v1 \
  --partitions 4 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config retention.ms=7776000000 \
  --bootstrap-server localhost:9092
```

### Python Kafka Producer

```python
from aiokafka import AIOKafkaProducer
import json

class EventPublisher:
    def __init__(self, bootstrap_servers: str):
        self.producer = AIOKafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type='lz4'
        )
    
    async def start(self):
        await self.producer.start()
    
    async def publish_node_event(self, tenant_id: str, node: dict):
        await self.producer.send_and_wait(
            topic='kg.nodes.v1',
            key=tenant_id.encode('utf-8'),
            value=node
        )
    
    async def publish_glyph_event(self, tenant_id: str, glyph: dict):
        await self.producer.send_and_wait(
            topic='glyphs.v1',
            key=tenant_id.encode('utf-8'),
            value=glyph
        )
```

---

## 4. MinIO for Object Storage (S3-Compatible)

### Installation

**Digital Ocean Spaces (Managed S3):**
```bash
# Create Spaces bucket
doctl compute spaces bucket create \
  kg-exports-prod \
  --region nyc3

doctl compute spaces bucket create \
  kg-artifacts-prod \
  --region nyc3
```

**Self-Hosted MinIO (Docker Compose with Security):**
```yaml
minio:
  image: minio/minio:RELEASE.2023-09-30T07-02-29Z  # Pinned version
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    MINIO_SERVER_URL: https://minio.yourdomain.com
    MINIO_BROWSER_REDIRECT_URL: https://console.minio.yourdomain.com
  command: server /data --console-address ":9001" --certs-dir /certs
  volumes:
    - minio-data:/data
    - ./certs:/certs:ro  # TLS certificates
  healthcheck:
    test: ["CMD", "curl", "-f", "https://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3

# Distributed mode (4+ nodes recommended for production):
minio1:
  image: minio/minio:RELEASE.2023-09-30T07-02-29Z
  command: server https://minio{1...4}/data --console-address ":9001" --certs-dir /certs
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    MINIO_DISTRIBUTED_MODE_ENABLED: "yes"
    MINIO_DISTRIBUTED_NODES: "https://minio{1...4}/data"
```

### Bucket Configuration

```python
from minio import Minio
from minio.lifecycleconfig import LifecycleConfig, Rule, Expiration

# Initialize MinIO client
minio_client = Minio(
    "s3.nyc3.digitaloceanspaces.com",
    access_key=os.getenv("SPACES_ACCESS_KEY"),
    secret_key=os.getenv("SPACES_SECRET_KEY"),
    secure=True
)

# Create buckets
for bucket in ["kg-exports-prod", "kg-artifacts-prod"]:
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)
        
        # Set lifecycle policy (expire old exports after 30 days)
        config = LifecycleConfig([
            Rule(
                rule_id="expire-old-exports",
                status="Enabled",
                expiration=Expiration(days=30)
            )
        ])
        minio_client.set_bucket_lifecycle(bucket, config)
```

### Tenant-Scoped Storage

```python
class S3StorageService:
    def __init__(self, client: Minio):
        self.client = client
    
    async def upload_export(self, tenant_id: str, export_id: str, data: bytes):
        object_name = f"tenants/{tenant_id}/exports/{export_id}.json"
        self.client.put_object(
            "kg-exports-prod",
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type="application/json"
        )
        
        # Generate presigned URL (valid for 1 hour)
        url = self.client.presigned_get_object(
            "kg-exports-prod",
            object_name,
            expires=timedelta(hours=1)
        )
        return url
```

---

## 5. Kubernetes Deployment

### Secrets Management

**Create Kubernetes Secrets:**
```bash
# PostgreSQL credentials
kubectl create secret generic postgres-secret \
  --from-literal=url="postgresql://user:pass@host:5432/db" \
  -n glyph-foundry

# Redis credentials
kubectl create secret generic redis-secret \
  --from-literal=url="redis://:password@redis:6379/0" \
  --from-literal=password="${REDIS_PASSWORD}" \
  -n glyph-foundry

# MinIO/S3 credentials
kubectl create secret generic minio-secret \
  --from-literal=access-key="${MINIO_ACCESS_KEY}" \
  --from-literal=secret-key="${MINIO_SECRET_KEY}" \
  -n glyph-foundry

# API keys (for service-to-service auth)
kubectl create secret generic api-keys \
  --from-literal=internal-api-key="${INTERNAL_API_KEY}" \
  -n glyph-foundry
```

**Using Sealed Secrets (Recommended):**
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.23.0/controller.yaml

# Create a sealed secret
echo -n "postgresql://..." | kubectl create secret generic postgres-secret \
  --dry-run=client --from-file=url=/dev/stdin -o yaml | \
  kubeseal -o yaml > postgres-sealed-secret.yaml

kubectl apply -f postgres-sealed-secret.yaml -n glyph-foundry
```

### Namespace & Network Policies

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: glyph-foundry
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: glyph-foundry
spec:
  podSelector:
    matchLabels:
      app: glyph-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    - podSelector:
        matchLabels:
          app: redis
    - podSelector:
        matchLabels:
          app: kafka
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379
    - protocol: TCP
      port: 9092
```

### API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: glyph-api
  namespace: glyph-foundry
spec:
  replicas: 3
  selector:
    matchLabels:
      app: glyph-api
  template:
    metadata:
      labels:
        app: glyph-api
    spec:
      containers:
      - name: api
        image: ghcr.io/your-org/glyph-foundry-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: KAFKA_BOOTSTRAP_SERVERS
          value: "glyph-foundry-kafka-bootstrap.kafka:9092"
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: glyph-api
  namespace: glyph-foundry
spec:
  selector:
    app: glyph-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: glyph-api-hpa
  namespace: glyph-foundry
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: glyph-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Workers Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: glyph-workers
  namespace: glyph-foundry
spec:
  replicas: 5
  selector:
    matchLabels:
      app: glyph-workers
  template:
    metadata:
      labels:
        app: glyph-workers
    spec:
      containers:
      - name: nlp-worker
        image: ghcr.io/your-org/glyph-foundry-workers:latest
        command: ["python", "-m", "app.nlp_extract"]
        env:
        - name: KAFKA_BOOTSTRAP_SERVERS
          value: "glyph-foundry-kafka-bootstrap.kafka:9092"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            cpu: "1000m"
            memory: "2Gi"
          limits:
            cpu: "4000m"
            memory: "8Gi"
```

### Metrics Collector Deployment (Go)

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: glyph-metrics-collector
  namespace: glyph-foundry
spec:
  selector:
    matchLabels:
      app: metrics-collector
  template:
    metadata:
      labels:
        app: metrics-collector
    spec:
      containers:
      - name: collector
        image: ghcr.io/your-org/glyph-metrics-collector:latest
        env:
        - name: GLYPH_API_URL
          value: "http://glyph-api.glyph-foundry.svc.cluster.local"
        - name: TENANT_ID
          value: "metrics-collector"
        - name: COLLECTION_INTERVAL
          value: "2s"
        - name: MAX_METRICS_PER_BATCH
          value: "50"
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: glyph-foundry-ingress
  namespace: glyph-foundry
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.glyph-foundry.com
    secretName: glyph-foundry-tls
  rules:
  - host: api.glyph-foundry.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: glyph-api
            port:
              number: 80
```

---

## 6. Monitoring & Observability

### Prometheus & Grafana

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: glyph-foundry
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'glyph-api'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
          - glyph-foundry
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: glyph-api
    - job_name: 'kafka'
      static_configs:
      - targets: ['glyph-foundry-kafka-bootstrap.kafka:9092']
```

---

## 7. Performance Tuning

### Database Connection Pooling

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo_pool=True
)
```

### Redis Sentinel for HA

```yaml
redis-sentinel:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
  volumes:
  - ./sentinel.conf:/etc/redis/sentinel.conf
```

### Kafka Consumer Optimization

```python
consumer = AIOKafkaConsumer(
    'kg.nodes.v1',
    bootstrap_servers=KAFKA_SERVERS,
    group_id='node-processor',
    auto_offset_reset='earliest',
    max_poll_records=500,
    max_poll_interval_ms=300000,
    session_timeout_ms=60000,
    fetch_max_bytes=52428800  # 50MB
)
```

---

## 8. Deployment Checklist

- [ ] PostgreSQL with pgvector deployed and configured
- [ ] Schema applied: `backend/sql/03-production-schema.sql`
- [ ] Redis cluster deployed with proper persistence
- [ ] Kafka cluster with all topics created
- [ ] MinIO/S3 buckets configured with lifecycle policies
- [ ] Kubernetes namespace and network policies created
- [ ] API deployment with HPA configured
- [ ] Workers deployed with proper resource limits
- [ ] Metrics collector DaemonSet running
- [ ] Ingress and TLS certificates configured
- [ ] Monitoring stack (Prometheus/Grafana) deployed
- [ ] Secrets properly configured in Kubernetes
- [ ] Backup strategy implemented for PostgreSQL
- [ ] Disaster recovery plan documented

---

## Support & Troubleshooting

### Common Issues

**Vector Index Build Slow:**
```sql
-- Increase maintenance_work_mem during index build
SET maintenance_work_mem = '2GB';
CREATE INDEX CONCURRENTLY nodes_v2_emb384_hnsw_idx ON nodes_v2 USING hnsw (embedding_384 vector_cosine_ops);
```

**Kafka Consumer Lag:**
```bash
# Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group node-processor
```

**Redis Memory Issues:**
```bash
# Check memory stats
redis-cli info memory
redis-cli --bigkeys
```

For production support, refer to the operational runbooks in `/docs/runbooks/`.
