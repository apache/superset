#!/usr/bin/env python3
"""
Test runner for markdown test plans
Executes test cases from MD files against Anthropic MCP beta API
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

import requests

# Get API key
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
import superset_config

API_KEY = getattr(superset_config, "ANTHROPIC_API_KEY", "")


def extract_test_cases(md_file: Path) -> List[Tuple[str, str]]:
    """Extract test cases from markdown file"""
    content = md_file.read_text()

    # Look for patterns like:
    # Test: Description
    # ```
    # prompt text
    # ```
    pattern = r"Test:\s*(.+?)\n```(?:\w+)?\n(.*?)\n```"
    matches = re.findall(pattern, content, re.DOTALL)

    return [(desc.strip(), prompt.strip()) for desc, prompt in matches]


def run_mcp_test(test_name: str, prompt: str) -> bool:
    """Execute single test against MCP API"""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
    }

    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
        "mcp_servers": [
            {
                "type": "url",
                "url": "https://fe649c61424c.ngrok-free.app/mcp",
                "name": "superset-mcp",
            }
        ],
    }

    print(f"\n{'=' * 60}")
    print(f"Test: {test_name}")
    print(f"{'=' * 60}")
    print(f"Prompt: {prompt}")
    print("-" * 40)

    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=data,
            timeout=60,
        )

        if response.status_code == 200:
            result = response.json()
            content = result.get("content", [])

            # Look for tool usage and results
            tool_used = False
            for item in content:
                if item.get("type") == "mcp_tool_use":
                    tool_used = True
                    print(f"✅ Tool Called: {item['name']}")
                elif item.get("type") == "mcp_tool_result":
                    if item.get("is_error"):
                        error_text = item.get("content", [{}])[0].get("text", "Unknown")
                        print(f"❌ Tool Error: {error_text}")
                        return False
                    else:
                        print("✅ Tool Success")
                elif item.get("type") == "text":
                    # Show first 200 chars of response
                    text = item.get("text", "")
                    print(f"Response: {text[:200]}...")

            if tool_used:
                print("✅ PASSED")
                return True
            else:
                print("❌ FAILED: No MCP tools used")
                return False
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Error: {response.text}")
            return False

    except Exception as e:
        print(f"❌ FAILED: Exception {e}")
        return False


def run_test_plan(
    md_file: Path, limit: int | None = None, output_file: str | None = None
) -> None:
    """Execute all tests from markdown file"""
    import contextlib
    import io
    from datetime import datetime

    # Capture output
    output_buffer = io.StringIO()

    with contextlib.redirect_stdout(output_buffer):
        print(f"Running test plan: {md_file.name}")
        print(f"Started at: {datetime.now().isoformat()}")
        print(f"{'=' * 80}")

        test_cases = extract_test_cases(md_file)

        if not test_cases:
            print("❌ No test cases found in markdown file")
            return

        if limit:
            test_cases = test_cases[:limit]
            print(f"Running first {limit} tests only")

        print(f"Found {len(test_cases)} test cases")

        passed = 0
        failed = 0

        for i, (test_name, prompt) in enumerate(test_cases, 1):
            if run_mcp_test(f"{i}. {test_name}", prompt):
                passed += 1
            else:
                failed += 1

        print(f"\n{'=' * 80}")
        print(f"SUMMARY: {passed} passed, {failed} failed")
        print(f"Completed at: {datetime.now().isoformat()}")
        print(f"{'=' * 80}")

    # Get captured output
    output_content = output_buffer.getvalue()

    # Print to console
    print(output_content)

    # Save to file if specified
    if output_file:
        with open(output_file, "w") as f:
            f.write(output_content)
        print(f"Results saved to: {output_file}")
    else:
        # Auto-generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        auto_file = f"test_results_{md_file.stem}_{timestamp}.txt"
        with open(auto_file, "w") as f:
            f.write(output_content)
        print(f"Results auto-saved to: {auto_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_test_plan.py <test_plan.md> [limit] [output_file]")
        print("Example: python run_test_plan.py poc_test.md")
        print("Example: python run_test_plan.py poc_test.md 3")
        print("Example: python run_test_plan.py poc_test.md 3 results.txt")
        sys.exit(1)

    test_file = Path(sys.argv[1])
    limit = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None
    output_file = sys.argv[3] if len(sys.argv) > 3 else None

    if not test_file.exists():
        print(f"Error: {test_file} not found")
        sys.exit(1)

    run_test_plan(test_file, limit, output_file)
