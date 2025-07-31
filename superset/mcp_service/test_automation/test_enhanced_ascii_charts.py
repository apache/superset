#!/usr/bin/env python3
"""
Test enhanced ASCII chart generation with improved visuals
"""

from superset.mcp_service.chart.tool.get_chart_preview import (
    _generate_ascii_bar_chart,
    _generate_ascii_line_chart,
    _generate_ascii_table,
)


def test_enhanced_ascii_charts() -> None:
    """Test the enhanced ASCII chart generation."""
    print("🎨 Testing Enhanced ASCII Chart Generation")
    print("=" * 60)

    # Test horizontal bar chart with varied data
    print("\n1. 📊 Enhanced Bar Chart (Horizontal)")
    print("-" * 50)
    bar_data = [
        {"region": "North America", "revenue": 2500000},
        {"region": "Europe", "revenue": 1800000},
        {"region": "Asia Pacific", "revenue": 3200000},
        {"region": "South America", "revenue": 950000},
        {"region": "Africa", "revenue": 720000},
        {"region": "Middle East", "revenue": 1300000},
    ]

    bar_chart = _generate_ascii_bar_chart(bar_data, 80, 20)
    print(bar_chart)

    # Test vertical bar chart with shorter labels
    print("\n\n2. 📊 Enhanced Bar Chart (Vertical)")
    print("-" * 50)
    vertical_data = [
        {"month": "Jan", "sales": 1000},
        {"month": "Feb", "sales": 1200},
        {"month": "Mar", "sales": 800},
        {"month": "Apr", "sales": 1500},
        {"month": "May", "sales": 1800},
        {"month": "Jun", "sales": 1600},
    ]

    vertical_chart = _generate_ascii_bar_chart(vertical_data, 80, 25)
    print(vertical_chart)

    # Test enhanced line chart
    print("\n\n3. 📈 Enhanced Line Chart with Trend Analysis")
    print("-" * 50)
    line_data = [
        {"date": "2024-01", "revenue": 50000, "customers": 120},
        {"date": "2024-02", "revenue": 55000, "customers": 135},
        {"date": "2024-03", "revenue": 48000, "customers": 118},
        {"date": "2024-04", "revenue": 62000, "customers": 155},
        {"date": "2024-05", "revenue": 68000, "customers": 168},
        {"date": "2024-06", "revenue": 72000, "customers": 180},
        {"date": "2024-07", "revenue": 75000, "customers": 190},
        {"date": "2024-08", "revenue": 73000, "customers": 185},
        {"date": "2024-09", "revenue": 78000, "customers": 195},
        {"date": "2024-10", "revenue": 82000, "customers": 205},
    ]

    line_chart = _generate_ascii_line_chart(line_data, 80, 25)
    print(line_chart)

    # Test enhanced table
    print("\n\n4. 📋 Enhanced Data Table")
    print("-" * 50)
    table_data = [
        {
            "product_name": "Laptop Pro",
            "price": 1299.99,
            "units_sold": 156,
            "revenue": 202798.44,
            "category": "Electronics",
        },
        {
            "product_name": "Wireless Mouse",
            "price": 29.99,
            "units_sold": 890,
            "revenue": 26691.10,
            "category": "Accessories",
        },
        {
            "product_name": "Mechanical Keyboard",
            "price": 149.99,
            "units_sold": 234,
            "revenue": 35097.66,
            "category": "Accessories",
        },
        {
            "product_name": "Gaming Monitor",
            "price": 399.99,
            "units_sold": 89,
            "revenue": 35599.11,
            "category": "Electronics",
        },
        {
            "product_name": "USB Hub",
            "price": 19.99,
            "units_sold": 445,
            "revenue": 8895.55,
            "category": "Accessories",
        },
        {
            "product_name": "Webcam HD",
            "price": 79.99,
            "units_sold": 167,
            "revenue": 13358.33,
            "category": "Electronics",
        },
        {
            "product_name": "Desk Lamp",
            "price": 45.50,
            "units_sold": 78,
            "revenue": 3549.00,
            "category": "Office",
        },
        {
            "product_name": "Office Chair",
            "price": 299.00,
            "units_sold": 45,
            "revenue": 13455.00,
            "category": "Office",
        },
        {
            "product_name": "Tablet Stand",
            "price": 24.99,
            "units_sold": 203,
            "revenue": 5072.97,
            "category": "Accessories",
        },
        {
            "product_name": "Bluetooth Speaker",
            "price": 89.99,
            "units_sold": 134,
            "revenue": 12058.66,
            "category": "Electronics",
        },
    ]

    table = _generate_ascii_table(table_data, 100)
    print(table)

    print("\n\n🎉 ASCII Chart Enhancement Summary:")
    print("=" * 60)
    print("✅ Enhanced Features:")
    print("   • Horizontal AND vertical bar charts (smart auto-selection)")
    print("   • Gradient bar effects based on value intensity")
    print("   • Professional Unicode box-drawing characters")
    print("   • Smart number formatting (K, M suffixes)")
    print("   • Proper scaling and axis labels")
    print("   • Line charts with connected segments and trend analysis")
    print("   • Tables with intelligent column selection and summaries")
    print("   • Emojis and better visual hierarchy")
    print("   • Responsive layouts that adapt to content")
    print("   • Statistical insights and data analysis")
    print("\n🚀 Much more engaging than basic table dumps!")


if __name__ == "__main__":
    test_enhanced_ascii_charts()
