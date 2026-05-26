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

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.tag.schemas import CreateTagRequest, CreateTagResponse

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Tag",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create a tag",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_tag(request: CreateTagRequest, ctx: Context) -> CreateTagResponse:
    """Create a new custom tag in Superset, optionally applying it to objects.

    Use this tool to create tags for organizing charts, dashboards, datasets,
    and queries. Tags can be applied to multiple objects at creation time.

    Workflow:
    1. Call this tool with a tag name and optional description
    2. Optionally provide objects_to_tag to apply the tag immediately
    3. Use the returned ``id`` to reference the tag in future operations
    """
    # name is already stripped by the schema validator
    name = request.name

    await ctx.info("Creating tag: name=%r" % (name,))

    try:
        from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
        from superset.commands.tag.exceptions import (
            TagCreateFailedError,
            TagInvalidError,
        )
        from superset.daos.tag import TagDAO

        with event_logger.log_context(action="mcp.create_tag.create"):
            properties = {
                "name": name,
                "description": request.description or "",
                "objects_to_tag": request.objects_to_tag,
            }
            # bulk_create=True preserves any existing tag/object relationships
            # that are not included in this call (non-destructive create).
            objects_tagged, objects_skipped = CreateCustomTagWithRelationshipsCommand(
                properties, bulk_create=True
            ).run()

        tag = TagDAO.find_by_name(name)

        await ctx.info(
            "Tag created: id=%s, name=%r, objects_tagged=%d, objects_skipped=%d"
            % (
                tag.id if tag else None,
                name,
                len(objects_tagged),
                len(objects_skipped),
            )
        )

        return CreateTagResponse(
            id=tag.id if tag else None,
            name=name,
            description=tag.description if tag else request.description,
            objects_tagged=sorted(objects_tagged),
            objects_skipped=sorted(objects_skipped),
        )

    except TagInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Tag validation failed: %s" % (messages,))
        return CreateTagResponse(
            id=None,
            name=name,
            description=request.description,
            error=str(messages),
        )
    except TagCreateFailedError as exc:
        await ctx.error("Tag creation failed: %s" % (str(exc),))
        return CreateTagResponse(
            id=None,
            name=name,
            description=request.description,
            error=f"Failed to create tag: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating tag: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
