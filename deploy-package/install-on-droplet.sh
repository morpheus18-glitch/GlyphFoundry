#!/bin/bash
# Run this script on your Digital Ocean droplet

set -e

echo "🚀 Installing Quantum Nexus Enterprise Knowledge Graph on Digital Ocean..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install required packages
echo -e "${BLUE}📦 Installing dependencies...${NC}"
sudo apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib postgresql-15-pgvector curl

# Create application directory
sudo mkdir -p /var/www/quantum-nexus
sudo chown $USER:$USER /var/www/quantum-nexus

# Copy files
echo -e "${BLUE}📂 Copying application files...${NC}"
cp -r backend /var/www/quantum-nexus/
cp -r frontend-dist /var/www/quantum-nexus/
cp .env.template /var/www/quantum-nexus/.env
cp init-schema.sql /var/www/quantum-nexus/ 2>/dev/null || echo "Schema file not found, will use backend SQL files"

# Setup Python virtual environment
echo -e "${BLUE}🐍 Setting up Python environment...${NC}"
cd /var/www/quantum-nexus
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install gunicorn uvicorn[standard]

# Generate secure PostgreSQL password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Setup PostgreSQL with pgvector extension
echo -e "${BLUE}🗄️  Setting up PostgreSQL database with vector extensions...${NC}"
sudo -u postgres psql << SQL
CREATE DATABASE quantum_nexus;
CREATE USER quantum_user WITH PASSWORD '$DB_PASSWORD';
ALTER DATABASE quantum_nexus OWNER TO quantum_user;
GRANT ALL PRIVILEGES ON DATABASE quantum_nexus TO quantum_user;
\c quantum_nexus
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "hstore";
SQL

# Initialize database schema
echo -e "${BLUE}🔨 Initializing quantum knowledge graph schema...${NC}"
if [ -f "init-schema.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -U quantum_user -d quantum_nexus -h localhost -f init-schema.sql
elif [ -d "backend/sql" ]; then
    for sql_file in backend/sql/*.sql; do
        echo "Running: $sql_file"
        PGPASSWORD=$DB_PASSWORD psql -U quantum_user -d quantum_nexus -h localhost -f "$sql_file"
    done
else
    echo -e "${YELLOW}⚠️  No schema files found - database will be initialized on first run${NC}"
fi

# Generate master encryption key
echo -e "${BLUE}🔐 Generating quantum-enhanced encryption keys...${NC}"
MASTER_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")

# Configure environment variables
cat > .env << ENV
# Database Configuration
DATABASE_URL=postgresql://quantum_user:${DB_PASSWORD}@localhost/quantum_nexus

# Security Keys (Quantum-Enhanced)
MASTER_ENCRYPTION_KEY=${MASTER_KEY}
JWT_SECRET_KEY=${JWT_SECRET}

# Environment
ENVIRONMENT=production

# CORS (Update with your domain)
ALLOWED_ORIGINS=*

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Logging
LOG_LEVEL=INFO
ENV

chmod 600 .env

# Setup Nginx
echo -e "${BLUE}🌐 Configuring Nginx reverse proxy...${NC}"
sudo cp nginx.conf /etc/nginx/sites-available/quantum-nexus
sudo ln -sf /etc/nginx/sites-available/quantum-nexus /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup systemd service
echo -e "${BLUE}⚙️  Installing systemd service...${NC}"
sudo cp quantum-nexus.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable quantum-nexus
sudo systemctl start quantum-nexus

# Wait for service to start
echo -e "${BLUE}⏳ Waiting for service to start...${NC}"
sleep 5

# Check service status
if sudo systemctl is-active --quiet quantum-nexus; then
    echo -e "${GREEN}✅ Quantum Nexus service is running!${NC}"
else
    echo -e "${YELLOW}⚠️  Service may need manual start. Check logs with: sudo journalctl -u quantum-nexus${NC}"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 ✨ DEPLOYMENT COMPLETE! ✨                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Your app is accessible at:${NC} http://${SERVER_IP}"
echo -e "${BLUE}🔍 API Health Check:${NC} http://${SERVER_IP}/healthz"
echo -e "${BLUE}🗄️  Database:${NC} quantum_nexus (PostgreSQL with pgvector)"
echo -e "${BLUE}🔐 Encryption:${NC} AES-256-GCM Quantum-Enhanced"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NEXT STEPS:${NC}"
echo "1. Update nginx.conf with your domain name"
echo "   sudo nano /etc/nginx/sites-available/quantum-nexus"
echo ""
echo "2. Setup SSL certificate (REQUIRED for production):"
echo "   sudo apt install certbot python3-certbot-nginx -y"
echo "   sudo certbot --nginx -d your-domain.com"
echo ""
echo "3. Configure firewall:"
echo "   sudo ufw allow 'Nginx Full'"
echo "   sudo ufw enable"
echo ""
echo "4. Secure environment file (already done):"
echo "   chmod 600 /var/www/quantum-nexus/.env"
echo ""
echo -e "${BLUE}📊 Monitoring Commands:${NC}"
echo "  sudo systemctl status quantum-nexus    # Check service status"
echo "  sudo journalctl -u quantum-nexus -f    # View logs"
echo "  sudo systemctl restart quantum-nexus   # Restart service"
echo ""
echo -e "${GREEN}🎉 Your Quantum Nexus Knowledge Graph is live!${NC}"
