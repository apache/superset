#!/usr/bin/env python3

import sys
from pathlib import Path

import requests

# Get API key
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
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
                "url": "https://c9194e831563.ngrok-free.app/mcp",
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
            text = content[0].get("text", "")
            # Check if it's listing tools
            if "available tools" in prompt.lower():
                if "list_datasets" in text and "generate_chart" in text:
                    print("✅ SUCCESS: Found MCP tools in response")
                    print(f"Response preview: {text[:200]}...")
                else:
                    print("❌ FAILED: No MCP tools found")
                    print(f"Response: {text[:500]}")
            # Check if it called list_datasets
            elif "list_datasets" in prompt.lower():
                if any(
                    term in text
                    for term in [
                        "datasets",
                        "users_channels",
                        "cleaned_sales_data",
                        "video_game_sales",
                    ]
                ):
                    print("✅ SUCCESS: Found dataset results")
                    print(f"Response preview: {text[:200]}...")
                else:
                    print("❌ FAILED: No datasets returned")
                    print(f"Response: {text[:500]}")
        return response.status_code == 200
    else:
        print(f"❌ FAILED: Status {response.status_code}")
        print(f"Error: {response.text}")
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
