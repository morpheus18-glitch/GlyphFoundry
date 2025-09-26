#!/bin/bash
echo "Backing up current config..."
docker exec gf_edge cp /etc/nginx/conf.d/nginx.conf /etc/nginx/conf.d/nginx.conf.bak

echo "Updating nginx config..."
docker exec gf_edge sed -i 's|location ~ \^/(graph3d\|tags\|busz\|produce)(/\|\$) {|location ~ ^/(busz\|graph3d\|tags\|produce\|pipeline\|graph)(/.*)\?\$ {|' /etc/nginx/conf.d/nginx.conf

echo "Testing nginx config..."
docker exec gf_edge nginx -t

echo "Reloading nginx..."
docker exec gf_edge nginx -s reload

echo "Testing routes..."
curl -s https://fitwellfast.com/busz | head -5
curl -s https://fitwellfast.com/graph3d/data | head -5
curl -s https://fitwellfast.com/tags/data | head -5
