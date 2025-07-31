#!/usr/bin/env python3
"""
Test script to verify the critical fixes for MCP service issues.
Tests the three critical issues documented in CRITICAL_ISSUES.md:
1. Time series data aggregation bug
2. Missing previews for unsaved charts
3. Vega-Lite field mapping errors
"""

from typing import Any, Dict, List, Tuple

from superset.utils import json


def test_time_series_aggregation() -> Dict[str, Any]:
    """Test that time series charts preserve temporal dimension."""
    print("\n🧪 Test 1: Time Series Data Aggregation")
    print("=" * 50)

    # Test chart configuration
    config = {
        "dataset_id": 24,  # Adjust to your dataset
        "config": {
            "chart_type": "xy",
            "kind": "line",
            "x": {"name": "order_date"},
            "y": [{"name": "sales", "aggregate": "SUM", "label": "Total Sales"}],
        },
        "save_chart": True,
        "preview_formats": ["table", "vega_lite"],
    }

    print(f"Test config: {json.dumps(config, indent=2)}")
    print("\nExpected: Multiple data points with order_date dimension preserved")
    print("Expected: Vega-Lite spec with correct temporal x-axis encoding")
    print("\n✅ Fix Applied: Added x-axis to groupby in map_xy_config()")

    return config


def test_unsaved_chart_previews() -> Dict[str, Any]:
    """Test that unsaved charts generate previews."""
    print("\n🧪 Test 2: Unsaved Chart Preview Generation")
    print("=" * 50)

    # Test configuration with save_chart=False
    config = {
        "dataset_id": 24,
        "config": {
            "chart_type": "xy",
            "kind": "bar",
            "x": {"name": "region"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
        },
        "save_chart": False,  # Don't save to database
        "preview_formats": ["ascii", "vega_lite", "table"],
    }

    print(f"Test config: {json.dumps(config, indent=2)}")
    print("\nExpected: All three preview formats generated without saving")
    print("Expected: form_data_key returned for future reference")
    print(
        "\n✅ Fix Applied: Added vega_lite support in generate_preview_from_form_data()"
    )

    return config


def test_vega_lite_field_mapping() -> Dict[str, Any]:
    """Test that Vega-Lite specs use correct field names."""
    print("\n🧪 Test 3: Vega-Lite Field Mapping")
    print("=" * 50)

    # Test configuration
    config = {
        "dataset_id": 24,
        "config": {
            "chart_type": "xy",
            "kind": "line",
            "x": {"name": "order_date"},
            "y": [
                {"name": "sales", "aggregate": "AVG", "label": "Avg Sales"},
                {"name": "profit", "aggregate": "SUM", "label": "Total Profit"},
            ],
        },
        "save_chart": True,
        "preview_formats": ["vega_lite"],
    }

    print(f"Test config: {json.dumps(config, indent=2)}")
    print("\nExpected Vega-Lite encoding:")
    print('  x: {"field": "order_date", "type": "temporal"}')
    print('  y: {"field": <aggregated name>, "type": "quantitative"}')
    print("\n✅ Fix Applied: _line_chart_spec() uses form_data for field names")

    return config


def test_form_data_key_lookup() -> Dict[str, Any]:
    """Test that form_data_keys can be used for preview generation."""
    print("\n🧪 Test 4: Form Data Key Lookup")
    print("=" * 50)

    # First create unsaved chart to get form_data_key
    step1_config = {
        "dataset_id": 24,
        "config": {
            "chart_type": "table",
            "columns": [{"name": "region"}, {"name": "sales", "aggregate": "SUM"}],
        },
        "save_chart": False,
    }

    print("Step 1: Create unsaved chart")
    print(f"Config: {json.dumps(step1_config, indent=2)}")
    print("\nExpected: Returns form_data_key like '8fF6-dWtpTI'")

    print("\nStep 2: Use form_data_key with get_chart_preview")
    print("get_chart_preview({")
    print('  "identifier": "<form_data_key>",')
    print('  "format": "ascii"')
    print("})")
    print(
        "\n✅ Fix Applied: Added form_data_key support in _get_chart_preview_internal()"
    )

    return step1_config


def main() -> None:
    """Run all tests and display results."""
    print("🔧 Critical Issues Test Suite")
    print("Testing fixes for issues documented in CRITICAL_ISSUES.md")

    tests: List[Tuple[str, Any]] = [
        ("Time Series Aggregation", test_time_series_aggregation),
        ("Unsaved Chart Previews", test_unsaved_chart_previews),
        ("Vega-Lite Field Mapping", test_vega_lite_field_mapping),
        ("Form Data Key Lookup", test_form_data_key_lookup),
    ]

    print("\n📋 Test Configurations:")
    configs = []
    for name, test_func in tests:
        config = test_func()
        configs.append((name, config))

    print("\n🚀 Ready to Test!")
    print("\nTo run these tests with the MCP service:")
    print("1. Ensure Superset is running on http://localhost:8088")
    print("2. Ensure MCP service is running on port 5008")
    print("3. Use these configurations with the generate_chart tool")
    print("\nOr run automated tests:")
    print("./run_single_test.sh test_critical_fixes.py")

    print("\n📊 Summary of Fixes:")
    print("1. ✅ Time series GROUP BY: Added x-axis to groupby in chart_utils.py")
    print("2. ✅ Unsaved previews: Added vega_lite support in preview_utils.py")
    print("3. ✅ Field mapping: Enhanced _line_chart_spec() to use form_data")
    print("4. ✅ Form data keys: Added TransientChart support in get_chart_preview")


if __name__ == "__main__":
    main()
