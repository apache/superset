# MCP Test Automation Guide

This guide explains how to run MCP test plans automatically, both locally and in CI/CD environments.

## Overview

We have multiple test plans that validate the MCP service functionality:
- `MCP_CHART_TEST_PLAN.md` - Comprehensive chart tool testing
- `ENTITY_TESTING_PLAN.md` - Entity listing and filtering tests
- Dashboard, dataset, and system tool test plans

These can be executed using:
1. **Claude CLI** (`claude -p "..."`) - For local development
2. **Anthropic API** - For CI/CD automation
3. **GitHub Codespaces** - For consistent test environments

## 🚀 Quick Start

### Local Development

```bash
# 1. Start Superset and MCP Service
superset run -p 8088 --with-threads --reload --debugger &
superset mcp run --port 5008 --debug &

# 2. Run tests with the shell script
cd superset/mcp_service
chmod +x run_mcp_tests.sh
./run_mcp_tests.sh MCP_CHART_TEST_PLAN.md

# Or use Python script for more control
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md
```

### Using Claude CLI

If you have Claude CLI installed:

```bash
# Run a specific test
claude -p "You have access to Superset MCP tools. List all dashboards and show their URLs."

# Run from a test plan
claude -p "$(cat MCP_CHART_TEST_PLAN.md | sed -n '/Test: List all charts/,/Expected:/p')"
```

### GitHub Codespaces

1. Open the repository in GitHub Codespaces
2. The environment will auto-setup using `.devcontainer/setup-mcp-tests.sh`
3. Run tests:

```bash
# Start services
./start_mcp_tests.sh

# Run test plan
cd superset/mcp_service
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md
```

## 📋 Test Scripts

### `run_mcp_tests.sh`

Shell script that:
- Checks service availability
- Extracts test cases from markdown
- Runs tests using Claude CLI
- Generates HTML report

**Usage:**
```bash
./run_mcp_tests.sh [TEST_PLAN.md]

# Environment variables
export MCP_SERVICE_URL=http://localhost:5008
export SUPERSET_URL=http://localhost:8088
export OUTPUT_DIR=test_results
```

### `run_mcp_tests.py`

Python script with more features:
- Works with Claude CLI or Anthropic API
- Better test extraction
- JSON and HTML reports
- CI-friendly output

**Usage:**
```bash
# With Anthropic API
export ANTHROPIC_API_KEY=your-key
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md

# Specify output directory
python run_mcp_tests.py ENTITY_TESTING_PLAN.md --output-dir results

# With API key as argument
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md --api-key sk-ant-...
```

## 🔄 CI/CD Integration

### GitHub Actions

The `.github/workflows/mcp-tests.yml` workflow:
- Runs on PRs that modify MCP service
- Sets up PostgreSQL and Redis
- Initializes Superset with test data
- Runs specified test plans
- Comments results on PR

**Trigger manually:**
```yaml
# Via GitHub UI: Actions → MCP Service Tests → Run workflow
# Select test plan: MCP_CHART_TEST_PLAN.md, ENTITY_TESTING_PLAN.md, or ALL
```

### Running in CI

The CI environment:
1. Uses PostgreSQL instead of SQLite
2. Loads Superset example data
3. Disables MCP authentication
4. Captures all output and logs

## 📊 Test Reports

Reports are generated in the `test_results/` directory:

### HTML Report (`report.html`)
- Visual pass/fail summary
- Individual test results
- Extracted URLs and key outputs
- Execution timestamps

### JSON Report (`report.json`)
- Machine-readable format
- Suitable for CI parsing
- Contains full test outputs

## 🧪 Writing Test Cases

Test plans should follow this format:

```markdown
Test: Clear description of what to test
\```
Actual prompt or test instruction
\```
Expected: What should happen
Action: What to verify (e.g., "DISPLAY THE URL")
```

The test runners will:
1. Extract test descriptions and prompts
2. Add MCP context to prompts
3. Execute via Claude
4. Validate responses
5. Generate reports

## 🔧 Troubleshooting

### Services Not Running
```bash
# Check Superset
curl http://localhost:8088/health

# Check MCP Service  
lsof -i :5008

# View logs
tail -f /tmp/superset.log
tail -f /tmp/mcp.log
```

### No Claude CLI
- Install from: https://github.com/anthropics/claude-cli
- Or use `ANTHROPIC_API_KEY` with the Python script
- CI environments use API by default

### Test Failures
- Check service logs for errors
- Verify test data is loaded
- Ensure proper authentication setup
- Review extracted test cases in `test_results/`

## 🚦 Test Plan Coverage

| Test Plan | Coverage | Tools Tested |
|-----------|----------|--------------|
| MCP_CHART_TEST_PLAN.md | Complete | All 9 chart tools + dashboard integration |
| ENTITY_TESTING_PLAN.md | Systematic | list_* tools with all parameter combinations |
| Dashboard Tests | Via Promptimize | Dashboard CRUD + layouts |
| Integration Tests | End-to-end | Multi-tool workflows |

## 💡 Best Practices

1. **Run services first** - Ensure Superset and MCP are healthy
2. **Use test data** - Load consistent example data
3. **Check URLs** - Verify all returned URLs are valid
4. **Review reports** - Don't just check pass/fail
5. **Iterate quickly** - Use focused test subsets during development

## 🎯 Next Steps

1. **Set up API key** for automated testing
2. **Configure CI** to run on your PRs  
3. **Add custom tests** for new features
4. **Monitor results** in GitHub Actions

The goal is to have confidence that the MCP service works correctly with real AI agents, not just unit tests!
