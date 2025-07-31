# MCP Test Automation

This folder contains all the automated testing infrastructure for the Superset MCP service.

## 📁 Contents

### Core Test Scripts
- `run_mcp_tests.py` - **Main test runner** supporting both Claude CLI and Anthropic API
- `run_single_test.sh` - Run individual tests by description  
- `run_health_check.py` - Production health check and basic functionality test

### Test Plans
- `MCP_CHART_TEST_PLAN.md` - Comprehensive chart tool testing (all 9 tools)
- `ENTITY_TESTING_PLAN.md` - Entity listing and filtering tests

### Setup & Documentation
- `MCP_TEST_AUTOMATION_GUIDE.md` - Complete testing documentation
- `PROMPT_TESTING_PROPOSAL.md` - Test framework architecture and implementation
- `setup_claude_desktop.sh` - Claude Desktop configuration helper
- `CLAUDE_DESKTOP_SETUP.md` - Setup instructions for Claude Desktop

## 🚀 Quick Start

### Local Development
```bash
# Health check first
python run_health_check.py

# Run full test plan
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md

# Run a single test
./run_single_test.sh "List all charts"
```

### CI/CD
```bash
# With API key
export ANTHROPIC_API_KEY=sk-ant-...
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md --output-dir results
```

## 📊 Test Results

Results are saved in the `test_results/` directory:
- Individual test outputs: `test1.out`, `test2.out`, etc.
- HTML summary: `summary.html` or `report.html`
- JSON report: `report.json` (Python runner only)

## 🔧 Requirements

- Running Superset instance (port 8088)
- Running MCP service (port 5008)
- Claude CLI installed OR Anthropic API key
- Bash shell (for shell scripts)
- Python 3.9+ (for Python runner)
