# Superset Development with GitHub Codespaces

For complete documentation on using GitHub Codespaces with Apache Superset, please see:

**[Setting up a Development Environment - GitHub Codespaces](https://superset.apache.org/docs/contributing/development#github-codespaces-cloud-development)**

## Pre-installed Development Environment

When you create a new Codespace from this repository, it automatically:

1. **Creates a Python virtual environment** using `uv venv`
2. **Installs all development dependencies** via `uv pip install -r requirements/development.txt`
3. **Sets up pre-commit hooks** with `pre-commit install`
4. **Activates the virtual environment** automatically in all terminals

The virtual environment is located at `/workspaces/{repository-name}/.venv` and is automatically activated through environment variables set in the devcontainer configuration.
