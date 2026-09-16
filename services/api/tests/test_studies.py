"""Study lifecycle + segmentation-orchestration tests.

The repo boundary (B2) is mocked with an in-memory store, matching the rest of
the suite. The headline regression here is the ML-stack-absent path: the segment
endpoint must never 500, and the background run must land as `failed` with an
actionable message.
"""

from datetime import UTC, datetime

import pytest

from app.repo import studies as studies_repo
from app.repo.segmentation import EngineUnavailableError
from app.service import studies as studies_service


class FakeStore:
    def __init__(self):
        self.records: dict[str, dict] = {}
        self.staging: dict[str, int] = {}
        self.json_blobs: dict[str, dict] = {}

    # --- record CRUD ---
    def read_record(self, study_id):
        record = self.records.get(study_id)
        return dict(record) if record else None

    def write_record(self, record):
        self.records[record["study_id"]] = dict(record)

    def list_records(self):
        return [dict(record) for record in self.records.values()]

    def read_json(self, key):
        blob = self.json_blobs.get(key)
        return dict(blob) if blob else None

    # --- objects ---
    def object_size(self, key):
        return self.staging.get(key)

    def move_object(self, src, dst):
        self.staging.pop(src, None)

    def delete_prefix(self, prefix):
        removed = [sid for sid in self.records if studies_repo.study_prefix(sid) == prefix]
        for sid in removed:
            del self.records[sid]
        return len(removed) + 3  # pretend record + source + mask + stats objects

    def list_incoming_sources(self):
        # Mirror the real repo: staging objects with a NIfTI extension only.
        return [
            {"Key": key, "Size": size, "LastModified": datetime.now(UTC)}
            for key, size in self.staging.items()
            if key.lower().endswith(studies_repo.SOURCE_EXTENSIONS)
        ]

    def presign(self, key, filename, disposition="attachment"):
        return f"https://signed.example/{key}"


@pytest.fixture
def store(monkeypatch):
    fake = FakeStore()
    for name in (
        "read_record",
        "write_record",
        "list_records",
        "read_json",
        "object_size",
        "move_object",
        "delete_prefix",
        "list_incoming_sources",
        "presign",
    ):
        monkeypatch.setattr(studies_repo, name, getattr(fake, name))
    return fake


def _create_payload(study_id="demo-ct-001"):
    return {
        "study_id": study_id,
        "modality": "CT",
        "task": "total",
        "fast": True,
        "source_key": "uploads/demo-ct.nii.gz",
        "description": "synthetic phantom",
        "patient_label": "phantom-A",
    }


@pytest.mark.asyncio
async def test_create_list_and_detail_round_trip(client, store):
    store.staging["uploads/demo-ct.nii.gz"] = 12_000_000

    created = await client.post("/studies", json=_create_payload())
    assert created.status_code == 200
    body = created.json()
    assert body["study_id"] == "demo-ct-001"
    assert body["status"] == "pending"
    assert body["source_key"] == "studies/demo-ct-001/source/demo-ct.nii.gz"
    assert body["source_bytes"] == 12_000_000

    listed = await client.get("/studies")
    assert [s["study_id"] for s in listed.json()] == ["demo-ct-001"]

    detail = await client.get("/studies/demo-ct-001")
    assert detail.status_code == 200
    assert detail.json()["study"]["study_id"] == "demo-ct-001"
    assert detail.json()["source_url"].startswith("https://signed.example/")


@pytest.mark.asyncio
async def test_create_rejects_duplicate_and_bad_source(client, store):
    store.staging["uploads/demo-ct.nii.gz"] = 10
    assert (await client.post("/studies", json=_create_payload())).status_code == 200
    # Duplicate id -> 409.
    dup = await client.post("/studies", json=_create_payload())
    assert dup.status_code == 409
    # A source that is not an ingested NIfTI -> 400.
    bad = _create_payload("demo-ct-002")
    bad["source_key"] = "uploads/notes.txt"
    assert (await client.post("/studies", json=bad)).status_code == 400


@pytest.mark.asyncio
async def test_sources_lists_only_nifti(client, store):
    store.staging["uploads/vol-a.nii.gz"] = 5
    store.staging["uploads/readme.txt"] = 5
    sources = await client.get("/studies/sources")
    assert [s["filename"] for s in sources.json()] == ["vol-a.nii.gz"]


@pytest.mark.asyncio
async def test_segment_endpoint_returns_running_not_500(client, store, monkeypatch):
    # Don't actually run the engine on the endpoint path; just prove it schedules.
    monkeypatch.setattr(studies_service.threading, "Thread", _NoopThread)
    store.staging["uploads/demo-ct.nii.gz"] = 10
    await client.post("/studies", json=_create_payload())

    resp = await client.post("/studies/demo-ct-001/segment", json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


def test_segmentation_job_records_failed_when_engine_missing(store, monkeypatch):
    """The ML stack absent must persist `failed` with an actionable message —
    never crash the worker."""
    store.records["demo-ct-001"] = {
        "study_id": "demo-ct-001",
        "modality": "CT",
        "task": "total",
        "fast": True,
        "status": "running",
        "source_key": "studies/demo-ct-001/source/demo-ct.nii.gz",
        "source_bytes": 10,
        "created_at": datetime.now(UTC).isoformat(),
    }

    def _raise(*_args, **_kwargs):
        raise EngineUnavailableError(
            "TotalSegmentator is not installed. ... requirements-ml.txt"
        )

    monkeypatch.setattr(studies_service.segmentation_repo, "run_segmentation", _raise)
    studies_service._run_segmentation_job("demo-ct-001", "total", True, None)

    record = store.records["demo-ct-001"]
    assert record["status"] == "failed"
    assert "requirements-ml.txt" in record["error"]


def test_resolve_device_auto_defaults_to_cpu_without_gpu():
    """Device selection is runtime auto-detect and never hard-requires a GPU.

    In the verify venv torch is absent, so `auto` falls through to CPU. Explicit
    preferences still map straight through."""
    from app.repo import segmentation

    assert segmentation.resolve_device("auto") == "cpu"
    assert segmentation.resolve_device("cpu") == "cpu"
    assert segmentation.resolve_device("gpu") == "gpu"
    assert segmentation.resolve_device("mps") == "mps"


class _NoopThread:
    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        return None
