import logging

# Sync `def` handlers on purpose: the whole call chain is blocking boto3, and
# Starlette runs sync handlers in its threadpool, so a slow B2 scan never stalls
# the event loop (see runtime/files.py for the full rationale).
from fastapi import APIRouter, HTTPException

from app.service.studies import (
    StudyError,
    create_study,
    delete_study,
    get_mask_download_url,
    get_segmentation_stats,
    get_source_download_url,
    get_study_detail,
    list_sources,
    list_studies,
    start_segmentation,
    update_study,
)
from app.types import (
    CreateStudyRequest,
    DeleteStudyResponse,
    FileUrlResponse,
    SegmentationStats,
    SegmentRequest,
    SourceObject,
    Study,
    StudyDetail,
    UpdateStudyRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# SECURITY: these routes are intentionally UNAUTHENTICATED and bucket-wide
# (single-tenant demo stance — see docs/SECURITY.md). Patient labels must never
# carry real PHI; this app is for synthetic/phantom or de-identified data.


def _handle(call):
    try:
        return call()
    except StudyError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


# --- collection routes (static paths before the dynamic {study_id}) ----------


@router.get("/studies", response_model=list[Study])
def list_studies_endpoint(limit: int = 100):
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 1000")
    return list_studies(limit=limit)


@router.post("/studies", response_model=Study)
def create_study_endpoint(req: CreateStudyRequest):
    return _handle(lambda: create_study(req))


@router.get("/studies/stats", response_model=SegmentationStats)
def segmentation_stats_endpoint():
    return get_segmentation_stats()


@router.get("/studies/sources", response_model=list[SourceObject])
def list_sources_endpoint():
    return list_sources()


# --- per-study routes --------------------------------------------------------


@router.get("/studies/{study_id}", response_model=StudyDetail)
def get_study_endpoint(study_id: str):
    return _handle(lambda: get_study_detail(study_id))


@router.patch("/studies/{study_id}", response_model=Study)
def update_study_endpoint(study_id: str, req: UpdateStudyRequest):
    return _handle(lambda: update_study(study_id, req))


@router.delete("/studies/{study_id}", response_model=DeleteStudyResponse)
def delete_study_endpoint(study_id: str):
    return _handle(lambda: delete_study(study_id))


@router.post("/studies/{study_id}/segment", response_model=Study)
def segment_study_endpoint(study_id: str, req: SegmentRequest):
    return _handle(lambda: start_segmentation(study_id, req))


@router.get("/studies/{study_id}/mask/download", response_model=FileUrlResponse)
def mask_download_endpoint(study_id: str):
    return _handle(lambda: get_mask_download_url(study_id))


@router.get("/studies/{study_id}/source/download", response_model=FileUrlResponse)
def source_download_endpoint(study_id: str):
    return _handle(lambda: get_source_download_url(study_id))
