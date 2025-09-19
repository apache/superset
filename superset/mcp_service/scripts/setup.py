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

from pathlib import Path

import click
from colorama import Fore, Style

from superset.mcp_service.mcp_config import generate_secret_key


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
SECRET_KEY = '{generate_secret_key()}'

# Import MCP configuration
from superset.mcp_service.mcp_config import get_mcp_config, MCP_FEATURE_FLAGS

# Apply MCP configuration
locals().update(get_mcp_config())

# Feature flags
FEATURE_FLAGS = MCP_FEATURE_FLAGS.copy()
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
        additions.append(f"SECRET_KEY = '{generate_secret_key()}'")
        updated = True

    # Add MCP configuration import if missing
    if "from superset.mcp_service.mcp_config import" not in content:
        additions.append("\n# Import MCP configuration")
        additions.append("from superset.mcp_service.mcp_config import (")
        additions.append("    get_mcp_config, MCP_FEATURE_FLAGS")
        additions.append(")")
        additions.append("\n# Apply MCP configuration")
        additions.append("locals().update(get_mcp_config())")
        updated = True

    # Add feature flags if missing
    if "MCP_SERVICE" not in content:
        # Check if FEATURE_FLAGS exists
        if "FEATURE_FLAGS" in content:
            # Need to update existing FEATURE_FLAGS
            click.echo("Updating FEATURE_FLAGS to enable MCP_SERVICE...")
            additions.append("\n# Enable MCP Service feature flag")
            additions.append("FEATURE_FLAGS.update(MCP_FEATURE_FLAGS)")
        else:
            additions.append("\n# Feature flags")
            additions.append("FEATURE_FLAGS = MCP_FEATURE_FLAGS.copy()")
        updated = True

    if updated:
        # Append all additions to the file
        if additions:
            content += "\n" + "\n".join(additions) + "\n"
            config_path.write_text(content)
            click.echo(f"{Fore.GREEN}✓ Configuration updated{Style.RESET_ALL}")
