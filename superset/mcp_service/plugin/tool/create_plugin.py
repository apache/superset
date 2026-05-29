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

from fastmcp import Context
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import is_feature_enabled
from superset.extensions import db, event_logger
from superset.mcp_service.plugin.schemas import (
    CreatePluginRequest,
    CreatePluginResponse,
)
from superset.models.dynamic_plugins import DynamicPlugin


@tool(
    tags=["mutate"],
    class_permission_name="DynamicPlugin",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Register a dynamic plugin",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_plugin(
    request: CreatePluginRequest, ctx: Context
) -> CreatePluginResponse:
    """Register a new dynamic (custom) plugin in Superset.

    Requires the DYNAMIC_PLUGINS feature flag to be enabled and DynamicPlugin
    write permission. The ``key`` must match the package name from the
    plugin's package.json and be unique across all registered plugins.

    After registration, Superset will load the plugin bundle from ``bundle_url``
    on the next page load.
    """
    await ctx.info(
        "Registering dynamic plugin: name=%r, key=%r" % (request.name, request.key)
    )

    try:
        if not is_feature_enabled("DYNAMIC_PLUGINS"):
            await ctx.warning("DYNAMIC_PLUGINS feature flag is not enabled")
            return CreatePluginResponse(
                error=(
                    "The DYNAMIC_PLUGINS feature flag is not enabled on this instance."
                )
            )

        with event_logger.log_context(action="mcp.create_plugin.create"):
            plugin = DynamicPlugin(
                name=request.name,
                key=request.key,
                bundle_url=request.bundle_url,
            )
            db.session.add(plugin)
            db.session.commit()  # pylint: disable=consider-using-transaction

        await ctx.info(
            "Dynamic plugin registered: id=%s, key=%r" % (plugin.id, plugin.key)
        )

        return CreatePluginResponse(
            id=plugin.id,
            name=plugin.name,
            key=plugin.key,
            bundle_url=plugin.bundle_url,
        )

    except IntegrityError as exc:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            pass
        msg = str(exc.orig) if exc.orig else str(exc)
        await ctx.warning("Plugin creation failed (duplicate field): %s" % (msg,))
        return CreatePluginResponse(
            error=(
                "A plugin with the same name, key, or bundle_url already exists. "
                "Each field must be unique."
            )
        )
    except Exception as exc:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            pass
        await ctx.error(
            "Unexpected error creating plugin: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
