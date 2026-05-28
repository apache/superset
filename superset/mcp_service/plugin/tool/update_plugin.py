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
from superset.mcp_service.plugin.schemas import (
    UpdatePluginRequest,
    UpdatePluginResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="DynamicPlugin",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update a dynamic plugin",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_plugin(
    request: UpdatePluginRequest, ctx: Context
) -> UpdatePluginResponse:
    """Update an existing dynamic plugin's name, key, or bundle URL.

    Requires admin write access to DynamicPlugin and the DYNAMIC_PLUGINS
    feature flag to be enabled. At least one of ``name``, ``key``, or
    ``bundle_url`` must be provided; only the supplied fields are changed.

    Use ``create_plugin`` to look up the plugin ID if you only know the key.
    """
    await ctx.info("Updating dynamic plugin: id=%s" % (request.id,))

    try:
        from sqlalchemy.exc import IntegrityError

        from superset import is_feature_enabled
        from superset.extensions import db
        from superset.models.dynamic_plugins import DynamicPlugin

        if not is_feature_enabled("DYNAMIC_PLUGINS"):
            await ctx.warning("DYNAMIC_PLUGINS feature flag is not enabled")
            return UpdatePluginResponse(
                error=(
                    "The DYNAMIC_PLUGINS feature flag is not enabled on this instance."
                )
            )

        with event_logger.log_context(action="mcp.update_plugin.lookup"):
            plugin = db.session.get(DynamicPlugin, request.id)

        if plugin is None:
            await ctx.warning("Plugin not found: id=%s" % (request.id,))
            return UpdatePluginResponse(
                error="No plugin found with id=%d. "
                "Use the plugin ID returned by create_plugin." % request.id
            )

        if request.name is not None:
            plugin.name = request.name
        if request.key is not None:
            plugin.key = request.key
        if request.bundle_url is not None:
            plugin.bundle_url = request.bundle_url

        with event_logger.log_context(action="mcp.update_plugin.save"):
            db.session.commit()

        await ctx.info(
            "Dynamic plugin updated: id=%s, key=%r" % (plugin.id, plugin.key)
        )

        return UpdatePluginResponse(
            id=plugin.id,
            name=plugin.name,
            key=plugin.key,
            bundle_url=plugin.bundle_url,
        )

    except IntegrityError as exc:
        db.session.rollback()
        msg = str(exc.orig) if exc.orig else str(exc)
        await ctx.warning("Plugin update failed (duplicate field): %s" % (msg,))
        return UpdatePluginResponse(
            error=(
                "A plugin with the same name, key, or bundle_url already exists. "
                "Each field must be unique."
            )
        )
    except Exception as exc:
        db.session.rollback()
        await ctx.error(
            "Unexpected error updating plugin: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
