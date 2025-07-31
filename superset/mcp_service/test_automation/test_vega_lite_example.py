#!/usr/bin/env python3
"""
Simple test to demonstrate Vega-Lite preview format
"""

from superset.mcp_service.chart.tool.get_chart_preview import VegaLitePreviewStrategy
from superset.mcp_service.schemas.chart_schemas import GetChartPreviewRequest


class MockChart:
    """Mock chart for testing."""

    def __init__(self) -> None:
        self.id = 1
        self.slice_name: str | None = "Sample Sales Chart"
        self.viz_type: str | None = "echarts_timeseries_line"
        self.datasource_id = 1
        self.datasource_type = "table"
        self.params: str | None = None
        self.digest = "test-digest"
        self.uuid = "test-uuid"


def test_vega_lite_spec_generation() -> None:
    """Test that Vega-Lite spec generation works."""
    # Create mock objects
    chart = MockChart()
    request = GetChartPreviewRequest(
        identifier=1,
        format="vega_lite",
        width=400,
        height=300,
    )

    # Create strategy
    strategy = VegaLitePreviewStrategy(chart, request)

    # Test spec creation with sample data
    sample_data = [
        {"month": "Jan", "sales": 100},
        {"month": "Feb", "sales": 150},
        {"month": "Mar", "sales": 120},
    ]

    vega_spec = strategy._create_vega_lite_spec(sample_data)

    print("Generated Vega-Lite Specification:")
    print("=" * 50)

    from superset.utils import json

    print(json.dumps(vega_spec, indent=2))

    # Verify basic structure
    assert vega_spec["$schema"] == "https://vega.github.io/schema/vega-lite/v5.json"
    assert vega_spec["data"]["values"] == sample_data
    assert vega_spec["width"] == 400
    assert vega_spec["height"] == 300
    assert "mark" in vega_spec
    assert "encoding" in vega_spec

    print("\n✅ Vega-Lite specification generated successfully!")
    print(f"Chart type: {vega_spec['mark']['type']}")
    print(f"X field: {vega_spec['encoding']['x']['field']}")
    print(f"Y field: {vega_spec['encoding']['y']['field']}")


if __name__ == "__main__":
    test_vega_lite_spec_generation()
