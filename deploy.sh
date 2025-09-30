#!/bin/bash
# Enterprise deployment script for fitwellfast.com
# Run this on your droplet: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting Glyph Foundry deployment..."

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root or with sudo"
   exit 1
fi

# Configuration
DOMAIN="fitwellfast.com"
EMAIL="admin@fitwellfast.com"  # Change this to your email
PROJECT_DIR="/root/glyph-foundry"

# Step 1: Install dependencies
echo "📦 Installing system dependencies..."
apt-get update
apt-get install -y docker.io docker-compose certbot python3-certbot-nginx git curl

# Step 2: Enable and start Docker
echo "🐳 Configuring Docker..."
systemctl enable docker
systemctl start docker

# Step 3: Pull latest code
echo "📥 Pulling latest code..."
cd "$PROJECT_DIR" || exit 1
git pull origin main

# Step 4: Setup SSL certificates (if not exists)
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🔒 Setting up SSL certificates..."
    
    # Stop any running nginx
    docker-compose down edge 2>/dev/null || true
    
    # Run certbot in standalone mode
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    
    echo "✅ SSL certificates installed"
else
    echo "✅ SSL certificates already exist"
fi

# Step 5: Build images
echo "🔨 Building Docker images..."
docker-compose build --no-cache

# Step 6: Stop old containers
echo "🛑 Stopping old containers..."
docker-compose down

# Step 7: Start services
echo "▶️  Starting services..."
docker-compose up -d

# Step 8: Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check backend health
if curl -sf http://localhost:8000/healthz > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    docker-compose logs backend
    exit 1
fi

# Step 9: Setup auto-renewal for SSL
echo "🔄 Setting up SSL auto-renewal..."
cat > /etc/cron.d/certbot-renewal << 'EOF'
0 3 * * * root certbot renew --quiet --deploy-hook "docker-compose -f /root/glyph-foundry/docker-compose.yml restart edge"
EOF

# Step 10: Display status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""
echo "🌐 Your app is now live at:"
echo "   https://$DOMAIN"
echo ""
echo "📝 Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Restart:       docker-compose restart"
echo "   Stop:          docker-compose down"
echo "   Rebuild:       docker-compose up -d --build"
echo ""
echo "🔍 Check backend:  curl https://$DOMAIN/healthz"
echo "🔍 Check frontend: curl https://$DOMAIN/"
