# Glyph Foundry - Production Deployment Guide

## Infrastructure Overview

### Services
- **Edge (Nginx)**: Reverse proxy with SSL termination (ports 80, 443)
- **Backend (FastAPI)**: Python API server (port 8000)
- **Frontend (React/Vite)**: Static SPA served by Nginx (port 8080)
- **PostgreSQL**: Database with pgvector extension (port 5432)
- **Redpanda**: Kafka-compatible message broker (port 19092)
- **MinIO**: S3-compatible object storage (ports 9000, 9001)
- **Workers**: 6 background workers for NLP/graph processing

### Network Architecture
```
Internet → Nginx (443) → Backend API (8000)
                       → Frontend (8080)
```

## Deployment Steps

### 1. Initial Setup on Droplet (170.107.47.251)

```bash
# SSH to droplet
ssh root@170.107.47.251

# Clone repository
cd /root
git clone <your-repo-url> glyph-foundry
cd glyph-foundry

# Run deployment script
sudo ./deploy.sh
```

The deploy script will:
- Install Docker and dependencies
- Setup SSL certificates via Let's Encrypt
- Build all Docker images
- Start all services
- Configure auto-renewal for SSL

### 2. Manual Deployment (if needed)

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose down
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Health Checks

```bash
# Run comprehensive health check
./healthcheck.sh

# Or check manually
curl https://fitwellfast.com/healthz
curl https://fitwellfast.com/api/v1/overview
curl https://fitwellfast.com/graph3d/data?window_minutes=60
```

## Configuration Files

### Nginx Configuration
- **Main config**: `edge/nginx.conf` - Worker and performance settings
- **Site config**: `edge/conf.d/nginx.conf` - Routing and upstream configuration
- **Security**: `edge/conf.d/security.conf` - Rate limiting and SSL settings
- **Block probes**: `edge/conf.d/block-probes.inc` - Security filters

### Docker Configuration
- **Base**: `docker-compose.yml` - Service definitions
- **Override**: `docker-compose.override.yml` - Production-specific settings
- **Backend Dockerfile**: `backend/Dockerfile` - Python API image
- **Frontend Dockerfile**: `frontend/Dockerfile` - React SPA image

## Key Features Configured

### ✅ WebSocket Support
- Vite HMR for development
- Real-time features for production
- Proper upgrade headers configured

### ✅ SSL/TLS
- Let's Encrypt certificates for fitwellfast.com
- Auto-renewal via cron job
- TLS 1.2 and 1.3 support

### ✅ API Routing
All backend paths properly routed:
- `/api/*` - Core API endpoints
- `/admin/*` - Admin dashboard
- `/files/*` - File upload/download
- `/accounts/*` - User management
- `/graph3d/*` - 3D graph data
- `/tags/*` - Tag management
- `/busz` - Bus endpoint
- `/messages` - Message ingestion
- `/produce/*` - Kafka producer
- `/pipeline/*` - Pipeline endpoints
- `/graph/*` - Graph endpoints

### ✅ Security
- Rate limiting (100 req/s for API, 200 req/s general)
- Connection limits (50 concurrent per IP)
- Content Security Policy (relaxed for React/WebGL)
- Security headers (X-Frame-Options, etc.)
- Block common exploit probes

### ✅ Performance
- Connection pooling (64 backend, 32 frontend)
- Gzip compression for all text content
- Static asset caching (1 day)
- Proper buffer sizes and timeouts
- HTTP/2 support

## Environment Variables

### Backend (.env or docker-compose override)
```bash
DATABASE_URL=postgresql+psycopg://gf_user:gf_pass@gf_postgres:5432/glyph_foundry
APP_ENV=production
CORS_ALLOW_ORIGINS=https://fitwellfast.com,https://www.fitwellfast.com
KAFKA_BROKERS=gf_redpanda:9092
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=admin
S3_SECRET_KEY=adminadmin
GUNICORN_WORKERS=4
GUNICORN_THREADS=4
```

## Troubleshooting

### 500 Errors
1. Check nginx logs: `docker-compose logs edge`
2. Check backend logs: `docker-compose logs backend`
3. Verify routing: `./healthcheck.sh`
4. Test backend directly: `docker exec gf_backend curl localhost:8000/healthz`

### SSL Certificate Issues
```bash
# Renew certificates manually
certbot renew --force-renewal
docker-compose restart edge
```

### Database Issues
```bash
# Check PostgreSQL
docker exec gf_postgres pg_isready -U gf_user -d glyph_foundry

# View database logs
docker-compose logs gf_postgres

# Access database
docker exec -it gf_postgres psql -U gf_user -d glyph_foundry
```

### Service Not Starting
```bash
# Check service status
docker-compose ps

# View specific service logs
docker-compose logs -f <service_name>

# Restart specific service
docker-compose restart <service_name>

# Force rebuild
docker-compose up -d --build --force-recreate <service_name>
```

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f edge
docker-compose logs -f gf_frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Maintenance

### Update Application
```bash
cd /root/glyph-foundry
git pull origin main
docker-compose build --no-cache
docker-compose down
docker-compose up -d
./healthcheck.sh
```

### Backup Database
```bash
# Backup
docker exec gf_postgres pg_dump -U gf_user glyph_foundry > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i gf_postgres psql -U gf_user glyph_foundry < backup_20250930.sql
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

## URLs

- **Production**: https://fitwellfast.com
- **Admin Dashboard**: https://fitwellfast.com/admin
- **API Docs**: https://fitwellfast.com/docs (if enabled)
- **Health Check**: https://fitwellfast.com/healthz
- **MinIO Console**: http://fitwellfast.com:9001 (if exposed)

## Support

For issues:
1. Run `./healthcheck.sh` for diagnostics
2. Check logs: `docker-compose logs -f`
3. Verify configs in `edge/conf.d/`
4. Review this deployment guide
