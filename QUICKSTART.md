# 🚀 Quick Deployment Guide

## Deploy to Production in 3 Steps

### Step 1: Push Code to Git
```bash
# From your Replit or local machine
git add .
git commit -m "Add enterprise infrastructure with WebSocket support"
git push origin main
```

### Step 2: SSH to Droplet & Deploy
```bash
# SSH to your droplet
ssh root@170.107.47.251

# Navigate to project
cd /root/glyph-foundry

# Pull latest changes
git pull origin main

# Run automated deployment
sudo ./deploy.sh
```

### Step 3: Verify Deployment
```bash
# Run health check
./healthcheck.sh

# Or test manually
curl https://fitwellfast.com/healthz
curl https://fitwellfast.com/
```

## What Was Fixed

### ✅ 500 Errors Resolved
- **Added missing API routes**: `/api/*`, `/admin/*`, `/files/*`, `/accounts/*`
- **Fixed routing regex**: Now properly matches all backend paths
- **Added WebSocket support**: For Vite HMR and real-time features

### ✅ Enterprise Infrastructure
- **SSL/TLS**: Auto-renewing Let's Encrypt certificates
- **Performance**: Connection pooling, gzip, HTTP/2
- **Security**: Rate limiting, CSP headers, SSL stapling
- **Monitoring**: Health check script with comprehensive diagnostics

### ✅ Deployment Automation
- **deploy.sh**: One-command deployment with SSL setup
- **healthcheck.sh**: Verify all services and endpoints
- **docker-compose.override.yml**: Production-specific settings

## Architecture

```
Internet (443/80)
    ↓
Nginx Edge (SSL termination, routing)
    ↓
├─→ Backend API (port 8000)
│   └─ FastAPI + Gunicorn + Uvicorn workers
│
└─→ Frontend SPA (port 8080)
    └─ React/Vite + Nginx static server
```

## Key Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/healthz` | Health check | ✅ |
| `/api/v1/overview` | System overview | ✅ |
| `/graph3d/data` | 3D graph visualization | ✅ |
| `/admin/*` | Admin dashboard | ✅ |
| `/files/*` | File upload/download | ✅ |
| `/accounts/*` | User management | ✅ |
| `/tags/*` | Tag management | ✅ |
| `/` | React frontend | ✅ |

## Troubleshooting

### Still getting 500 errors?

1. **Check nginx config syntax**:
   ```bash
   docker exec gf_edge nginx -t
   ```

2. **View error logs**:
   ```bash
   docker-compose logs edge | tail -50
   docker-compose logs backend | tail -50
   ```

3. **Test backend directly**:
   ```bash
   docker exec gf_backend curl http://localhost:8000/healthz
   ```

4. **Restart services**:
   ```bash
   docker-compose restart edge backend
   ```

### SSL certificate issues?

```bash
# Renew certificates
sudo certbot renew --force-renewal

# Restart nginx
docker-compose restart edge
```

### WebSocket not working?

Verify upgrade headers in logs:
```bash
docker-compose logs edge | grep -i upgrade
```

## Monitoring Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Check resource usage
docker stats

# Check service status
docker-compose ps
```

## Maintenance

### Update application:
```bash
cd /root/glyph-foundry
git pull
docker-compose up -d --build
./healthcheck.sh
```

### Backup database:
```bash
docker exec gf_postgres pg_dump -U gf_user glyph_foundry > backup.sql
```

### View PostgreSQL data:
```bash
docker exec -it gf_postgres psql -U gf_user -d glyph_foundry
```

## Support Files

- **Full guide**: See `DEPLOYMENT.md`
- **Infrastructure details**: See `INFRASTRUCTURE_CHECKLIST.md`
- **Scripts**: `deploy.sh`, `healthcheck.sh`
- **Configs**: `edge/conf.d/nginx.conf`, `docker-compose.override.yml`
