#!/usr/bin/env python3
"""
Test script for MCP proxy endpoint integration.

This script tests the MCP proxy blueprint to ensure it properly
proxies requests to the FastMCP service.
"""

import logging
import sys

import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
SUPERSET_URL = "http://localhost:8088"
MCP_PROXY_URL = f"{SUPERSET_URL}/api/v1/mcp"
FASTMCP_URL = "http://localhost:5008"

# Test credentials (adjust as needed)
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin"


def login_to_superset() -> str:
    """Login to Superset and get access token."""
    login_url = f"{SUPERSET_URL}/api/v1/security/login"

    login_data = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "provider": "db",
        "refresh": True,
    }

    logger.info("Logging into Superset...")
    response = requests.post(login_url, json=login_data)

    if response.status_code == 200:
        token = response.json().get("access_token")
        logger.info("Successfully logged in to Superset")
        return token
    else:
        logger.error("Failed to login: %s", response.text)
        sys.exit(1)


def test_health_endpoint() -> bool:
    """Test the MCP proxy health endpoint."""
    logger.info("Testing MCP proxy health endpoint...")

    try:
        response = requests.get(f"{MCP_PROXY_URL}/_health", timeout=10)

        if response.status_code == 200:
            health_data = response.json()
            logger.info("Health check passed: %s", health_data)
            return True
        else:
            logger.error("Health check failed: %s", response.text)
            return False

    except requests.exceptions.RequestException as e:
        logger.error("Health check request failed: %s", e)
        return False


def test_info_endpoint(token: str) -> bool:
    """Test the MCP proxy info endpoint."""
    logger.info("Testing MCP proxy info endpoint...")

    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(f"{MCP_PROXY_URL}/_info", headers=headers, timeout=10)

        if response.status_code == 200:
            info_data = response.json()
            logger.info("Info endpoint successful: %s", info_data)
            return True
        else:
            logger.error("Info endpoint failed: %s", response.text)
            return False

    except requests.exceptions.RequestException as e:
        logger.error("Info request failed: %s", e)
        return False


def test_mcp_tools_list(token: str) -> bool:
    """Test proxying MCP tools/list request."""
    logger.info("Testing MCP tools/list proxy...")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # MCP JSON-RPC request
    mcp_request = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}

    try:
        response = requests.post(
            f"{MCP_PROXY_URL}/tools/list", headers=headers, json=mcp_request, timeout=10
        )

        if response.status_code == 200:
            tools_data = response.json()
            logger.info(
                "Tools list successful, found %d tools",
                len(tools_data.get("result", {}).get("tools", [])),
            )
            return True
        else:
            logger.error("Tools list failed: %s", response.text)
            return False

    except requests.exceptions.RequestException as e:
        logger.error("Tools list request failed: %s", e)
        return False


def test_direct_fastmcp() -> bool:
    """Test direct connection to FastMCP service for comparison."""
    logger.info("Testing direct FastMCP connection...")

    try:
        # Test health endpoint
        health_response = requests.get(f"{FASTMCP_URL}/health", timeout=5)
        if health_response.status_code == 200:
            logger.info("FastMCP service is running and healthy")
            return True
        else:
            logger.error("FastMCP health check failed: %s", health_response.text)
            return False

    except requests.exceptions.RequestException as e:
        logger.error("FastMCP connection failed: %s", e)
        return False


def run_tests() -> bool:
    """Run all tests and return overall success status."""
    logger.info("Starting MCP proxy integration tests...")

    tests_passed = 0
    total_tests = 0

    # Test 1: Direct FastMCP connection
    total_tests += 1
    if test_direct_fastmcp():
        tests_passed += 1
        logger.info("✅ Direct FastMCP test passed")
    else:
        logger.error("❌ Direct FastMCP test failed")

    # Test 2: Health endpoint (no auth required)
    total_tests += 1
    if test_health_endpoint():
        tests_passed += 1
        logger.info("✅ Health endpoint test passed")
    else:
        logger.error("❌ Health endpoint test failed")

    # Get auth token for authenticated tests
    try:
        token = login_to_superset()
    except Exception as e:
        logger.error("Failed to get auth token: %s", e)
        logger.info("Final results: %d/%d tests passed", tests_passed, total_tests)
        return tests_passed == total_tests

    # Test 3: Info endpoint (auth required)
    total_tests += 1
    if test_info_endpoint(token):
        tests_passed += 1
        logger.info("✅ Info endpoint test passed")
    else:
        logger.error("❌ Info endpoint test failed")

    # Test 4: MCP tools/list proxy (auth required)
    total_tests += 1
    if test_mcp_tools_list(token):
        tests_passed += 1
        logger.info("✅ MCP tools/list proxy test passed")
    else:
        logger.error("❌ MCP tools/list proxy test failed")

    # Summary
    logger.info("=" * 50)
    logger.info("Final results: %d/%d tests passed", tests_passed, total_tests)

    if tests_passed == total_tests:
        logger.info("🎉 All tests passed! MCP proxy is working correctly.")
        return True
    else:
        logger.error("💥 Some tests failed. Check the logs above.")
        return False


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
