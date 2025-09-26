"""Node management endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_db_session_dependency
from app.core.security import require_api_key
from app.schemas.nodes import NodeCreate, NodeRead, NodeUpdate
from app.services.node_service import NodeService

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/nodes", response_model=NodeRead, status_code=201)
async def register_node(payload: NodeCreate, session=Depends(get_db_session_dependency)):
    service = NodeService(session)
    try:
        node = await service.register_node(payload)
    except ValueError as exc:
        if str(exc) == "node_already_exists":
            raise HTTPException(status_code=409, detail="node_exists")
        raise
    return node


@router.get("/nodes", response_model=list[NodeRead])
async def list_nodes(session=Depends(get_db_session_dependency)):
    service = NodeService(session)
    nodes = await service.list_nodes()
    return list(nodes)


@router.patch("/nodes/{node_id}", response_model=NodeRead)
async def update_node(node_id: int, payload: NodeUpdate, session=Depends(get_db_session_dependency)):
    service = NodeService(session)
    try:
        node = await service.update_node(node_id, payload)
    except ValueError as exc:
        if str(exc) == "node_not_found":
            raise HTTPException(status_code=404, detail="not_found")
        raise
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(node_id: int, session=Depends(get_db_session_dependency)):
    service = NodeService(session)
    try:
        await service.delete_node(node_id)
    except ValueError as exc:
        if str(exc) == "node_not_found":
            raise HTTPException(status_code=404, detail="not_found")
        raise
