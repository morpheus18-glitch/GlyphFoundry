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
