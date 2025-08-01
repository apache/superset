#!/usr/bin/env python3

import sys
from pathlib import Path
from typing import Any

import requests

# Get API key - adjust path since we're now in tests/integration_tests/mcp_service
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
import superset_config

API_KEY = getattr(superset_config, "ANTHROPIC_API_KEY", "")


def run_mcp_test(test_name: str, prompt: str) -> bool:
    """Run a single MCP test"""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
    }

    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}],
        "mcp_servers": [
            {
                "type": "url",
                "url": "https://fe649c61424c.ngrok-free.app/mcp",  # update this
                "name": "superset-mcp",
            }
        ],
    }

    print(f"\n{'=' * 60}")
    print(f"Test: {test_name}")
    print(f"{'=' * 60}")
    print(f"Prompt: {prompt}")

    response = requests.post(
        "https://api.anthropic.com/v1/messages", headers=headers, json=data, timeout=30
    )

    if response.status_code == 200:
        result = response.json()
        content = result.get("content", [])
        if content:
            _display_response_content(content)
            return _validate_test_results(content, prompt)
        return True
    else:
        print(f"❌ FAILED: Status {response.status_code}")
        print(f"Error: {response.text}")
        return False


def _display_response_content(content: list[dict[str, Any]]) -> None:
    """Display all parts of the API response"""
    print("\nFull Response:")
    print("=" * 80)

    for i, item in enumerate(content):
        item_type = item.get("type", "unknown")
        print(f"\n[Part {i + 1}: {item_type}]")

        if item_type == "text":
            print(item.get("text", ""))
        elif item_type == "mcp_tool_use":
            print(f"Tool Called: {item.get('name', 'unknown')}")
            print(f"Input: {item.get('input', {})}")
        elif item_type == "mcp_tool_result":
            _display_tool_result(item)
        else:
            print(f"Unknown content type: {item}")

    print("=" * 80)


def _display_tool_result(item: dict[str, Any]) -> None:
    """Display tool result content"""
    is_error = item.get("is_error", False)
    tool_content = item.get("content", [])

    if is_error:
        print(f"❌ Tool Error: {tool_content}")
    else:
        print("✅ Tool Result:")
        for result_item in tool_content:
            result_text = result_item.get("text", "")
            display_text = (
                result_text[:1000] + "..." if len(result_text) > 1000 else result_text
            )
            print(display_text)


def _validate_test_results(content: list[dict[str, Any]], prompt: str) -> bool:
    """Validate test results based on prompt content"""
    found_datasets = _check_for_datasets(content)
    found_tools = _check_for_tools(content)

    if "available tools" in prompt.lower():
        if found_tools:
            print("✅ SUCCESS: Found MCP tools in response")
            return True
        else:
            print("❌ FAILED: No MCP tools found")
            return False
    elif "list_datasets" in prompt.lower():
        if found_datasets:
            print("✅ SUCCESS: Found dataset results")
            return True
        else:
            print("❌ FAILED: No datasets returned")
            return False
    return True


def _check_for_datasets(content: list[dict[str, Any]]) -> bool:
    """Check if response contains dataset information"""
    dataset_terms = ["datasets", "users_channels", "cleaned_sales_data"]

    for item in content:
        if item.get("type") == "text":
            text = item.get("text", "")
            if any(term in text for term in dataset_terms):
                return True
        elif item.get("type") == "mcp_tool_result":
            for result_item in item.get("content", []):
                result_text = result_item.get("text", "")
                if any(term in result_text for term in dataset_terms):
                    return True
    return False


def _check_for_tools(content: list[dict[str, Any]]) -> bool:
    """Check if response contains tool information"""
    for item in content:
        if item.get("type") == "text":
            text = item.get("text", "")
            if "list_datasets" in text and "generate_chart" in text:
                return True
    return False


# Run tests
print("MCP Beta Tests with Anthropic API")
print("Using ngrok URL: https://c9194e831563.ngrok-free.app")

# Test 1: List available tools
run_mcp_test("List Available Tools", "What tools do you have available? List them all.")

# Test 2: Call list_datasets
run_mcp_test(
    "List Datasets",
    "Use the list_datasets tool with page_size=3 to show the first 3 datasets.",
)
