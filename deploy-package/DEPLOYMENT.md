# Quantum Nexus - Digital Ocean Deployment Guide

## Prerequisites

- Digital Ocean Droplet (Ubuntu 22.04 LTS recommended)
- SSH access to your droplet
- Domain name (optional but recommended for SSL)

## Deployment Steps

### 1. Transfer Files to Droplet

```bash
# From your local machine (or download from Replit as zip)
scp -r deploy-package root@your-droplet-ip:/tmp/quantum-nexus
```

### 2. Install on Droplet

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Navigate to deployment directory
cd /tmp/quantum-nexus

# Run installation script
chmod +x install-on-droplet.sh
./install-on-droplet.sh
```

### 3. Configure Environment Variables

Edit `/var/www/quantum-nexus/.env` with your production values:

```bash
sudo nano /var/www/quantum-nexus/.env
```

Required variables:
- `MASTER_ENCRYPTION_KEY` (auto-generated)
- `DATABASE_URL` (PostgreSQL connection string)
- `ENVIRONMENT=production`

### 4. Setup SSL (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 5. Verify Deployment

```bash
# Check service status
sudo systemctl status quantum-nexus

# View logs
sudo journalctl -u quantum-nexus -f

# Test API
curl http://localhost:8000/healthz
```

## Architecture

- **Frontend**: Static files served by Nginx from `/var/www/quantum-nexus/frontend-dist`
- **Backend**: FastAPI with Gunicorn on port 8000
- **Database**: PostgreSQL with enterprise security
- **Reverse Proxy**: Nginx handles routing and SSL termination

## Security Features

✅ Multi-tenant row-level security
✅ Quantum-enhanced encryption with AES-256-GCM
✅ Fail-closed security behavior
✅ Comprehensive audit logging
✅ JWT authentication with tenant-specific signing

## Monitoring

```bash
# View application logs
sudo journalctl -u quantum-nexus -f

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Monitor system resources
htop
```

## Scaling Options

- **Horizontal Scaling**: Deploy multiple backend instances behind a load balancer
- **Database Scaling**: Use PostgreSQL read replicas for read-heavy workloads
- **CDN**: Use CloudFlare or DigitalOcean CDN for frontend assets

## Support

For issues or questions, refer to the main project documentation.
