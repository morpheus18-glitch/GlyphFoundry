#!/bin/bash
echo "=== Testing nginx ==="
docker ps | grep gf_edge
echo ""

echo "=== Testing ports ==="
sudo ss -tlnp | grep -E ':(80|443)\b'
echo ""

echo "=== Testing HTTP redirect ==="
curl -I http://fitwellfast.com 2>/dev/null | head -3
echo ""

echo "=== Testing HTTPS ==="
curl -I https://fitwellfast.com 2>/dev/null | head -3
echo ""

echo "=== Testing health endpoint ==="
curl -s https://fitwellfast.com/healthz
echo ""

echo "=== Testing SSL cert expiry ==="
openssl s_client -connect fitwellfast.com:443 -servername fitwellfast.com </dev/null 2>/dev/null | openssl x509 -noout -dates
echo ""

echo "=== Container status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" | grep gf_
