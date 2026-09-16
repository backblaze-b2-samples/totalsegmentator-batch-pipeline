"""Per-structure volumetric statistics from a multi-label NIfTI mask.

nibabel + NumPy only — no torch, no TotalSegmentator. Everything is imported
lazily inside the function, and this module is only ever called from
`repo/segmentation.py` (which already needs the imaging stack), so a plain
`pnpm verify` never imports nibabel/NumPy. The deps ship in
`services/api/requirements-ml.txt`, not the core lock.
"""


def compute_structure_stats(
    mask_path: str,
    source_path: str | None,
    label_names: dict[int, str],
    modality: str,
) -> dict:
    """Volumetrics for every non-zero label in `mask_path`.

    Returns a dict shaped like `app.types.studies.StudyStats`: a list of
    per-structure stats, the structure count, the total segmented volume in mL,
    and the mask's voxel spacing. For CT, mean/std Hounsfield values are sampled
    from `source_path` inside each structure mask.
    """
    import nibabel as nib
    import numpy as np

    mask_img = nib.load(mask_path)
    mask = np.rint(np.asarray(mask_img.dataobj)).astype(np.int32)
    zooms = [float(z) for z in mask_img.header.get_zooms()[:3]]
    voxel_ml = float(np.prod(zooms)) / 1000.0  # mm^3 -> mL

    source = None
    if modality == "CT" and source_path:
        source_data = np.asarray(nib.load(source_path).dataobj).astype(np.float32)
        if source_data.shape == mask.shape:
            source = source_data

    labels = [int(label) for label in np.unique(mask) if int(label) != 0]
    structures: list[dict] = []
    total_volume = 0.0

    for label in labels:
        region = mask == label
        voxel_count = int(region.sum())
        if voxel_count == 0:
            continue
        volume_ml = voxel_count * voxel_ml
        total_volume += volume_ml
        coords = np.where(region)
        bbox = [
            int(coords[0].min()), int(coords[0].max()),
            int(coords[1].min()), int(coords[1].max()),
            int(coords[2].min()), int(coords[2].max()),
        ]
        hu_mean = hu_std = None
        if source is not None:
            values = source[region]
            hu_mean = round(float(values.mean()), 2)
            hu_std = round(float(values.std()), 2)
        structures.append(
            {
                "label_id": label,
                "name": label_names.get(label, f"label_{label}"),
                "voxel_count": voxel_count,
                "volume_ml": round(volume_ml, 3),
                "bbox": bbox,
                "hu_mean": hu_mean,
                "hu_std": hu_std,
            }
        )

    structures.sort(key=lambda item: item["volume_ml"], reverse=True)
    return {
        "structures": structures,
        "structure_count": len(structures),
        "total_volume_ml": round(total_volume, 3),
        "voxel_spacing_mm": [round(z, 4) for z in zooms],
    }
