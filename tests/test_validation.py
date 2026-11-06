from app.schemas.vendor import VendorCreate
import pytest

def test_vendor_coordinates_are_validated():
    payload = VendorCreate(
        business_name="ABC Electric",
        latitude=19.0,
        longitude=72.0,
        address_label="Sample address",
        category_ids=[1],
    )
    assert payload.latitude == 19.0

def test_invalid_latitude_is_rejected():
    with pytest.raises(Exception):
        VendorCreate(
            business_name="ABC Electric",
            latitude=190.0,
            longitude=72.0,
            address_label="Sample address",
            category_ids=[1],
        )
