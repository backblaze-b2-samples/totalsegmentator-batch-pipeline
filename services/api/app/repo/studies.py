"""B2 data access for the Study entity — records, staging and derived artifacts.

Everything a study owns lives under one prefix, keyed by study id:

    studies/<study_id>/record.json          the Study record (status + artifact keys)
    studies/<study_id>/source/<file>.nii.gz  the raw source volume (moved from staging)
    studies/<study_id>/segmentation.nii.gz   the multi-label mask
    studies/<study_id>/stats.json            per-structure volumetrics

Ingested-but-unassigned volumes sit in the kit's `uploads/` staging prefix until
a study claims them (see `move_object`). This module reuses the cached,
UA-tagged S3 client from `b2_client`; boto3 stays inside the repo/ layer.
"""

import json
import os

from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.repo.b2_client import get_presigned_url, get_s3_client
from app.repo.list_cache import invalidate as _invalidate_list_cache

STUDIES_PREFIX = "studies/"
# Mirrors service.upload.UPLOAD_PREFIX. The repo/ layer cannot import service/
# (backward-import boundary), so the one literal is repeated with this note.
STAGING_PREFIX = "uploads/"
SOURCE_EXTENSIONS = (".nii.gz", ".nii")


def _record_key(study_id: str) -> str:
    return f"{STUDIES_PREFIX}{study_id}/record.json"


def study_prefix(study_id: str) -> str:
    return f"{STUDIES_PREFIX}{study_id}/"


def source_key_for(study_id: str, filename: str) -> str:
    return f"{STUDIES_PREFIX}{study_id}/source/{filename}"


def mask_key_for(study_id: str) -> str:
    return f"{STUDIES_PREFIX}{study_id}/segmentation.nii.gz"


def stats_key_for(study_id: str) -> str:
    return f"{STUDIES_PREFIX}{study_id}/stats.json"


def _iter_objects(prefix: str) -> list[dict]:
    """Every object under `prefix`, paginated. Fresh (not the listing cache):
    study records change on every status transition."""
    client = get_s3_client()
    contents: list[dict] = []
    kwargs: dict = {"Bucket": settings.b2_bucket_name, "Prefix": prefix, "MaxKeys": 1000}
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            contents.extend(response.get("Contents", []))
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 list failed for '{prefix}': {e}") from e
    return contents


def read_json(key: str) -> dict | None:
    """Read and parse a JSON object. Returns None if absent."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
        return json.loads(response["Body"].read())
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 get_json failed for '{key}': {e}") from e


def read_record(study_id: str) -> dict | None:
    """Read and parse studies/<id>/record.json. Returns None if absent."""
    return read_json(_record_key(study_id))


def write_record(record: dict) -> None:
    """Persist a study record as JSON. `created_at` is already an ISO string."""
    client = get_s3_client()
    body = json.dumps(record, default=str).encode("utf-8")
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=_record_key(record["study_id"]),
            Body=body,
            ContentType="application/json",
        )
    except ClientError as e:
        raise RuntimeError(f"B2 write record failed for '{record['study_id']}': {e}") from e
    _invalidate_list_cache()


def list_records() -> list[dict]:
    """Every study record. One get_object per study (tiny demo scale)."""
    records: list[dict] = []
    for obj in _iter_objects(STUDIES_PREFIX):
        if not obj["Key"].endswith("/record.json"):
            continue
        study_id = obj["Key"][len(STUDIES_PREFIX):].rsplit("/record.json", 1)[0]
        record = read_record(study_id)
        if record is not None:
            records.append(record)
    return records


def list_incoming_sources() -> list[dict]:
    """Ingested NIfTI volumes still in staging (not yet claimed by a study)."""
    sources = []
    for obj in _iter_objects(STAGING_PREFIX):
        if obj["Key"].lower().endswith(SOURCE_EXTENSIONS):
            sources.append(obj)
    return sources


def object_size(key: str) -> int | None:
    """head_object ContentLength, or None when the object is missing."""
    client = get_s3_client()
    try:
        response = client.head_object(Bucket=settings.b2_bucket_name, Key=key)
        return response["ContentLength"]
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 head failed for '{key}': {e}") from e


def move_object(src_key: str, dest_key: str) -> None:
    """Server-side copy then delete — claims a staged volume into a study prefix
    without streaming the bytes back through the API."""
    client = get_s3_client()
    try:
        client.copy_object(
            Bucket=settings.b2_bucket_name,
            CopySource={"Bucket": settings.b2_bucket_name, "Key": src_key},
            Key=dest_key,
        )
        client.delete_object(Bucket=settings.b2_bucket_name, Key=src_key)
    except ClientError as e:
        raise RuntimeError(f"B2 move failed '{src_key}' -> '{dest_key}': {e}") from e
    _invalidate_list_cache()


def download_to_file(key: str, local_path: str) -> None:
    """Stream an object to a local temp file (multipart), never buffering it all
    in memory — source volumes are hundreds of MB."""
    client = get_s3_client()
    try:
        client.download_file(settings.b2_bucket_name, key, local_path)
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 download failed for '{key}': {e}") from e


def upload_local_file(key: str, local_path: str, content_type: str) -> int:
    """Upload a local file (multipart for large masks). Returns the byte size."""
    client = get_s3_client()
    try:
        client.upload_file(
            local_path,
            settings.b2_bucket_name,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 upload failed for '{key}': {e}") from e
    _invalidate_list_cache()
    return os.path.getsize(local_path)


def put_json(key: str, obj: dict) -> int:
    """Write a JSON object and return the byte size written."""
    client = get_s3_client()
    body = json.dumps(obj, default=str).encode("utf-8")
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name, Key=key, Body=body, ContentType="application/json"
        )
    except ClientError as e:
        raise RuntimeError(f"B2 put_json failed for '{key}': {e}") from e
    _invalidate_list_cache()
    return len(body)


def delete_prefix(prefix: str) -> int:
    """Delete every object under `prefix`. Returns the count removed."""
    client = get_s3_client()
    objects = _iter_objects(prefix)
    for obj in objects:
        try:
            client.delete_object(Bucket=settings.b2_bucket_name, Key=obj["Key"])
        except ClientError as e:
            raise RuntimeError(f"B2 delete failed for '{obj['Key']}': {e}") from e
    if objects:
        _invalidate_list_cache()
    return len(objects)


def presign(key: str, filename: str, disposition: str = "attachment") -> str:
    """Short-lived presigned GET for a source volume or mask download."""
    return get_presigned_url(
        key, filename=filename, disposition=disposition, expires_in=900
    )
