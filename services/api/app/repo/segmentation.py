"""TotalSegmentator segmentation — the primary feature, isolated here.

This is the ONLY module that imports torch / TotalSegmentator / nnU-Net, and it
imports them lazily *inside* functions so `pnpm verify` (whose venv has only the
core lock, not the ML stack) never touches them. On a clone without the imaging
stack installed, `run_segmentation` raises `EngineUnavailableError`; the service
catches it and records the study as `failed` with an actionable message, so the
segment endpoint never 500s.

Install the engine on a CUDA or CPU host:

    pip install -r services/api/requirements-ml.txt

Device selection is runtime auto-detect and defaults to CPU — see
`resolve_device`. A structural test (tests/test_structure.py) asserts nothing
outside this module imports the ML stack.
"""

import logging
import os
import tempfile

from app.config import settings
from app.repo import nifti_stats
from app.repo import studies as studies_repo

logger = logging.getLogger(__name__)


class EngineUnavailableError(RuntimeError):
    """Raised when the imaging/ML stack (requirements-ml.txt) is not installed."""


def resolve_device(preference: str | None = None) -> str:
    """Map a TS_DEVICE preference to a TotalSegmentator device string.

    `auto` (default) detects a CUDA GPU at runtime and otherwise uses CPU —
    never MPS, because nnU-Net/TotalSegmentator MPS support is weak. `mps` is an
    explicit opt-in; `gpu`/`cpu` force a device. This never hard-requires a GPU:
    the fallback is always CPU.
    """
    pref = (preference or settings.ts_device or "auto").strip().lower()
    if pref == "cpu":
        return "cpu"
    if pref in ("gpu", "cuda"):
        return "gpu"
    if pref == "mps":
        return "mps"
    # auto: prefer CUDA when torch can see a device, else CPU.
    try:
        import torch

        if torch.cuda.is_available():
            return "gpu"
    except ImportError:
        pass
    return "cpu"


def _import_engine():
    """Lazily import TotalSegmentator, translating a missing stack into an
    actionable `EngineUnavailableError`."""
    try:
        from totalsegmentator.map_to_binary import class_map
        from totalsegmentator.python_api import totalsegmentator
    except ImportError as error:
        raise EngineUnavailableError(
            "TotalSegmentator is not installed. Install the imaging/ML extension "
            "on a CUDA or CPU host: pip install -r services/api/requirements-ml.txt"
        ) from error
    return totalsegmentator, class_map


def run_segmentation(
    study: dict,
    task: str,
    fast: bool,
    roi_subset: list[str] | None = None,
) -> dict:
    """Run the full pipeline for one study and return the record deltas.

    Streams the source volume from B2 to a temp file, runs TotalSegmentator to a
    single multi-label mask (`ml=True`), computes per-structure volumetrics
    (`nifti_stats`), and writes the mask and stats JSON back under the study's
    prefix. Returns mask_key, stats_key, structure_count, derived_bytes and the
    stats dict. Raises `EngineUnavailableError` when the ML stack is missing.
    """
    totalsegmentator, class_map = _import_engine()
    device = resolve_device()
    study_id = study["study_id"]
    modality = study["modality"]
    source_key = study["source_key"]

    with tempfile.TemporaryDirectory(prefix=f"ts-{study_id}-") as tmp:
        source_path = os.path.join(tmp, "source.nii.gz")
        mask_path = os.path.join(tmp, "segmentation.nii.gz")
        studies_repo.download_to_file(source_key, source_path)

        logger.info(
            "Segmentation start: study=%s task=%s fast=%s device=%s",
            study_id, task, fast, device,
        )
        totalsegmentator(
            input=source_path,
            output=mask_path,
            ml=True,  # one multi-label mask file rather than a folder of binaries
            task=task,
            fast=fast,
            roi_subset=roi_subset or None,
            device=device,
            quiet=True,
        )

        names = {int(label): name for label, name in class_map.get(task, {}).items()}
        stats = nifti_stats.compute_structure_stats(mask_path, source_path, names, modality)

        mask_key = studies_repo.mask_key_for(study_id)
        stats_key = studies_repo.stats_key_for(study_id)
        mask_bytes = studies_repo.upload_local_file(mask_key, mask_path, "application/gzip")
        stats_bytes = studies_repo.put_json(stats_key, stats)

    logger.info(
        "Segmentation done: study=%s structures=%d", study_id, stats["structure_count"]
    )
    return {
        "mask_key": mask_key,
        "stats_key": stats_key,
        "structure_count": stats["structure_count"],
        "derived_bytes": mask_bytes + stats_bytes,
        "stats": stats,
    }
