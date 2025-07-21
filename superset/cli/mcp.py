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

import click

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
