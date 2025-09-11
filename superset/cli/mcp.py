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
"""CLI module for MCP service"""

import os
import re
import secrets
import sys
from pathlib import Path

import click
import requests
from colorama import Fore, Style
from flask import current_app
from flask.cli import with_appcontext

from superset import security_manager
from superset.mcp_service.server import run_server


@click.group()
def mcp() -> None:
    """Model Context Protocol service commands"""
    pass


@mcp.command()
@click.option("--host", default="127.0.0.1", help="Host to bind to")
@click.option("--port", default=5008, help="Port to bind to")
@click.option("--debug", is_flag=True, help="Enable debug mode")
@click.option("--sql-debug", is_flag=True, help="Enable SQL query logging")
def run(host: str, port: int, debug: bool, sql_debug: bool) -> None:
    """Run the MCP service"""
    if sql_debug:
        os.environ["SQLALCHEMY_DEBUG"] = "1"
        click.echo("🔍 SQL Debug mode enabled")

    run_server(host=host, port=port, debug=debug)


@mcp.command()
@click.option("--force", is_flag=True, help="Force setup even if configuration exists")
@click.option("--skip-config", is_flag=True, help="Skip configuration file setup")
@click.option("--skip-examples", is_flag=True, help="Skip loading example datasets")
@with_appcontext
def setup(force: bool, skip_config: bool, skip_examples: bool) -> None:
    """Set up MCP service for Apache Superset"""
    click.echo(f"{Fore.CYAN}=== Apache Superset MCP Service Setup ==={Style.RESET_ALL}")
    click.echo()

    # Check if already set up
    config_path = Path("superset_config.py")

    # 1. Configuration file setup
    if not skip_config:
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

    # 2. Database check
    try:
        # Check if database is initialized using ORM

        from flask_appbuilder.security.sqla.models import User

        User.query.count()  # This will fail if tables don't exist
        click.echo(f"{Fore.GREEN}✓ Database already initialized{Style.RESET_ALL}")

        # Check for admin user
        admin_exists = security_manager.find_user(username="admin")
        if admin_exists:
            click.echo(f"{Fore.GREEN}✓ Admin user already exists{Style.RESET_ALL}")
        else:
            if click.confirm("Create admin user (admin/admin)?"):
                _create_admin_user()
    except Exception as e:
        click.echo(
            f"{Fore.YELLOW}Database not initialized: {e}. "
            f"Run 'superset db upgrade' and 'superset init' first.{Style.RESET_ALL}"
        )
        sys.exit(1)

    # 3. Example data
    if not skip_examples:
        if click.confirm("Load example datasets?"):
            click.echo("Loading example datasets...")
            from superset.cli.examples import load_examples

            load_examples()
            click.echo(f"{Fore.GREEN}✓ Example datasets loaded{Style.RESET_ALL}")

    # 4. Verify Superset configuration
    _verify_superset_config()

    # 5. Show final instructions
    click.echo()
    click.echo(f"{Fore.GREEN}=== Setup Complete! ==={Style.RESET_ALL}")
    click.echo()
    click.echo("To start Superset:")
    click.echo(
        "  1. In terminal 1: superset run -p 9001 --with-threads --reload --debugger"
    )
    click.echo("  2. In terminal 2: cd superset-frontend && npm run dev-server")
    click.echo("  3. Open http://localhost:9001")
    click.echo("  4. Login with admin/admin")
    click.echo()
    click.echo("To start MCP service:")
    click.echo("  superset mcp run")
    click.echo()
    if _check_csrf_issue():
        click.echo(
            f"{Fore.YELLOW}Note: If you encounter login loops, "
            f"edit superset_config.py and set:{Style.RESET_ALL}"
        )
        click.echo("  WTF_CSRF_ENABLED = False")


def _create_config_file(config_path: Path) -> None:
    """Create a new superset_config.py file"""
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
"""

    config_path.write_text(config_content)
    click.echo(f"{Fore.GREEN}✓ Created superset_config.py{Style.RESET_ALL}")


def _update_config_file(config_path: Path) -> None:
    """Update existing config file with missing settings"""
    content = config_path.read_text()
    updated = False

    # Check for missing settings
    if "SECRET_KEY" not in content:
        click.echo("Adding SECRET_KEY...")
        content = f"SECRET_KEY = '{secrets.token_urlsafe(42)}'\n" + content
        updated = True

    if "MCP_ADMIN_USERNAME" not in content:
        click.echo("Adding MCP configuration...")
        content += "\n# MCP Service Configuration\n"
        content += "MCP_ADMIN_USERNAME = 'admin'\n"
        content += "MCP_DEV_USERNAME = 'admin'\n"
        content += "SUPERSET_WEBSERVER_ADDRESS = 'http://localhost:9001'\n"
        updated = True

    if "WEBDRIVER_BASEURL" not in content:
        click.echo("Adding WebDriver configuration...")
        content += "\n# WebDriver Configuration for screenshots\n"
        content += "WEBDRIVER_BASEURL = 'http://localhost:9001/'\n"
        content += "WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL\n"
        updated = True

    if updated:
        config_path.write_text(content)
        click.echo(f"{Fore.GREEN}✓ Configuration updated{Style.RESET_ALL}")


def _create_admin_user() -> None:
    """Create admin user"""
    from superset.utils.decorators import transaction

    click.echo("Creating admin user...")
    click.echo("Username: admin")
    click.echo("Password: admin")

    @transaction()
    def create_user() -> bool:
        admin_user = security_manager.add_user(
            username="admin",
            first_name="Admin",
            last_name="User",
            email="admin@localhost",
            role=security_manager.find_role("Admin"),
            password="admin",  # noqa: S106
        )
        return bool(admin_user)

    if create_user():
        click.echo(f"{Fore.GREEN}✓ Admin user created{Style.RESET_ALL}")
    else:
        click.echo(f"{Fore.RED}Failed to create admin user{Style.RESET_ALL}")


def _check_csrf_issue() -> bool:
    """Check if CSRF might be an issue"""
    try:
        return current_app.config.get("WTF_CSRF_ENABLED", True)
    except Exception:  # noqa: S110
        return True


def _verify_superset_config() -> None:
    """Verify Superset configuration and check if it's running"""
    click.echo()
    click.echo("Verifying configuration...")

    # Check if config file exists and has required settings
    config_path = Path("superset_config.py")
    if not config_path.exists():
        click.echo(f"{Fore.RED}✗ superset_config.py not found{Style.RESET_ALL}")
        return

    content = config_path.read_text()
    _check_config_settings(content)

    # Check if Superset is running
    webserver_address = _get_webserver_address(content)
    _check_superset_running(webserver_address)


def _check_config_settings(content: str) -> None:
    """Check required configuration settings"""
    settings_status = []

    if "SECRET_KEY" in content:
        settings_status.append(f"{Fore.GREEN}✓ SECRET_KEY configured{Style.RESET_ALL}")
    else:
        settings_status.append(f"{Fore.RED}✗ SECRET_KEY missing{Style.RESET_ALL}")

    if "SUPERSET_WEBSERVER_ADDRESS" in content:
        settings_status.append(
            f"{Fore.GREEN}✓ SUPERSET_WEBSERVER_ADDRESS configured{Style.RESET_ALL}"
        )
    else:
        settings_status.append(
            f"{Fore.YELLOW}⚠ SUPERSET_WEBSERVER_ADDRESS not set "
            f"(defaulting to http://localhost:9001){Style.RESET_ALL}"
        )

    for status in settings_status:
        click.echo(f"  {status}")


def _get_webserver_address(content: str) -> str:
    """Extract webserver address from config or use default"""
    if "SUPERSET_WEBSERVER_ADDRESS" in content:
        match = re.search(
            r'SUPERSET_WEBSERVER_ADDRESS\s*=\s*["\']([^"\']+)["\']', content
        )
        if match:
            return match.group(1)
    return "http://localhost:9001"


def _check_superset_running(webserver_address: str) -> None:
    """Check if Superset is running at the given address"""
    click.echo()
    click.echo("Checking if Superset is running...")

    try:
        response = requests.get(f"{webserver_address}/health", timeout=2)
        if response.status_code == 200:
            click.echo(
                f"{Fore.GREEN}✓ Superset is running at "
                f"{webserver_address}{Style.RESET_ALL}"
            )
        else:
            click.echo(
                f"{Fore.YELLOW}⚠ Superset responded with "
                f"status {response.status_code}{Style.RESET_ALL}"
            )
    except requests.exceptions.ConnectionError:
        click.echo(
            f"{Fore.YELLOW}⚠ Superset is not running at "
            f"{webserver_address}{Style.RESET_ALL}"
        )
        click.echo("  Start it with: make flask-app (in another terminal)")
    except Exception as e:
        click.echo(
            f"{Fore.YELLOW}⚠ Could not check Superset status: {e}{Style.RESET_ALL}"
        )
