"""Pydantic models for the Study primary entity and the segmentation pipeline.

`Study` is the primary entity: one CT/MRI study, persisted as
`studies/<study_id>/record.json` in B2 (there is no application database). The
response models inherit `ResponseModel` so nullable-with-default fields still
land in the OpenAPI `required` set and the generated TypeScript types them as
`T | null` rather than optional. Request models inherit plain `BaseModel`, where
a default genuinely means "the client may omit it".
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.types.base import ResponseModel

# Finite value sets, surfaced as string-literal unions in the generated
# TypeScript so the create/edit forms can render selectors rather than free text.
Modality = Literal["CT", "MRI"]
# TotalSegmentator tasks this sample exposes. `total` (CT) and `total_mr` (MRI)
# are the full 100+ structure runs; the others are focused subtasks.
SegmentationTask = Literal["total", "total_mr", "lung_vessels", "body"]
StudyStatus = Literal["pending", "running", "done", "failed"]


class Study(ResponseModel):
    """One CT/MRI study and the state of its segmentation run."""

    study_id: str = Field(description="Stable identifier; the object-key prefix under studies/.")
    modality: Modality
    task: SegmentationTask
    status: StudyStatus = Field(
        description="pending (created) -> running (segmenting) -> done | failed."
    )
    fast: bool = Field(description="Ran/will run at 3 mm (fast) rather than full 1.5 mm resolution.")
    source_key: str = Field(description="B2 key of the raw source volume under this study's prefix.")
    mask_key: str | None = Field(
        default=None, description="B2 key of the multi-label mask, once segmentation is done."
    )
    stats_key: str | None = Field(
        default=None, description="B2 key of the per-structure stats JSON, once computed."
    )
    structure_count: int | None = Field(
        default=None, description="Number of anatomical structures found in the mask."
    )
    source_bytes: int = Field(description="Size of the source volume in bytes.")
    source_bytes_human: str
    derived_bytes: int | None = Field(
        default=None, description="Mask + stats bytes written back to B2 (the amplified side)."
    )
    derived_bytes_human: str | None = None
    created_at: datetime
    description: str | None = None
    patient_label: str | None = Field(
        default=None,
        description="Non-identifying label (e.g. a phantom or cohort code). Never real PHI.",
    )
    error: str | None = Field(
        default=None, description="Failure reason, set only when status is failed."
    )


class SourceObject(ResponseModel):
    """An ingested-but-unassigned NIfTI volume, offered in the create picker."""

    key: str
    filename: str
    size_bytes: int
    size_human: str
    uploaded_at: datetime


class StructureStat(ResponseModel):
    """Volumetrics for one segmented anatomical structure."""

    label_id: int = Field(description="Integer label in the multi-label mask.")
    name: str = Field(description="Structure name from the TotalSegmentator class map.")
    voxel_count: int
    volume_ml: float = Field(description="Structure volume in millilitres (voxels x voxel volume).")
    bbox: list[int] = Field(
        description="Voxel bounding box [x_min, x_max, y_min, y_max, z_min, z_max]."
    )
    hu_mean: float | None = Field(
        default=None, description="Mean CT Hounsfield value inside the structure (CT only)."
    )
    hu_std: float | None = Field(
        default=None, description="Std dev of CT Hounsfield values inside the structure (CT only)."
    )


class StudyStats(ResponseModel):
    """Per-structure volumetrics plus study-level totals."""

    structures: list[StructureStat]
    structure_count: int
    total_volume_ml: float
    voxel_spacing_mm: list[float] | None = Field(
        default=None, description="Voxel size [x, y, z] in mm, from the mask header."
    )


class StudyDetail(ResponseModel):
    """A study plus short-lived presigned download URLs and its computed stats."""

    study: Study
    source_url: str | None = Field(default=None, description="Presigned GET for the source volume.")
    mask_url: str | None = Field(default=None, description="Presigned GET for the mask, if present.")
    stats: StudyStats | None = None


class SegmentationStats(ResponseModel):
    """Dashboard aggregates — the write-amplification headline metric."""

    studies_total: int
    studies_done: int
    structures_segmented: int
    source_bytes_total: int
    source_bytes_total_human: str
    derived_bytes_total: int
    derived_bytes_total_human: str
    amplification_ratio: float = Field(
        description="derived_bytes_total / source_bytes_total across all done studies."
    )


class CreateStudyRequest(BaseModel):
    """Create a study from an already-ingested source volume."""

    study_id: str
    modality: Modality
    task: SegmentationTask
    fast: bool = True
    source_key: str = Field(description="Key of an ingested volume from GET /studies/sources.")
    description: str | None = None
    patient_label: str | None = None


class UpdateStudyRequest(BaseModel):
    """Edit a study's descriptive metadata (create-time fields are read-only)."""

    description: str | None = None
    patient_label: str | None = None


class SegmentRequest(BaseModel):
    """Kick off (or re-run) segmentation, optionally overriding create-time choices."""

    task: SegmentationTask | None = None
    fast: bool | None = None
    roi_subset: list[str] | None = Field(
        default=None, description="Limit segmentation to these structure names."
    )


class DeleteStudyResponse(ResponseModel):
    """Acknowledge deletion of a study and every object under its prefix."""

    deleted: bool
    study_id: str
    objects_deleted: int
