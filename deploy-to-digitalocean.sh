#!/bin/bash
# Quantum Nexus - Digital Ocean Deployment Script
# This script prepares your app for deployment to a Digital Ocean droplet

set -e

echo "🚀 Preparing Quantum Nexus for Digital Ocean deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Build frontend
echo -e "${BLUE}📦 Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# Step 2: Create deployment package
echo -e "${BLUE}📦 Creating deployment package...${NC}"
mkdir -p deploy-package
cp -r backend deploy-package/
cp -r frontend/dist deploy-package/frontend-dist
cp package.json deploy-package/
cp .env.example deploy-package/.env.template 2>/dev/null || echo "# Environment Variables" > deploy-package/.env.template

# Step 3: Create deployment configuration files
echo -e "${BLUE}📝 Creating deployment configs...${NC}"

# Nginx configuration
cat > deploy-package/nginx.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Frontend static files
    location / {
        root /var/www/quantum-nexus/frontend-dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Graph endpoints
    location /graph3d {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /healthz {
        proxy_pass http://localhost:8000;
    }
}
EOF

# Systemd service file
cat > deploy-package/quantum-nexus.service << 'EOF'
[Unit]
Description=Quantum Nexus Enterprise Knowledge Graph
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/quantum-nexus
Environment="PATH=/var/www/quantum-nexus/venv/bin"
EnvironmentFile=/var/www/quantum-nexus/.env
ExecStart=/var/www/quantum-nexus/venv/bin/gunicorn --bind 0.0.0.0:8000 --workers 4 --worker-class uvicorn.workers.UvicornWorker --timeout 120 --keep-alive 2 backend.app.main:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Deployment script for the droplet
cat > deploy-package/install-on-droplet.sh << 'EOF'
#!/bin/bash
# Run this script on your Digital Ocean droplet

set -e

echo "🚀 Installing Quantum Nexus on Digital Ocean..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib

# Create application directory
sudo mkdir -p /var/www/quantum-nexus
sudo chown $USER:$USER /var/www/quantum-nexus

# Copy files
cp -r backend /var/www/quantum-nexus/
cp -r frontend-dist /var/www/quantum-nexus/
cp .env.template /var/www/quantum-nexus/.env

# Setup Python virtual environment
cd /var/www/quantum-nexus
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install gunicorn

# Setup PostgreSQL
echo "Setting up PostgreSQL database..."
sudo -u postgres psql << SQL
CREATE DATABASE quantum_nexus;
CREATE USER quantum_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE quantum_nexus TO quantum_user;
SQL

# Generate master encryption key
MASTER_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
echo "MASTER_ENCRYPTION_KEY=$MASTER_KEY" >> .env
echo "DATABASE_URL=postgresql://quantum_user:your_secure_password_here@localhost/quantum_nexus" >> .env
echo "ENVIRONMENT=production" >> .env

# Setup Nginx
sudo cp nginx.conf /etc/nginx/sites-available/quantum-nexus
sudo ln -sf /etc/nginx/sites-available/quantum-nexus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup systemd service
sudo cp quantum-nexus.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable quantum-nexus
sudo systemctl start quantum-nexus

echo "✅ Deployment complete!"
echo "🔑 Master encryption key has been generated and saved to .env"
echo "🌐 Your app should be accessible at http://$(curl -s ifconfig.me)"
echo ""
echo "⚠️  Important next steps:"
echo "1. Update nginx.conf with your domain name"
echo "2. Setup SSL with: sudo certbot --nginx -d your-domain.com"
echo "3. Review and secure the .env file with proper credentials"
echo "4. Run database migrations if needed"
EOF

chmod +x deploy-package/install-on-droplet.sh

# Create deployment README
cat > deploy-package/DEPLOYMENT.md << 'EOF'
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
EOF

echo -e "${GREEN}✅ Deployment package created successfully!${NC}"
echo ""
echo "📦 Package location: deploy-package/"
echo ""
echo "Next steps for Digital Ocean deployment:"
echo "1. Transfer 'deploy-package' folder to your droplet"
echo "2. Run 'install-on-droplet.sh' on your droplet"
echo "3. Follow instructions in DEPLOYMENT.md"
echo ""
echo "Or download from Replit:"
echo "1. Use 'Export as ZIP' in Replit (Files menu)"
echo "2. Upload to your droplet"
echo "3. Follow DEPLOYMENT.md instructions"
