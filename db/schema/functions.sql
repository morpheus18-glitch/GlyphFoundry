-- Example function returning node health summary
CREATE OR REPLACE FUNCTION get_node_health_summary()
RETURNS TABLE(healthy_nodes integer, degraded_nodes integer, unhealthy_nodes integer, total_nodes integer)
LANGUAGE sql
AS $$
    SELECT healthy_nodes, degraded_nodes, unhealthy_nodes, total_nodes FROM node_health_summary;
$$;
