from datetime import date

import pytest
from fastapi import HTTPException

from app.api.routes import availability as availability_routes
from app.schemas.availability import BatchAvailabilityInput


def test_batch_availability_reuses_slot_calculation_for_each_vendor(monkeypatch):
    calls = []

    def fake_get_available_slots(
        vendor_id,
        requested_date,
        duration_minutes,
        slot_interval_minutes,
        db,
    ):
        calls.append(
            (
                vendor_id,
                requested_date,
                duration_minutes,
                slot_interval_minutes,
                db,
            )
        )
        return {
            "vendor_id": vendor_id,
            "status": "slots_found",
            "slots": [{"start_time": "10:00", "end_time": "11:00"}],
        }

    monkeypatch.setattr(
        availability_routes,
        "get_available_slots",
        fake_get_available_slots,
    )
    db = object()
    payload = BatchAvailabilityInput(
        vendor_ids=[4, 5],
        requested_date=date(2026, 6, 15),
    )

    result = availability_routes.get_batch_available_slots(payload, db)

    assert [call[0] for call in calls] == [4, 5]
    assert all(call[1:] == (date(2026, 6, 15), 60, 30, db) for call in calls)
    assert result["success"] is True
    assert [vendor["vendor_id"] for vendor in result["vendors"]] == [4, 5]


def test_batch_availability_reports_stale_vendor_without_failing_other_results(
    monkeypatch,
):
    def fake_get_available_slots(vendor_id, **kwargs):
        if vendor_id == 5:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return {"vendor_id": vendor_id, "status": "slots_found", "slots": []}

    monkeypatch.setattr(
        availability_routes,
        "get_available_slots",
        fake_get_available_slots,
    )
    payload = BatchAvailabilityInput(
        vendor_ids=[4, 5],
        requested_date=date(2026, 6, 15),
    )

    result = availability_routes.get_batch_available_slots(payload, object())

    assert result["vendors"][0]["status"] == "slots_found"
    assert result["vendors"][1] == {
        "success": False,
        "status": "error",
        "vendor_id": 5,
        "message": "Vendor not found",
        "requested_date": "2026-06-15",
        "slots": [],
    }


def test_batch_availability_rejects_duplicate_vendor_ids():
    payload = BatchAvailabilityInput(
        vendor_ids=[4, 4],
        requested_date=date(2026, 6, 15),
    )

    with pytest.raises(HTTPException) as error:
        availability_routes.get_batch_available_slots(payload, object())

    assert error.value.status_code == 400
