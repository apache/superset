#!/bin/bash
# Simple script to run a single test from a test plan using Claude CLI

# Usage: ./run_single_test.sh "Test description to find"
# Example: ./run_single_test.sh "List all dashboards"

set -e

TEST_DESCRIPTION="$1"
TEST_PLAN="${2:-MCP_CHART_TEST_PLAN.md}"

if [ -z "$TEST_DESCRIPTION" ]; then
    echo "Usage: $0 \"Test description\" [test_plan.md]"
    echo "Example: $0 \"List all charts\" MCP_CHART_TEST_PLAN.md"
    exit 1
fi

echo "Searching for test: $TEST_DESCRIPTION"
echo "In test plan: $TEST_PLAN"
echo "---"

# Extract the test content
TEST_CONTENT=$(awk -v desc="$TEST_DESCRIPTION" '
    $0 ~ desc {
        found=1;
        next
    }
    found && /^```/ {
        in_block=!in_block;
        if (!in_block && found_content) exit;
        next
    }
    found && in_block {
        found_content=1;
        print
    }
' "$TEST_PLAN")

if [ -z "$TEST_CONTENT" ]; then
    echo "Test not found. Available tests in $TEST_PLAN:"
    grep "^Test:" "$TEST_PLAN" | head -10
    exit 1
fi

echo "Found test content:"
echo "$TEST_CONTENT"
echo "---"
echo "Running with Claude..."

# Run with Claude CLI
claude --allowedTools "mcp__*" -p "You have access to Superset MCP tools. $TEST_CONTENT

Important:
- Always display any URLs returned by the tools
- Use the MCP tools to complete this test
- Show clear success/failure indication"
