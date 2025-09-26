-- Update updated_at timestamp on node changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_node_updated_at ON node;
CREATE TRIGGER trg_node_updated_at BEFORE UPDATE ON node
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
