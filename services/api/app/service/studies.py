"""Business logic for the Study entity and the segmentation lifecycle.

Orchestrates the repo layer; no boto3 here. Segmentation runs on a background
thread so the POST returns immediately with the study in `running` state and the
UI polls the detail endpoint. The engine import is lazy (in
`repo/segmentation.py`), so a clone without the ML stack records the run as
`failed` with an actionable message instead of raising.
"""

import logging
import re
import threading
from datetime import UTC, datetime

from app.repo import segmentation as segmentation_repo
from app.repo import studies as studies_repo
from app.repo.segmentation import EngineUnavailableError
from app.types import (
    CreateStudyRequest,
    DeleteStudyResponse,
    FileUrlResponse,
    SegmentationStats,
    SegmentRequest,
    SourceObject,
    Study,
    StudyDetail,
    StudyStats,
    UpdateStudyRequest,
)
from app.types.formatting import humanize_bytes

logger = logging.getLogger(__name__)

STUDY_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class StudyError(Exception):
    """Base class for study service errors, carrying an HTTP status + detail."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class StudyNotFoundError(StudyError):
    def __init__(self, study_id: str):
        super().__init__(f"Study '{study_id}' not found", status_code=404)


class StudyConflictError(StudyError):
    def __init__(self, detail: str):
        super().__init__(detail, status_code=409)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _build_study(record: dict) -> Study:
    """Materialize a Study model from a stored record, adding human sizes."""
    derived = record.get("derived_bytes")
    return Study(
        study_id=record["study_id"],
        modality=record["modality"],
        task=record["task"],
        status=record["status"],
        fast=record.get("fast", True),
        source_key=record["source_key"],
        mask_key=record.get("mask_key"),
        stats_key=record.get("stats_key"),
        structure_count=record.get("structure_count"),
        source_bytes=record.get("source_bytes", 0),
        source_bytes_human=humanize_bytes(record.get("source_bytes", 0)),
        derived_bytes=derived,
        derived_bytes_human=humanize_bytes(derived) if derived is not None else None,
        created_at=record["created_at"],
        description=record.get("description"),
        patient_label=record.get("patient_label"),
        error=record.get("error"),
    )


def list_studies(limit: int = 100) -> list[Study]:
    records = studies_repo.list_records()
    records.sort(key=lambda record: record.get("created_at", ""), reverse=True)
    return [_build_study(record) for record in records[:limit]]


def list_sources() -> list[SourceObject]:
    """Ingested NIfTI volumes not yet claimed by a study (the create picker)."""
    sources = []
    for obj in studies_repo.list_incoming_sources():
        key = obj["Key"]
        sources.append(
            SourceObject(
                key=key,
                filename=key.rsplit("/", 1)[-1],
                size_bytes=obj["Size"],
                size_human=humanize_bytes(obj["Size"]),
                uploaded_at=obj["LastModified"],
            )
        )
    sources.sort(key=lambda source: source.uploaded_at, reverse=True)
    return sources


def create_study(req: CreateStudyRequest) -> Study:
    if not STUDY_ID_RE.match(req.study_id):
        raise StudyError(
            "study_id must be alphanumeric with -, _ or . (no slashes or spaces)"
        )
    if studies_repo.read_record(req.study_id) is not None:
        raise StudyConflictError(f"Study '{req.study_id}' already exists")

    source_key = req.source_key
    if not source_key.startswith(studies_repo.STAGING_PREFIX) or not source_key.lower().endswith(
        studies_repo.SOURCE_EXTENSIONS
    ):
        raise StudyError("source_key must be an ingested NIfTI volume from /studies/sources")

    filename = source_key.rsplit("/", 1)[-1]
    dest_key = studies_repo.source_key_for(req.study_id, filename)
    source_bytes = studies_repo.object_size(source_key)
    if source_bytes is None:
        raise StudyError("Selected source volume no longer exists — re-ingest it", status_code=404)

    studies_repo.move_object(source_key, dest_key)
    record = {
        "study_id": req.study_id,
        "modality": req.modality,
        "task": req.task,
        "fast": req.fast,
        "status": "pending",
        "source_key": dest_key,
        "mask_key": None,
        "stats_key": None,
        "structure_count": None,
        "source_bytes": source_bytes,
        "derived_bytes": None,
        "created_at": _now_iso(),
        "description": req.description,
        "patient_label": req.patient_label,
        "error": None,
    }
    studies_repo.write_record(record)
    logger.info("Study created: study=%s task=%s", req.study_id, req.task)
    return _build_study(record)


def update_study(study_id: str, req: UpdateStudyRequest) -> Study:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    if req.description is not None:
        record["description"] = req.description
    if req.patient_label is not None:
        record["patient_label"] = req.patient_label
    studies_repo.write_record(record)
    return _build_study(record)


def delete_study(study_id: str) -> DeleteStudyResponse:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    count = studies_repo.delete_prefix(studies_repo.study_prefix(study_id))
    logger.info("Study deleted: study=%s objects=%d", study_id, count)
    return DeleteStudyResponse(deleted=True, study_id=study_id, objects_deleted=count)


def get_study_detail(study_id: str) -> StudyDetail:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    study = _build_study(record)

    source_url = studies_repo.presign(
        record["source_key"], record["source_key"].rsplit("/", 1)[-1]
    )
    mask_url = None
    if record.get("mask_key"):
        mask_url = studies_repo.presign(record["mask_key"], f"{study_id}-segmentation.nii.gz")

    stats = None
    if record.get("stats_key"):
        stats_data = studies_repo.read_json(record["stats_key"])
        if stats_data is not None:
            stats = StudyStats(**stats_data)

    return StudyDetail(study=study, source_url=source_url, mask_url=mask_url, stats=stats)


def get_source_download_url(study_id: str) -> FileUrlResponse:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    filename = record["source_key"].rsplit("/", 1)[-1]
    return FileUrlResponse(url=studies_repo.presign(record["source_key"], filename))


def get_mask_download_url(study_id: str) -> FileUrlResponse:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    if not record.get("mask_key"):
        raise StudyError("This study has no mask yet — run segmentation first", status_code=404)
    filename = f"{study_id}-segmentation.nii.gz"
    return FileUrlResponse(url=studies_repo.presign(record["mask_key"], filename))


def start_segmentation(study_id: str, req: SegmentRequest) -> Study:
    record = studies_repo.read_record(study_id)
    if record is None:
        raise StudyNotFoundError(study_id)
    if record["status"] == "running":
        raise StudyConflictError(f"Study '{study_id}' is already segmenting")

    task = req.task or record["task"]
    fast = req.fast if req.fast is not None else record.get("fast", True)
    record.update({"status": "running", "task": task, "fast": fast, "error": None})
    studies_repo.write_record(record)

    thread = threading.Thread(
        target=_run_segmentation_job,
        args=(study_id, task, fast, req.roi_subset),
        name=f"segment-{study_id}",
        daemon=True,
    )
    thread.start()
    logger.info("Segmentation queued: study=%s task=%s fast=%s", study_id, task, fast)
    return _build_study(record)


def _run_segmentation_job(
    study_id: str, task: str, fast: bool, roi_subset: list[str] | None
) -> None:
    """Background worker: run the engine, then record done/failed on the study.

    Never raises — a missing ML stack or an inference error is captured and
    persisted as `failed` so the polling UI shows a real reason.
    """
    record = studies_repo.read_record(study_id)
    if record is None:
        return
    try:
        result = segmentation_repo.run_segmentation(record, task, fast, roi_subset)
        record = studies_repo.read_record(study_id) or record
        record.update(
            {
                "status": "done",
                "mask_key": result["mask_key"],
                "stats_key": result["stats_key"],
                "structure_count": result["structure_count"],
                "derived_bytes": result["derived_bytes"],
                "error": None,
            }
        )
        studies_repo.write_record(record)
    except EngineUnavailableError as error:
        _record_failure(study_id, str(error))
    except Exception as error:
        # Any failure must land on the record, never crash the worker thread.
        logger.exception("Segmentation failed: study=%s", study_id)
        _record_failure(study_id, f"Segmentation failed: {error}")


def _record_failure(study_id: str, message: str) -> None:
    record = studies_repo.read_record(study_id)
    if record is None:
        return
    record.update({"status": "failed", "error": message})
    studies_repo.write_record(record)


def get_segmentation_stats() -> SegmentationStats:
    """Dashboard aggregates. Byte totals and the amplification ratio are over
    completed studies only, so source and derived are measured on the same set."""
    records = studies_repo.list_records()
    done = [record for record in records if record["status"] == "done"]
    source_total = sum(record.get("source_bytes", 0) for record in done)
    derived_total = sum(record.get("derived_bytes") or 0 for record in done)
    structures = sum(record.get("structure_count") or 0 for record in done)
    ratio = round(derived_total / source_total, 3) if source_total > 0 else 0.0
    return SegmentationStats(
        studies_total=len(records),
        studies_done=len(done),
        structures_segmented=structures,
        source_bytes_total=source_total,
        source_bytes_total_human=humanize_bytes(source_total),
        derived_bytes_total=derived_total,
        derived_bytes_total_human=humanize_bytes(derived_total),
        amplification_ratio=ratio,
    )
