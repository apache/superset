#!/usr/bin/env python3
"""
Production Health Check for MCP Service
Verifies service availability and basic functionality
"""

import os
import subprocess
import sys
from datetime import datetime
from typing import Any, Dict

import requests

# Configuration
DEFAULT_MCP_URL = "http://localhost:5008"
DEFAULT_SUPERSET_URL = "http://localhost:8088"
TIMEOUT = 10


def check_service_health() -> Dict[str, Any]:
    """Check health of required services"""
    health: Dict[str, Any] = {"timestamp": datetime.now().isoformat(), "services": {}}

    # Check Superset
    superset_url = os.environ.get("SUPERSET_URL", DEFAULT_SUPERSET_URL)
    try:
        response = requests.get(f"{superset_url}/health", timeout=TIMEOUT)
        health["services"]["superset"] = {
            "status": "healthy" if response.status_code == 200 else "unhealthy",
            "url": superset_url,
            "response_time": response.elapsed.total_seconds(),
            "status_code": response.status_code,
        }
    except Exception as e:
        health["services"]["superset"] = {
            "status": "unhealthy",
            "url": superset_url,
            "error": str(e),
        }

    # Check MCP Service port
    mcp_url = os.environ.get("MCP_SERVICE_URL", DEFAULT_MCP_URL)
    try:
        import socket

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(("localhost", 5008))
        sock.close()

        health["services"]["mcp"] = {
            "status": "healthy" if result == 0 else "unhealthy",
            "url": mcp_url,
            "port_open": result == 0,
        }
    except Exception as e:
        health["services"]["mcp"] = {
            "status": "unhealthy",
            "url": mcp_url,
            "error": str(e),
        }

    return health


def test_basic_mcp_functionality() -> Dict[str, Any]:
    """Test basic MCP functionality using Claude CLI"""
    test_result = {
        "timestamp": datetime.now().isoformat(),
        "test": "basic_mcp_functionality",
        "status": "unknown",
    }

    try:
        # Simple test to verify MCP tools are accessible
        cmd = [
            "claude",
            "--allowedTools",
            "mcp__*",
            "-p",
            "Use list_datasets tool to get first 3 datasets. Show count.",
        ]
        result = subprocess.run(  # noqa: S603,S607
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )

        output = result.stdout + result.stderr

        if result.returncode == 0 and "error" not in output.lower():
            test_result["status"] = "passed"
            test_result["response_length"] = str(len(output))
        else:
            test_result["status"] = "failed"
            test_result["error"] = output[:500]

    except subprocess.TimeoutExpired:
        test_result["status"] = "failed"
        test_result["error"] = "Test timed out after 30 seconds"
    except Exception as e:
        test_result["status"] = "failed"
        test_result["error"] = str(e)

    return test_result


def main() -> None:
    """Run health checks and basic functionality test"""
    print("🏥 MCP Service Health Check")
    print("=" * 40)

    # Check service health
    health = check_service_health()

    print(f"Timestamp: {health['timestamp']}")
    print()

    all_healthy = True
    for service, status in health["services"].items():
        status_icon = "✅" if status["status"] == "healthy" else "❌"
        print(f"{status_icon} {service.upper()}: {status['status']}")
        if status["status"] != "healthy":
            all_healthy = False
            if "error" in status:
                print(f"   Error: {status['error']}")

    print()

    if not all_healthy:
        print("❌ Services are not healthy. Skipping functionality test.")
        sys.exit(1)

    # Test basic functionality
    print("🧪 Testing basic MCP functionality...")
    test_result = test_basic_mcp_functionality()

    status_icon = "✅" if test_result["status"] == "passed" else "❌"
    print(f"{status_icon} MCP Functionality: {test_result['status']}")

    if test_result["status"] != "passed":
        print(f"   Error: {test_result.get('error', 'Unknown error')}")
        sys.exit(1)

    print()
    print("🎉 All checks passed! MCP service is healthy and functional.")


if __name__ == "__main__":
    main()
