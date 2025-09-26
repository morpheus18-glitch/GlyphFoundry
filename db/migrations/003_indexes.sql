CREATE INDEX IF NOT EXISTS idx_node_status ON node(status);
CREATE INDEX IF NOT EXISTS idx_embeddingrecord_vector ON embeddingrecord USING ivfflat (vector vector_cosine_ops);
