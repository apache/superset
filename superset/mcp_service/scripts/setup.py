# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Setup utilities for MCP service configuration"""

import secrets
from pathlib import Path

import click
from colorama import Fore, Style


def run_setup(force: bool) -> None:
    """Set up MCP service configuration for Apache Superset"""
    click.echo(f"{Fore.CYAN}=== Apache Superset MCP Service Setup ==={Style.RESET_ALL}")
    click.echo()

    # Check if already set up
    config_path = Path("superset_config.py")

    # Configuration file setup
    if config_path.exists() and not force:
        click.echo(
            f"{Fore.YELLOW}⚠️  superset_config.py already exists{Style.RESET_ALL}"
        )
        if click.confirm("Do you want to check/add missing MCP settings?"):
            _update_config_file(config_path)
        else:
            click.echo("Keeping existing configuration")
    else:
        _create_config_file(config_path)

    click.echo()
    click.echo(f"{Fore.GREEN}=== Setup Complete! ==={Style.RESET_ALL}")
    click.echo()
    click.echo("To start MCP service:")
    click.echo("  superset mcp run")


def _create_config_file(config_path: Path) -> None:
    """Create a new superset_config.py file with MCP configuration"""
    click.echo("Creating new superset_config.py...")

    config_content = f"""# Apache Superset Configuration
SECRET_KEY = '{secrets.token_urlsafe(42)}'

# Session configuration for local development
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_NAME = 'superset_session'
PERMANENT_SESSION_LIFETIME = 86400

# CSRF Protection (disable if login loop occurs)
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = None

# MCP Service Configuration
MCP_ADMIN_USERNAME = 'admin'
MCP_DEV_USERNAME = 'admin'
SUPERSET_WEBSERVER_ADDRESS = 'http://localhost:9001'

# WebDriver Configuration for screenshots
WEBDRIVER_BASEURL = 'http://localhost:9001/'
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

# Feature flags
FEATURE_FLAGS = {{
    "MCP_SERVICE": True,
}}

# MCP Service Host/Port
MCP_SERVICE_HOST = "localhost"
MCP_SERVICE_PORT = 5008
"""

    config_path.write_text(config_content)
    click.echo(f"{Fore.GREEN}✓ Created superset_config.py{Style.RESET_ALL}")


def _update_config_file(config_path: Path) -> None:
    """Update existing config file with missing MCP settings"""
    content = config_path.read_text()
    updated = False
    additions = []

    # Check for missing settings
    if "SECRET_KEY" not in content:
        additions.append(f"SECRET_KEY = '{secrets.token_urlsafe(42)}'")
        updated = True

    # Add MCP configuration block if missing
    if "MCP_ADMIN_USERNAME" not in content:
        additions.append("\n# MCP Service Configuration")
        additions.append("MCP_ADMIN_USERNAME = 'admin'")
        additions.append("MCP_DEV_USERNAME = 'admin'")
        additions.append("SUPERSET_WEBSERVER_ADDRESS = 'http://localhost:9001'")
        updated = True

    # Add WebDriver configuration if missing
    if "WEBDRIVER_BASEURL" not in content:
        additions.append("\n# WebDriver Configuration for screenshots")
        additions.append("WEBDRIVER_BASEURL = 'http://localhost:9001/'")
        additions.append("WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL")
        updated = True

    # Add feature flags if missing
    if "MCP_SERVICE" not in content:
        # Check if FEATURE_FLAGS exists
        if "FEATURE_FLAGS" in content:
            # Need to update existing FEATURE_FLAGS
            click.echo("Updating FEATURE_FLAGS to enable MCP_SERVICE...")
            # This is more complex - would need careful regex replacement
            # For now, just append a note
            additions.append("\n# Enable MCP Service feature flag")
            additions.append("# Add 'MCP_SERVICE': True to your FEATURE_FLAGS dict")
        else:
            additions.append("\n# Feature flags")
            additions.append("FEATURE_FLAGS = {")
            additions.append('    "MCP_SERVICE": True,')
            additions.append("}")
        updated = True

    # Add MCP host/port if missing
    if "MCP_SERVICE_HOST" not in content:
        additions.append("\n# MCP Service Host/Port")
        additions.append('MCP_SERVICE_HOST = "localhost"')
        additions.append("MCP_SERVICE_PORT = 5008")
        updated = True

    if updated:
        # Append all additions to the file
        if additions:
            content += "\n" + "\n".join(additions) + "\n"
            config_path.write_text(content)
            click.echo(f"{Fore.GREEN}✓ Configuration updated{Style.RESET_ALL}")
