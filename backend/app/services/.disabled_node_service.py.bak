"""Service layer for node management."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nodes import Node
from app.schemas.nodes import NodeCreate, NodeHealthSummary, NodeUpdate


class NodeService:
    """Encapsulates CRUD operations on node records."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_node(self, payload: NodeCreate) -> Node:
        node = Node(
            name=payload.name,
            healthy=True,
            status="online",
            labels=payload.labels,
            last_heartbeat=datetime.now(timezone.utc),
        )
        self._session.add(node)
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ValueError("node_already_exists") from exc
        return node

    async def update_node(self, node_id: int, payload: NodeUpdate) -> Node:
        node = await self.get_node(node_id)
        if payload.status is not None:
            node.status = payload.status
        if payload.healthy is not None:
            node.healthy = payload.healthy
        if payload.cpu_usage is not None:
            node.cpu_usage = payload.cpu_usage
        if payload.memory_usage is not None:
            node.memory_usage = payload.memory_usage
        if payload.labels is not None:
            node.labels = payload.labels
        node.last_heartbeat = datetime.now(timezone.utc)
        await self._session.flush()
        return node

    async def record_heartbeat(
        self, node_name: str, healthy: bool, cpu_usage: float, memory_usage: float, labels: Optional[dict]
    ) -> Node:
        query = select(Node).where(Node.name == node_name)
        result = await self._session.execute(query)
        node = result.scalar_one_or_none()
        if node is None:
            node = Node(
                name=node_name,
                healthy=healthy,
                status="online" if healthy else "degraded",
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                labels=labels,
                last_heartbeat=datetime.now(timezone.utc),
            )
            self._session.add(node)
        else:
            node.healthy = healthy
            node.status = "online" if healthy else "degraded"
            node.cpu_usage = cpu_usage
            node.memory_usage = memory_usage
            node.labels = labels
            node.last_heartbeat = datetime.now(timezone.utc)
        await self._session.flush()
        return node

    async def list_nodes(self) -> Iterable[Node]:
        result = await self._session.execute(select(Node).order_by(Node.name))
        return result.scalars().all()

    async def get_node(self, node_id: int) -> Node:
        result = await self._session.execute(select(Node).where(Node.id == node_id))
        node = result.scalar_one_or_none()
        if node is None:
            raise ValueError("node_not_found")
        return node

    async def delete_node(self, node_id: int) -> None:
        node = await self.get_node(node_id)
        await self._session.delete(node)

    async def summarize_health(self) -> NodeHealthSummary:
        nodes = await self.list_nodes()
        healthy = sum(1 for node in nodes if node.healthy)
        degraded = sum(1 for node in nodes if node.status == "degraded")
        unhealthy = sum(1 for node in nodes if not node.healthy and node.status != "degraded")
        return NodeHealthSummary(
            total_nodes=len(nodes),
            healthy_nodes=healthy,
            degraded_nodes=degraded,
            unhealthy_nodes=unhealthy,
        )


__all__ = ["NodeService"]
