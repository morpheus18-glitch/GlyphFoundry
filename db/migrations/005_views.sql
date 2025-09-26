CREATE OR REPLACE VIEW node_health_summary AS
SELECT
    COUNT(*) FILTER (WHERE healthy) AS healthy_nodes,
    COUNT(*) FILTER (WHERE status = 'degraded') AS degraded_nodes,
    COUNT(*) FILTER (WHERE NOT healthy AND status <> 'degraded') AS unhealthy_nodes,
    COUNT(*) AS total_nodes
FROM node;
