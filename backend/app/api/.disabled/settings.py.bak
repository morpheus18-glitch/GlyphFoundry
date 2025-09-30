"""Configuration endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.db import get_db
from app.models.settings import SettingEntry
from app.schemas.settings import SettingCreate, SettingRead, SettingUpdate

router = APIRouter()


@router.get("/settings", response_model=list[SettingRead])
async def list_settings(session=Depends(get_db)):
    result = await session.execute(select(SettingEntry).order_by(SettingEntry.key))
    return list(result.scalars().all())


@router.post("/settings", response_model=SettingRead, status_code=201)
async def create_setting(payload: SettingCreate, session=Depends(get_db)):
    entry = SettingEntry(key=payload.key, value=payload.value, description=payload.description)
    session.add(entry)
    await session.flush()
    return entry


@router.patch("/settings/{key}", response_model=SettingRead)
async def update_setting(key: str, payload: SettingUpdate, session=Depends(get_db)):
    result = await session.execute(select(SettingEntry).where(SettingEntry.key == key))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="not_found")
    if payload.value is not None:
        entry.value = payload.value
    if payload.description is not None:
        entry.description = payload.description
    await session.flush()
    return entry
