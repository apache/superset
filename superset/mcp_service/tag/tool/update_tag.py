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
from superset.mcp_service.tag.schemas import UpdateTagRequest, UpdateTagResponse

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Tag",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update a tag",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_tag(request: UpdateTagRequest, ctx: Context) -> UpdateTagResponse:
    """Update an existing custom tag in Superset.

    Use this tool to rename a tag or update its description.
    Existing object associations are preserved when only name or description change.

    Workflow:
    1. Call this tool with the tag ``id`` and the fields to update
    2. Omit fields you do not want to change — they keep their current values
    3. Use the returned ``id`` to confirm the update succeeded
    """
    await ctx.info("Updating tag: id=%d" % (request.id,))

    try:
        from superset.commands.tag.exceptions import (
            TagInvalidError,
            TagNotFoundError,
        )
        from superset.commands.tag.update import UpdateTagCommand
        from superset.daos.tag import TagDAO

        existing = TagDAO.find_by_id(request.id)
        if existing is None:
            await ctx.warning("Tag not found: id=%d" % (request.id,))
            return UpdateTagResponse(
                id=None,
                name=None,
                description=None,
                error=f"Tag with id={request.id} not found",
            )

        name = request.name if request.name is not None else existing.name
        description = (
            request.description
            if request.description is not None
            else existing.description
        )

        # Preserve existing object associations. UpdateTagCommand calls
        # create_tag_relationship with bulk_create=False (destructive default),
        # so we must pass the current objects to avoid clearing them.
        existing_objects = [
            (obj.object_type.name, obj.object_id) for obj in existing.objects
        ]

        with event_logger.log_context(action="mcp.update_tag.update"):
            properties = {
                "name": name,
                "description": description,
                "objects_to_tag": existing_objects,
            }
            tag = UpdateTagCommand(request.id, properties).run()

        await ctx.info("Tag updated: id=%s, name=%r" % (tag.id if tag else None, name))

        return UpdateTagResponse(
            id=tag.id if tag else None,
            name=tag.name if tag else name,
            description=tag.description if tag else description,
        )

    except TagNotFoundError:
        await ctx.warning("Tag not found: id=%d" % (request.id,))
        return UpdateTagResponse(
            id=None,
            name=None,
            description=None,
            error=f"Tag with id={request.id} not found",
        )
    except TagInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Tag validation failed: %s" % (messages,))
        return UpdateTagResponse(
            id=None,
            name=None,
            description=None,
            error=str(messages),
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating tag: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
