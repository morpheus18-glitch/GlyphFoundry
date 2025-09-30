#!/bin/bash
# Health check script for Glyph Foundry infrastructure
# Run on droplet: ./healthcheck.sh

set -e

DOMAIN="${1:-fitwellfast.com}"
PROTOCOL="${2:-https}"

echo "🔍 Running health checks for $DOMAIN..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "  [$name] "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} ($response)"
        return 0
    else
        echo -e "${RED}✗${NC} (got $response, expected $expected_code)"
        return 1
    fi
}

# Function to check service
check_service() {
    local service=$1
    echo -n "  [$service] "
    
    if docker-compose ps | grep -q "$service.*Up"; then
        echo -e "${GREEN}✓${NC} Running"
        return 0
    else
        echo -e "${RED}✗${NC} Not running"
        return 1
    fi
}

# Check Docker services
echo "📦 Docker Services:"
check_service "gf_backend" || true
check_service "gf_frontend" || true
check_service "gf_edge" || true
check_service "gf_postgres" || true
check_service "gf_redpanda" || true
check_service "gf_minio" || true
echo ""

# Check SSL certificates
echo "🔒 SSL Certificates:"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo -e "  ${GREEN}✓${NC} Certificates exist for $DOMAIN"
    cert_expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo "    Expires: $cert_expiry"
else
    echo -e "  ${RED}✗${NC} No certificates found for $DOMAIN"
fi
echo ""

# Check HTTP endpoints
echo "🌐 HTTP Endpoints:"
check_endpoint "Health Check" "$PROTOCOL://$DOMAIN/healthz" 200 || true
check_endpoint "Frontend Root" "$PROTOCOL://$DOMAIN/" 200 || true
check_endpoint "Overview API" "$PROTOCOL://$DOMAIN/api/v1/overview" 200 || true
check_endpoint "Graph 3D API" "$PROTOCOL://$DOMAIN/graph3d/data?window_minutes=60" 200 || true
check_endpoint "Admin Dashboard" "$PROTOCOL://$DOMAIN/admin/status" 200 || true
check_endpoint "Tags Data" "$PROTOCOL://$DOMAIN/tags/data" 200 || true
echo ""

# Check internal services
echo "🔧 Internal Services:"
if docker exec gf_backend curl -sf http://localhost:8000/healthz > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Backend internal (port 8000)"
else
    echo -e "  ${RED}✗${NC} Backend internal (port 8000)"
fi

if docker exec gf_frontend curl -sf http://localhost:80/ > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Frontend internal (port 80)"
else
    echo -e "  ${RED}✗${NC} Frontend internal (port 80)"
fi
echo ""

# Check database
echo "💾 Database:"
if docker exec gf_postgres pg_isready -U gf_user -d glyph_foundry > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL ready"
    node_count=$(docker exec gf_postgres psql -U gf_user -d glyph_foundry -t -c "SELECT COUNT(*) FROM nodes;" 2>/dev/null | tr -d ' ')
    echo "    Nodes in database: $node_count"
else
    echo -e "  ${RED}✗${NC} PostgreSQL not ready"
fi
echo ""

# Check ports
echo "🔌 Port Bindings:"
for port in 80 443 8000 5432 9000 19092; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "  ${GREEN}✓${NC} Port $port is bound"
    else
        echo -e "  ${YELLOW}!${NC} Port $port is not bound"
    fi
done
echo ""

# Check logs for errors
echo "📋 Recent Errors in Logs:"
error_count=$(docker-compose logs --tail=100 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
if [ "$error_count" -gt 0 ]; then
    echo -e "  ${YELLOW}!${NC} Found $error_count error lines in recent logs"
    echo "    Run: docker-compose logs --tail=50 | grep -i error"
else
    echo -e "  ${GREEN}✓${NC} No errors in recent logs"
fi
echo ""

echo "✅ Health check complete!"
echo ""
echo "📊 Quick commands:"
echo "  View all logs:      docker-compose logs -f"
echo "  View backend logs:  docker-compose logs -f backend"
echo "  View edge logs:     docker-compose logs -f edge"
echo "  Restart all:        docker-compose restart"
echo "  Rebuild:            docker-compose up -d --build"
