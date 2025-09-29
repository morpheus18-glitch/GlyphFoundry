"""Vector embedding and similarity search service for knowledge graph."""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, func
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None
import numpy as np
from .models import Node, Edge
from .settings import settings

class VectorService:
    """Service for handling vector embeddings and similarity search."""
    
    def __init__(self):
        self.model = None
        self.model_name = "all-MiniLM-L6-v2"  # Lightweight model for demo
        self.embedding_dim = 384
        
    def _get_model(self):
        """Lazy load the embedding model."""
        if self.model is None:
            try:
                if SentenceTransformer is not None:
                    self.model = SentenceTransformer(self.model_name)
                else:
                    self.model = None
            except Exception:
                # Fallback to random vectors for development
                self.model = None
        return self.model
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for text."""
        model = self._get_model()
        if model is None:
            # Fallback: generate normalized random vector
            vector = np.random.normal(0, 1, self.embedding_dim)
            vector = vector / np.linalg.norm(vector)
            return vector.tolist()
        
        embedding = model.encode([text])
        return embedding[0].tolist()
    
    def find_similar_nodes(
        self, 
        db: Session, 
        tenant_id: str,
        query_embedding: List[float], 
        limit: int = 10,
        similarity_threshold: float = 0.7
    ) -> List[Tuple[Any, float]]:
        """Find nodes similar to query embedding using cosine similarity."""
        
        # Convert embedding to PostgreSQL vector format
        query_vector = f"[{','.join(map(str, query_embedding))}]"
        
        # SQL query for vector similarity search
        sql = text("""
            SELECT n.*, 1 - (n.embedding_384 <=> :query_vector::vector) as similarity
            FROM nodes n
            WHERE n.tenant_id = :tenant_id
              AND n.embedding_384 IS NOT NULL
              AND 1 - (n.embedding_384 <=> :query_vector::vector) >= :threshold
            ORDER BY n.embedding_384 <=> :query_vector::vector
            LIMIT :limit
        """)
        
        result = db.execute(sql, {
            'query_vector': query_vector,
            'tenant_id': tenant_id,
            'threshold': similarity_threshold,
            'limit': limit
        })
        
        return [(row, row.similarity) for row in result.fetchall()]
    
    def create_autonomous_connections(
        self, 
        db: Session, 
        tenant_id: str,
        node_id: str,
        similarity_threshold: float = 0.8,
        max_connections: int = 5
    ) -> List[str]:
        """Create autonomous connections based on semantic similarity."""
        
        # Get the source node
        node = db.query(Node).filter(
            Node.id == node_id, 
            Node.tenant_id == tenant_id
        ).first()
        
        if not node or not node.embedding_384:
            return []
        
        # Find similar nodes
        similar_nodes = self.find_similar_nodes(
            db, tenant_id, node.embedding_384, 
            limit=max_connections * 2, 
            similarity_threshold=similarity_threshold
        )
        
        created_edges = []
        for similar_node, similarity in similar_nodes[:max_connections]:
            if similar_node.id == node_id:
                continue
                
            # Check if edge already exists
            existing_edge = db.query(Edge).filter(
                Edge.tenant_id == tenant_id,
                Edge.src_id == node_id,
                Edge.dst_id == similar_node.id
            ).first()
            
            if not existing_edge:
                # Create new autonomous edge
                edge = Edge(
                    tenant_id=tenant_id,
                    src_id=node_id,
                    dst_id=similar_node.id,
                    edge_type='semantic',
                    weight=similarity,
                    confidence=similarity,
                    auto_generated=True,
                    learning_confidence=similarity,
                    relation_name='semantic_similarity'
                )
                db.add(edge)
                created_edges.append(str(edge.id))
        
        db.commit()
        return created_edges
    
    def update_node_importance(self, db: Session, tenant_id: str, node_id: str):
        """Update node importance based on connections and activity."""
        
        # Calculate importance based on degree centrality and connection weights
        sql = text("""
            UPDATE nodes 
            SET importance_score = COALESCE((
                SELECT AVG(e.weight) * COUNT(e.id) / 10.0
                FROM edges e 
                WHERE (e.src_id = :node_id OR e.dst_id = :node_id)
                  AND e.tenant_id = :tenant_id
            ), 0.0),
            connection_strength = COALESCE((
                SELECT COUNT(e.id)
                FROM edges e 
                WHERE (e.src_id = :node_id OR e.dst_id = :node_id)
                  AND e.tenant_id = :tenant_id
            ), 0)
            WHERE id = :node_id AND tenant_id = :tenant_id
        """)
        
        db.execute(sql, {
            'node_id': node_id,
            'tenant_id': tenant_id
        })
        db.commit()

vector_service = VectorService()