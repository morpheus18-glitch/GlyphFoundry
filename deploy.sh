#!/bin/bash
# Enterprise deployment script for fitwellfast.com
# Run this on your droplet: chmod +x deploy.sh && sudo ./deploy.sh

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

# Detect docker compose command (v1 vs v2)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose not found"
    exit 1
fi
echo "Using: $DOCKER_COMPOSE"

# Step 1: Install dependencies
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y docker.io certbot python3-certbot-nginx git curl

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
    $DOCKER_COMPOSE down edge 2>/dev/null || true
    
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
$DOCKER_COMPOSE build --no-cache

# Step 6: Stop old containers
echo "🛑 Stopping old containers..."
$DOCKER_COMPOSE down

# Step 7: Start services
echo "▶️  Starting services..."
$DOCKER_COMPOSE up -d

# Step 8: Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check backend health
if curl -sf http://localhost:8000/healthz > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    $DOCKER_COMPOSE logs backend
    exit 1
fi

# Step 9: Setup auto-renewal for SSL
echo "🔄 Setting up SSL auto-renewal..."
COMPOSE_CMD=$(echo "$DOCKER_COMPOSE" | sed 's/ /%20/g')
cat > /etc/cron.d/certbot-renewal << EOF
0 3 * * * root certbot renew --quiet --deploy-hook "cd $PROJECT_DIR && $DOCKER_COMPOSE restart edge"
EOF

# Step 10: Display status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE ps
echo ""
echo "🌐 Your app is now live at:"
echo "   https://$DOMAIN"
echo ""
echo "📝 Useful commands:"
echo "   View logs:     $DOCKER_COMPOSE logs -f"
echo "   Restart:       $DOCKER_COMPOSE restart"
echo "   Stop:          $DOCKER_COMPOSE down"
echo "   Rebuild:       $DOCKER_COMPOSE up -d --build"
echo ""
echo "🔍 Check backend:  curl https://$DOMAIN/healthz"
echo "🔍 Check frontend: curl https://$DOMAIN/"
