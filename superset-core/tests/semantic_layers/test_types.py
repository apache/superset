import pyarrow as pa

from superset_core.semantic_layers.types import Dimension, Metric


def test_dimension_metadata_is_not_part_of_identity() -> None:
    first = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Region",
        metadata={"display_name": "Region"},
    )
    second = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Sales region",
        metadata={"display_name": "Sales region"},
    )

    assert first == second
    assert {first, second} == {first}


def test_metric_metadata_is_not_part_of_identity() -> None:
    first = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Total revenue",
        d3format="$,.2f",
        metadata={"unit": {"kind": "currency", "code": "USD"}},
    )
    second = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Revenue",
        d3format=",.0f",
        metadata={"unit": {"kind": "currency", "code": "EUR"}},
    )

    assert first == second
    assert {first, second} == {first}


def test_metric_accepts_superset_presentation_fields() -> None:
    metric = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Total revenue",
        d3format="$,.2f",
    )

    assert metric.verbose_name == "Total revenue"
    assert metric.d3format == "$,.2f"


def test_dimension_accepts_superset_presentation_fields() -> None:
    dimension = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Region",
    )

    assert dimension.verbose_name == "Region"


def test_metadata_defaults_are_not_shared() -> None:
    first = Metric("first", "first", pa.int64(), "COUNT(*)")
    second = Metric("second", "second", pa.int64(), "COUNT(*)")

    first.metadata["display_name"] = "First"

    assert second.metadata == {}
