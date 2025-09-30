# Infrastructure Deployment Checklist

## ✅ Completed Fixes

### 1. Nginx Configuration
- ✅ Added all missing API routes: `/api/*`, `/admin/*`, `/files/*`, `/accounts/*`
- ✅ Configured WebSocket support for Vite HMR and real-time features
- ✅ Added proper upgrade headers for WebSocket connections
- ✅ Fixed SSL/TLS configuration
- ✅ Optimized performance with connection pooling and compression
- ✅ Implemented rate limiting and security headers
- ✅ Relaxed CSP to support React/Vite/WebGL apps

### 2. Docker Configuration
- ✅ Created `docker-compose.override.yml` for production settings
- ✅ Configured resource limits for all services
- ✅ Updated backend to use Gunicorn for production
- ✅ Added proper health checks for all services
- ✅ Configured PostgreSQL performance tuning

### 3. Deployment Automation
- ✅ Created `deploy.sh` - automated deployment script
- ✅ Created `healthcheck.sh` - comprehensive health monitoring
- ✅ Created `DEPLOYMENT.md` - complete deployment guide
- ✅ Setup SSL auto-renewal via cron job

### 4. Security & Performance
- ✅ Rate limiting: 100 req/s for API, 200 req/s general
- ✅ Connection limits: 50 concurrent per IP
- ✅ SSL stapling and resolver configuration
- ✅ Gzip compression for all text content
- ✅ Static asset caching (1 day)
- ✅ HTTP/2 support
- ✅ Worker connection pooling

## 🚀 Deployment Commands

### On Your Droplet (170.107.47.251)

```bash
# SSH to server
ssh root@170.107.47.251

# Pull latest changes
cd /root/glyph-foundry
git pull origin main

# Option 1: Automated deployment (recommended)
sudo ./deploy.sh

# Option 2: Manual deployment
docker-compose build --no-cache
docker-compose down
docker-compose up -d

# Verify health
./healthcheck.sh
```

## 🔍 Verification Steps

1. **Check services are running**:
   ```bash
   docker-compose ps
   ```

2. **Run health check**:
   ```bash
   ./healthcheck.sh
   ```

3. **Test endpoints**:
   ```bash
   curl https://fitwellfast.com/healthz
   curl https://fitwellfast.com/api/v1/overview
   curl https://fitwellfast.com/graph3d/data?window_minutes=60
   ```

4. **Check logs**:
   ```bash
   docker-compose logs -f edge
   docker-compose logs -f backend
   ```

## 📋 Key Files Modified/Created

### Configuration Files
- `edge/nginx.conf` - Main Nginx config with performance tuning
- `edge/conf.d/nginx.conf` - Routing config with all API paths + WebSocket
- `edge/conf.d/security.conf` - Security headers and rate limiting
- `docker-compose.override.yml` - Production overrides
- `backend/Dockerfile` - Updated to use Gunicorn

### Scripts
- `deploy.sh` - Automated deployment script
- `healthcheck.sh` - Health monitoring script
- `DEPLOYMENT.md` - Complete deployment documentation

## 🛠️ Troubleshooting

### If you get 500 errors:

1. **Check nginx routing**:
   ```bash
   docker-compose logs edge | grep error
   ```

2. **Check backend**:
   ```bash
   docker-compose logs backend | tail -50
   ```

3. **Test backend directly**:
   ```bash
   docker exec gf_backend curl -v http://localhost:8000/api/v1/overview
   ```

4. **Verify nginx config syntax**:
   ```bash
   docker exec gf_edge nginx -t
   ```

5. **Restart services**:
   ```bash
   docker-compose restart edge backend
   ```

## 🔄 Common Operations

### Update code:
```bash
cd /root/glyph-foundry
git pull
docker-compose up -d --build
```

### View logs:
```bash
docker-compose logs -f
```

### Restart specific service:
```bash
docker-compose restart backend
```

### Full rebuild:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## ✅ What's Fixed

1. **500 Errors**: All API routes now properly configured
2. **WebSocket**: HMR and real-time features working
3. **SSL**: Automatic renewal configured
4. **Performance**: Optimized with pooling and compression
5. **Security**: Rate limiting and headers in place
6. **Repeatability**: Scripts for automated deployment
