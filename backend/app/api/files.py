"""
File Upload and Multi-Modal Ingestion API
Supports images, documents, CSV, JSON, and natural language text
Mobile-compatible with multipart/form-data
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import os
import uuid
import json
import csv
import io
import mimetypes
from datetime import datetime, timedelta
import hashlib

from ..db import get_db
from sqlalchemy import text

router = APIRouter(prefix="/files", tags=["files"])

# Simple tenant ID extraction from header
def get_current_tenant_id(request: Request) -> str:
    """Extract tenant ID from X-Tenant-ID header or use default"""
    tenant_id = request.headers.get("X-Tenant-ID", "00000000-0000-0000-0000-000000000000")
    return tenant_id

# MinIO/S3 Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "glyph-foundry-files")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# File type mappings
FILE_TYPE_MAP = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "image/svg+xml": "image",
    "application/pdf": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/msword": "document",
    "text/csv": "csv",
    "application/json": "json",
    "text/plain": "text",
    "video/mp4": "video",
    "video/webm": "video",
    "audio/mpeg": "audio",
    "audio/wav": "audio",
}

def get_file_type(mime_type: str) -> str:
    """Determine file type from MIME type"""
    return FILE_TYPE_MAP.get(mime_type, "other")


try:
    from minio import Minio
    from minio.error import S3Error
    
    minio_client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE
    )
    
    # Ensure bucket exists
    if not minio_client.bucket_exists(MINIO_BUCKET):
        minio_client.make_bucket(MINIO_BUCKET)
        
except ImportError:
    minio_client = None
    print("MinIO not installed. File storage will use local filesystem.")


def upload_to_storage(file: UploadFile, tenant_id: str, file_id: str) -> tuple[str, str]:
    """Upload file to MinIO/S3 or local storage"""
    file_ext = os.path.splitext(file.filename)[1]
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1]
    storage_filename = f"{file_id}{file_ext}"
    storage_path = f"{tenant_id}/{storage_filename}"
    
    if minio_client:
        # Upload to MinIO/S3
        file.file.seek(0)
        content = file.file.read()
        file.file.seek(0)
        
        minio_client.put_object(
            MINIO_BUCKET,
            storage_path,
            io.BytesIO(content),
            length=len(content),
            content_type=file.content_type
        )
        
        # Generate presigned URL (7 days expiry)
        storage_url = minio_client.presigned_get_object(
            MINIO_BUCKET,
            storage_path,
            expires=timedelta(days=7)
        )
    else:
        # Local filesystem fallback
        upload_dir = f"uploads/{tenant_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, storage_filename)
        with open(file_path, "wb") as f:
            file.file.seek(0)
            content = file.file.read()
            f.write(content)
            file.file.seek(0)
        
        storage_url = f"/uploads/{storage_path}"
    
    return storage_path, storage_url


def extract_text_content(file: UploadFile, file_type: str) -> Optional[str]:
    """Extract text from various file types"""
    file.file.seek(0)
    content = file.file.read()
    file.file.seek(0)
    
    try:
        if file_type == "text":
            return content.decode('utf-8')
        
        elif file_type == "json":
            # Pretty print JSON for text extraction
            data = json.loads(content)
            return json.dumps(data, indent=2)
        
        elif file_type == "csv":
            # Convert CSV to text representation
            text_content = content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(text_content))
            rows = []
            for row in reader:
                rows.append(" | ".join(f"{k}: {v}" for k, v in row.items()))
            return "\n".join(rows)
        
        elif file_type == "document" and file.content_type == "application/pdf":
            # PDF text extraction (requires PyPDF2 or similar)
            try:
                import PyPDF2
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                text = []
                for page in pdf_reader.pages:
                    text.append(page.extract_text())
                return "\n".join(text)
            except ImportError:
                return None
        
    except Exception as e:
        print(f"Error extracting text: {e}")
        return None
    
    return None


def parse_structured_data(file: UploadFile, file_type: str) -> Optional[dict]:
    """Parse structured data from JSON/CSV"""
    file.file.seek(0)
    content = file.file.read()
    file.file.seek(0)
    
    try:
        if file_type == "json":
            return json.loads(content)
        
        elif file_type == "csv":
            text_content = content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(text_content))
            return {"rows": list(reader)}
        
    except Exception as e:
        print(f"Error parsing structured data: {e}")
        return None
    
    return None


@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    create_node: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Upload a file (image, document, CSV, JSON, etc.)
    Mobile-compatible multipart/form-data endpoint
    
    - **file**: The file to upload
    - **description**: Optional description
    - **create_node**: Whether to create a knowledge graph node
    """
    
    tenant_id = get_current_tenant_id(request)
    
    # Validate file
    filename = file.filename or "unknown"
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Determine MIME type and file type
    mime_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    file_type = get_file_type(mime_type)
    
    # Get file size
    file.file.seek(0)
    content = file.file.read()
    file_size = len(content)
    file.file.seek(0)
    
    # Generate file ID
    file_id = str(uuid.uuid4())
    
    # Upload to storage
    storage_path, storage_url = upload_to_storage(file, tenant_id, file_id)
    
    # Extract text content
    extracted_text = extract_text_content(file, file_type)
    
    # Parse structured data
    structured_data = parse_structured_data(file, file_type)
    
    # Create file record
    insert_query = text("""
        INSERT INTO files (
            id, tenant_id, filename, original_filename, file_type, mime_type,
            size_bytes, storage_path, storage_url, extracted_text, structured_data,
            processing_status, metadata, uploaded_by
        ) VALUES (
            :id, :tenant_id, :filename, :original_filename, :file_type, :mime_type,
            :size_bytes, :storage_path, :storage_url, :extracted_text, :structured_data,
            :processing_status, :metadata, :uploaded_by
        ) RETURNING id, filename, file_type, size_bytes, storage_url, created_at
    """)
    
    result = db.execute(insert_query, {
        "id": file_id,
        "tenant_id": tenant_id,
        "filename": f"{file_id}{os.path.splitext(filename)[1]}",
        "original_filename": filename,
        "file_type": file_type,
        "mime_type": mime_type,
        "size_bytes": file_size,
        "storage_path": storage_path,
        "storage_url": storage_url,
        "extracted_text": extracted_text,
        "structured_data": json.dumps(structured_data) if structured_data else None,
        "processing_status": "completed" if extracted_text or structured_data else "pending",
        "metadata": json.dumps({"description": description} if description else {}),
        "uploaded_by": "api"
    })
    
    db.commit()
    
    file_record = result.fetchone()
    
    # Optionally create knowledge graph node
    node_id = None
    if create_node and (extracted_text or structured_data):
        node_query = text("""
            INSERT INTO nodes_v2 (tenant_id, kind, name, summary, content, metadata)
            VALUES (:tenant_id, :kind, :name, :summary, :content, :metadata)
            RETURNING id
        """)
        
        node_result = db.execute(node_query, {
            "tenant_id": tenant_id,
            "kind": "document",
            "name": file.filename,
            "summary": description or f"Uploaded file: {file.filename}",
            "content": extracted_text or json.dumps(structured_data, indent=2),
            "metadata": json.dumps({
                "file_id": file_id,
                "file_type": file_type,
                "mime_type": mime_type
            })
        })
        
        node_id = node_result.scalar()
        
        # Link file to node
        db.execute(
            text("UPDATE files SET node_id = :node_id WHERE id = :file_id"),
            {"node_id": node_id, "file_id": file_id}
        )
        db.commit()
    
    return {
        "success": True,
        "file_id": str(file_record[0]),
        "filename": file_record[1],
        "file_type": file_record[2],
        "size_bytes": file_record[3],
        "storage_url": file_record[4],
        "created_at": file_record[5].isoformat(),
        "node_id": str(node_id) if node_id else None,
        "extracted_text": extracted_text[:500] if extracted_text else None,  # Preview
        "has_structured_data": structured_data is not None
    }


@router.post("/ingest/text")
def ingest_text(
    request: Request,
    text: str = Form(...),
    format: str = Form("plain"),  # plain, json, csv
    create_node: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    Ingest natural language text, JSON, or CSV directly
    Mobile-compatible form data endpoint
    
    - **text**: The text content to ingest
    - **format**: Text format (plain, json, csv)
    - **create_node**: Whether to create a knowledge graph node
    """
    
    tenant_id = get_current_tenant_id(request)
    structured_data = None
    extracted_text = text
    
    # Parse based on format
    if format == "json":
        try:
            structured_data = json.loads(text)
            extracted_text = json.dumps(structured_data, indent=2)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    elif format == "csv":
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            structured_data = {"rows": rows}
            extracted_text = "\n".join(" | ".join(f"{k}: {v}" for k, v in row.items()) for row in rows)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")
    
    # Create file record for text ingestion
    file_id = str(uuid.uuid4())
    
    insert_query = text("""
        INSERT INTO files (
            id, tenant_id, filename, original_filename, file_type, mime_type,
            size_bytes, storage_path, storage_url, extracted_text, structured_data,
            processing_status, metadata, uploaded_by
        ) VALUES (
            :id, :tenant_id, :filename, :original_filename, :file_type, :mime_type,
            :size_bytes, :storage_path, :storage_url, :extracted_text, :structured_data,
            :processing_status, :metadata, :uploaded_by
        ) RETURNING id
    """)
    
    db.execute(insert_query, {
        "id": file_id,
        "tenant_id": tenant_id,
        "filename": f"text-{file_id}.txt",
        "original_filename": f"ingested-text-{format}.txt",
        "file_type": "text" if format == "plain" else format,
        "mime_type": "text/plain" if format == "plain" else f"application/{format}",
        "size_bytes": len(text.encode('utf-8')),
        "storage_path": f"{tenant_id}/text-{file_id}.txt",
        "storage_url": None,
        "extracted_text": extracted_text,
        "structured_data": json.dumps(structured_data) if structured_data else None,
        "processing_status": "completed",
        "metadata": json.dumps({"format": format, "ingestion_method": "direct_text"}),
        "uploaded_by": "api"
    })
    
    db.commit()
    
    # Create knowledge graph node
    node_id = None
    if create_node:
        node_query = text("""
            INSERT INTO nodes_v2 (tenant_id, kind, name, summary, content, metadata)
            VALUES (:tenant_id, :kind, :name, :summary, :content, :metadata)
            RETURNING id
        """)
        
        node_result = db.execute(node_query, {
            "tenant_id": tenant_id,
            "kind": "document",
            "name": f"Ingested {format} content",
            "summary": f"Direct text ingestion in {format} format",
            "content": extracted_text,
            "metadata": json.dumps({
                "file_id": file_id,
                "format": format,
                "has_structured_data": structured_data is not None
            })
        })
        
        node_id = node_result.scalar()
        
        # Link file to node
        db.execute(
            text("UPDATE files SET node_id = :node_id WHERE id = :file_id"),
            {"node_id": node_id, "file_id": file_id}
        )
        db.commit()
    
    return {
        "success": True,
        "file_id": file_id,
        "format": format,
        "size_bytes": len(text.encode('utf-8')),
        "node_id": str(node_id) if node_id else None,
        "extracted_text": extracted_text[:500] if len(extracted_text) > 500 else extracted_text,
        "has_structured_data": structured_data is not None
    }


@router.get("/list")
def list_files(
    request: Request,
    file_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List all files for the current tenant"""
    
    tenant_id = get_current_tenant_id(request)
    query = """
        SELECT id, filename, original_filename, file_type, mime_type, 
               size_bytes, storage_url, processing_status, node_id, created_at
        FROM files
        WHERE tenant_id = :tenant_id AND deleted_at IS NULL
    """
    
    params = {"tenant_id": tenant_id, "limit": limit, "offset": offset}
    
    if file_type:
        query += " AND file_type = :file_type"
        params["file_type"] = file_type
    
    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    
    result = db.execute(text(query), params)
    files = result.fetchall()
    
    return {
        "files": [
            {
                "id": str(f[0]),
                "filename": f[1],
                "original_filename": f[2],
                "file_type": f[3],
                "mime_type": f[4],
                "size_bytes": f[5],
                "storage_url": f[6],
                "processing_status": f[7],
                "node_id": str(f[8]) if f[8] else None,
                "created_at": f[9].isoformat()
            }
            for f in files
        ],
        "total": len(files),
        "limit": limit,
        "offset": offset
    }


@router.get("/{file_id}")
def get_file(
    request: Request,
    file_id: str,
    db: Session = Depends(get_db)
):
    """Get file details including extracted content"""
    
    tenant_id = get_current_tenant_id(request)
    query = text("""
        SELECT id, filename, original_filename, file_type, mime_type, size_bytes,
               storage_path, storage_url, processing_status, processing_error,
               extracted_text, structured_data, node_id, metadata, created_at
        FROM files
        WHERE id = :file_id AND tenant_id = :tenant_id AND deleted_at IS NULL
    """)
    
    result = db.execute(query, {"file_id": file_id, "tenant_id": tenant_id})
    file_data = result.fetchone()
    
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "id": str(file_data[0]),
        "filename": file_data[1],
        "original_filename": file_data[2],
        "file_type": file_data[3],
        "mime_type": file_data[4],
        "size_bytes": file_data[5],
        "storage_path": file_data[6],
        "storage_url": file_data[7],
        "processing_status": file_data[8],
        "processing_error": file_data[9],
        "extracted_text": file_data[10],
        "structured_data": json.loads(file_data[11]) if file_data[11] else None,
        "node_id": str(file_data[12]) if file_data[12] else None,
        "metadata": json.loads(file_data[13]) if file_data[13] else {},
        "created_at": file_data[14].isoformat()
    }


@router.delete("/{file_id}")
def delete_file(
    request: Request,
    file_id: str,
    db: Session = Depends(get_db)
):
    """Soft delete a file"""
    
    tenant_id = get_current_tenant_id(request)
    query = text("""
        UPDATE files
        SET deleted_at = now()
        WHERE id = :file_id AND tenant_id = :tenant_id AND deleted_at IS NULL
        RETURNING id
    """)
    
    result = db.execute(query, {"file_id": file_id, "tenant_id": tenant_id})
    deleted = result.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    
    db.commit()
    
    return {"success": True, "file_id": file_id, "deleted": True}
