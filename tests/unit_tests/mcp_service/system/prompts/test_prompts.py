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

"""Tests for MCP prompts"""

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server():
    """Fixture that returns the MCP server instance"""
    return mcp


@pytest.mark.asyncio
async def test_quickstart_prompt_exists(mcp_server):
    """Test quickstart prompt is registered and accessible"""
    async with Client(mcp_server) as client:
        # List all prompts
        prompts = await client.list_prompts()

        # Check that superset_quickstart exists
        prompt_names = [p.name for p in prompts]
        assert "superset_quickstart" in prompt_names


@pytest.mark.asyncio
async def test_quickstart_prompt_default_params(mcp_server):
    """Test quickstart prompt with default parameters"""
    async with Client(mcp_server) as client:
        # Get the prompt with defaults
        prompt = await client.get_prompt("superset_quickstart")

        # Check the response
        assert prompt is not None
        assert len(prompt.messages) > 0

        # Check that default values are reflected in the content
        # Messages have TextContent objects with 'text' attribute
        content = " ".join(
            [
                msg.content.text if hasattr(msg.content, "text") else str(msg.content)
                for msg in prompt.messages
            ]
        )
        assert "analyst" in content.lower()
        assert "general" in content.lower()


@pytest.mark.asyncio
async def test_quickstart_prompt_custom_params(mcp_server):
    """Test quickstart prompt with custom parameters"""
    async with Client(mcp_server) as client:
        # Get the prompt with custom arguments
        prompt = await client.get_prompt(
            "superset_quickstart",
            arguments={"user_type": "executive", "focus_area": "sales"},
        )

        # Check the response
        assert prompt is not None
        assert len(prompt.messages) > 0

        # Check that custom values are reflected in the content
        # Messages have TextContent objects with 'text' attribute
        content = " ".join(
            [
                msg.content.text if hasattr(msg.content, "text") else str(msg.content)
                for msg in prompt.messages
            ]
        )
        # The prompt should contain customized content based on parameters
        assert (
            "high-level dashboard" in content.lower() or "executive" in content.lower()
        )
        assert "sales" in content.lower()


@pytest.mark.asyncio
async def test_create_chart_guided_prompt_exists(mcp_server):
    """Test create_chart_guided prompt is registered and accessible"""
    async with Client(mcp_server) as client:
        # List all prompts
        prompts = await client.list_prompts()

        # Check that create_chart_guided exists
        prompt_names = [p.name for p in prompts]
        assert "create_chart_guided" in prompt_names


@pytest.mark.asyncio
async def test_create_chart_guided_prompt_default_params(mcp_server):
    """Test create_chart_guided prompt with default parameters"""
    async with Client(mcp_server) as client:
        # Get the prompt with defaults
        prompt = await client.get_prompt("create_chart_guided")

        # Check the response
        assert prompt is not None
        assert len(prompt.messages) > 0

        # Check that default values are reflected in the content
        # Messages have TextContent objects with 'text' attribute
        content = " ".join(
            [
                msg.content.text if hasattr(msg.content, "text") else str(msg.content)
                for msg in prompt.messages
            ]
        )
        assert "auto" in content.lower()
        assert "exploration" in content.lower()


@pytest.mark.asyncio
async def test_create_chart_guided_prompt_custom_params(mcp_server):
    """Test create_chart_guided prompt with custom parameters"""
    async with Client(mcp_server) as client:
        # Get the prompt with custom arguments
        prompt = await client.get_prompt(
            "create_chart_guided",
            arguments={"chart_type": "bar", "business_goal": "sales_analysis"},
        )

        # Check the response
        assert prompt is not None
        assert len(prompt.messages) > 0

        # Check that custom values are reflected in the content
        # Messages have TextContent objects with 'text' attribute
        content = " ".join(
            [
                msg.content.text if hasattr(msg.content, "text") else str(msg.content)
                for msg in prompt.messages
            ]
        )
        assert "bar" in content.lower()
        assert "sales" in content.lower()


@pytest.mark.asyncio
async def test_list_all_prompts(mcp_server):
    """Test listing all available prompts"""
    async with Client(mcp_server) as client:
        # List all prompts
        prompts = await client.list_prompts()

        # We should have at least our two prompts
        assert len(prompts) >= 2

        # Check prompt structure
        for prompt in prompts:
            assert hasattr(prompt, "name")
            assert hasattr(prompt, "description")
            assert hasattr(prompt, "arguments")
