#!/usr/bin/env python3
"""
MCP Test Runner - Execute test plans using Claude API or CLI

This script can run MCP test plans either using Claude CLI (if available)
or directly via the Anthropic API for CI environments.
"""

import argparse
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

from superset.utils import json

try:
    from anthropic import Anthropic

    HAS_ANTHROPIC_SDK = True
except ImportError:
    HAS_ANTHROPIC_SDK = False

# Configuration
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"
DEFAULT_MCP_URL = "http://localhost:5008"
DEFAULT_SUPERSET_URL = "http://localhost:8088"


class TestRunner:
    def __init__(self, test_plan: str, output_dir: str = "test_results"):
        self.test_plan = Path(test_plan)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Check for Claude CLI or API
        self.has_cli = self._check_claude_cli()
        self.client = None
        if not self.has_cli and HAS_ANTHROPIC_SDK:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if api_key:
                self.client = Anthropic(api_key=api_key)

        self.results: List[Dict[str, Any]] = []

    def _check_claude_cli(self) -> bool:
        """Check if Claude CLI is available"""
        try:
            subprocess.run(["claude", "--version"], capture_output=True, check=True)  # noqa: S603,S607
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def check_services(self) -> bool:
        """Check if required services are running"""
        print("Checking services...")

        # Check Superset
        superset_url = os.environ.get("SUPERSET_URL", DEFAULT_SUPERSET_URL)
        try:
            import requests

            response = requests.get(f"{superset_url}/health", timeout=5)
            if response.status_code == 200:
                print(f"✓ Superset is running at {superset_url}")
            else:
                raise Exception(f"Superset returned status {response.status_code}")
        except Exception as e:
            print(f"✗ Superset is not accessible at {superset_url}")
            print(f"  Error: {e}")
            return False

        # Check MCP Service (it might not have a health endpoint)
        mcp_url = os.environ.get("MCP_SERVICE_URL", DEFAULT_MCP_URL)
        try:
            # Try to check if port is open
            import socket

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(("localhost", 5008))
            sock.close()
            if result == 0:
                print(f"✓ MCP Service port is open at {mcp_url}")
            else:
                raise Exception("Port 5008 is not open")
        except Exception as e:
            print(f"✗ MCP Service is not accessible at {mcp_url}")
            print(f"  Error: {e}")
            return False

        return True

    def extract_test_cases(self) -> List[Tuple[str, str]]:
        """Extract test cases from markdown file"""
        with open(self.test_plan, "r") as f:
            content = f.read()

        test_cases = []

        # Pattern to match test blocks
        # Looking for patterns like:
        # Test: Description
        # ```
        # test content
        # ```
        pattern = r"Test:\s*(.+?)\n```(?:\w+)?\n(.*?)\n```"

        matches = re.findall(pattern, content, re.DOTALL)

        for description, test_content in matches:
            # Clean up the test content
            test_content = test_content.strip()
            # Skip if it's just a request/response example
            if test_content.startswith("Request:") or test_content.startswith(
                "Expected:"
            ):
                continue
            test_cases.append((description.strip(), test_content))

        # Also look for simpler test patterns
        simple_pattern = r"Test:\s*(.+?)(?:\n|$)"
        simple_matches = re.findall(simple_pattern, content)

        for match in simple_matches:
            if not any(match in case[0] for case in test_cases):
                # This is a test description without code block
                test_cases.append((match, match))

        return test_cases

    def run_test_with_cli(self, description: str, prompt: str) -> Tuple[bool, str]:
        """Run test using Claude CLI"""
        full_prompt = f"""You have access to Superset MCP tools. {prompt}

Important:
- Always display any URLs returned by the tools
- For preview tests, attempt to embed images when possible
- Use the available MCP tools to complete this test
- Provide clear success/failure indication"""

        try:
            # Claude CLI is a trusted tool for test automation
            cmd = ["claude", "--allowedTools", "mcp__*", "-p", full_prompt]
            result = subprocess.run(  # noqa: S603,S607
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            output = result.stdout + result.stderr
            success = result.returncode == 0 and "error" not in output.lower()

            return success, output

        except subprocess.TimeoutExpired:
            return False, "Test timed out after 30 seconds"
        except Exception as e:
            return False, f"Error running test: {str(e)}"

    def run_test_with_api(self, description: str, prompt: str) -> Tuple[bool, str]:
        """Run test using Anthropic API directly"""
        if not self.client:
            return False, "Anthropic API client not initialized"

        full_prompt = f"""You have access to Superset MCP tools via MCP proxy. {prompt}

The MCP service is available and you can use these tools:
- list_dashboards, get_dashboard_info, generate_dashboard
- list_charts, get_chart_info, generate_chart, get_chart_data, get_chart_preview
- list_datasets, get_dataset_info
- And more...

Important:
- Always display any URLs returned by the tools
- For preview tests, show the preview URLs
- Use the MCP tools to complete this test
- Indicate clearly if the test passed or failed"""

        try:
            message = self.client.messages.create(
                model=DEFAULT_MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": full_prompt}],
            )

            output = message.content[0].text if message.content else "No response"

            # Simple success detection
            success = any(
                keyword in output.lower()
                for keyword in ["success", "created", "generated", "found", "retrieved"]
            ) and not any(
                keyword in output.lower()
                for keyword in ["error", "failed", "not found", "exception"]
            )

            return success, output

        except Exception as e:
            return False, f"API Error: {str(e)}"

    def run_test(self, description: str, prompt: str) -> Tuple[bool, str]:
        """Run a single test case"""
        print(f"\n{'=' * 80}")
        print(f"Running: {description}")
        print(f"{'-' * 80}")
        print("Input prompt:")
        print(prompt[:500] + "..." if len(prompt) > 500 else prompt)
        print(f"{'-' * 80}")

        if self.has_cli:
            success, output = self.run_test_with_cli(description, prompt)
        elif self.client:
            success, output = self.run_test_with_api(description, prompt)
        else:
            return False, "No Claude CLI or API available"

        # Print output
        print("Output:")
        print(output[:1000] + "..." if len(output) > 1000 else output)
        print(f"{'-' * 80}")

        # Save output
        output_file = self.output_dir / f"test_{len(self.results) + 1}.out"
        with open(output_file, "w") as f:
            f.write(f"Test: {description}\n")
            f.write(f"Status: {'PASSED' if success else 'FAILED'}\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            f.write("-" * 80 + "\n")
            f.write("Input:\n")
            f.write(prompt)
            f.write("\n" + "-" * 80 + "\n")
            f.write("Output:\n")
            f.write(output)

        # Extract URLs from output
        if urls := re.findall(r"(https?://[^\s]+)", output):
            print(f"URLs found: {', '.join(urls[:3])}")

        print(f"Status: {'✓ PASSED' if success else '✗ FAILED'}")
        print(f"{'=' * 80}\n")

        return success, output

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests in the test plan"""
        if not self.check_services():
            print("Required services are not running. Exiting.")
            return {"success": False, "message": "Services not available"}

        print(f"\nExtracting tests from {self.test_plan.name}...")
        test_cases = self.extract_test_cases()

        if not test_cases:
            print("No test cases found in the test plan")
            return {"success": False, "message": "No test cases found"}

        print(f"Found {len(test_cases)} test cases")

        passed = 0
        failed = 0

        for description, prompt in test_cases:
            success, output = self.run_test(description, prompt)

            self.results.append(
                {"description": description, "success": success, "output": output}
            )

            if success:
                passed += 1
            else:
                failed += 1

            # Small delay between tests
            time.sleep(1)

        # Generate report
        self.generate_report(passed, failed)

        return {
            "success": failed == 0,
            "total": len(test_cases),
            "passed": passed,
            "failed": failed,
            "report": str(self.output_dir / "report.html"),
        }

    def generate_report(self, passed: int, failed: int) -> None:
        """Generate HTML report"""
        report_path = self.output_dir / "report.html"

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>MCP Test Results - {self.test_plan.name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .summary {{ background: #f0f0f0; padding: 15px; border-radius: 5px; }}
        .passed {{ color: green; font-weight: bold; }}
        .failed {{ color: red; font-weight: bold; }}
        .test {{ margin: 20px 0; border: 1px solid #ddd;
                 padding: 15px; border-radius: 5px; }}
        .test-passed {{ border-left: 5px solid green; }}
        .test-failed {{ border-left: 5px solid red; }}
        .output {{ background: #f5f5f5; padding: 10px; margin-top: 10px;
                  border-radius: 3px; font-family: monospace; font-size: 0.9em;
                  max-height: 300px; overflow-y: auto; }}
        .url {{ color: blue; text-decoration: underline; }}
    </style>
</head>
<body>
    <h1>MCP Test Results</h1>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Test Plan:</strong> {self.test_plan.name}</p>
        <p><strong>Executed:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
        <p><strong>Total Tests:</strong> {len(self.results)}</p>
        <p><span class="passed">Passed: {passed}</span> |
           <span class="failed">Failed: {failed}</span></p>
    </div>

    <h2>Test Results</h2>
"""

        for i, result in enumerate(self.results, 1):
            status_class = "test-passed" if result["success"] else "test-failed"
            status_text = "PASSED" if result["success"] else "FAILED"

            # Highlight URLs in output
            output = result["output"]
            output = re.sub(
                r"(https?://[^\s]+)", r'<span class="url">\1</span>', output
            )

            html += f"""
    <div class="test {status_class}">
        <h3>Test {i}: {result["description"]}</h3>
        <p><strong>Status:</strong> <span class="{
                "passed" if result["success"] else "failed"
            }">{status_text}</span></p>
        <div class="output">
            <pre>{output[:1000]}{"..." if len(output) > 1000 else ""}</pre>
        </div>
    </div>
"""

        html += """
</body>
</html>"""

        with open(report_path, "w") as f:
            f.write(html)

        print(f"\nReport generated: {report_path}")

        # Also generate JSON report for CI
        json_report = {
            "test_plan": str(self.test_plan),
            "timestamp": datetime.now().isoformat(),
            "summary": {"total": len(self.results), "passed": passed, "failed": failed},
            "results": self.results,
        }

        json_path = self.output_dir / "report.json"
        with open(json_path, "w") as f:
            f.write(json.dumps(json_report, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run MCP test plans")
    parser.add_argument("test_plan", help="Path to test plan markdown file")
    parser.add_argument("--output-dir", default="test_results", help="Output directory")
    parser.add_argument(
        "--api-key", help="Anthropic API key (or use ANTHROPIC_API_KEY env var)"
    )

    args = parser.parse_args()

    if args.api_key:
        os.environ["ANTHROPIC_API_KEY"] = args.api_key

    # Check if we have a way to run tests
    runner = TestRunner(args.test_plan, args.output_dir)

    if not runner.has_cli and not runner.client:
        print("Error: No Claude CLI found and no Anthropic API key provided")
        print("Please either:")
        print("  1. Install Claude CLI: https://github.com/anthropics/claude-cli")
        print("  2. Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    # Run tests
    results = runner.run_all_tests()

    # Print summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Report: {results['report']}")

    # Exit with appropriate code
    sys.exit(0 if results["success"] else 1)


if __name__ == "__main__":
    main()
