#!/bin/bash

echo "Testing Claude CLI with MCP tools..."
echo "========================================"
echo "This demonstrates that Claude CLI fails to properly pass parameters to MCP tools"
echo ""

# Test 1: List available tools
echo "Test 1: List Available Tools"
echo "========================================"
echo "Command: claude -p \"What tools do you have available? List them all.\" --dangerously-skip-permissions"
claude -p "What tools do you have available? List them all." --dangerously-skip-permissions

echo ""
echo "========================================"
echo ""

# Test 2: Call list_datasets
echo "Test 2: List Datasets"
echo "========================================"
echo "Command: claude -p \"Use the list_datasets tool to show all available datasets.\" --dangerously-skip-permissions"
claude -p "Use the list_datasets tool to show all available datasets." --dangerously-skip-permissions

echo ""
echo "========================================"
echo "Result: Claude CLI cannot properly serialize MCP tool parameters"
echo "The tools expect {\"request\": {...}} but CLI sends malformed JSON"
