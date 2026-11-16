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

"""Compact, access-filtered source discovery without contacting a provider."""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.semantic_layer import SemanticViewDAO
from superset.mcp_service.dataset_scope import (
    get_dataset_scope,
    MCPDatasetScopeError,
    UNSUPPORTED_TOOL_ERROR,
)
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.semantic_layer.schemas import (
    ListSemanticViewsRequest,
    SemanticLayerError,
    SemanticViewPage,
    SemanticViewSource,
    SemanticViewSummary,
)
from superset.semantic_layers.access import (
    is_semantic_layers_enabled,
    SemanticLayersDisabledError,
)


@tool(
    tags=["discovery", "semantic"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="List semantic views",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
@requires_data_model_metadata_access
async def list_semantic_views(
    request: ListSemanticViewsRequest | None = None,
    ctx: Context | None = None,
) -> SemanticViewPage | SemanticLayerError:
    """Search permitted semantic source summaries before loading any members.

    Wrap parameters in ``request``. Search matches stored names/descriptions.
    Pages start at 1, default to 25 and allow at most 100 sources. Continue with
    ``next_page`` and the same search/page_size. No totals, schemas, credentials,
    member counts or provider requests are included. A summary is not a claim
    that the provider is configured, queryable or supported by a given consumer.
    Use selected-view metadata tools only when member details are needed.
    """
    if not is_semantic_layers_enabled():
        return SemanticLayerError.create(
            error=SemanticLayersDisabledError.message,
            error_type="SemanticLayersDisabledError",
        )
    if not user_can_view_data_model_metadata():
        return SemanticLayerError.create(
            error="You don't have permission to access dataset details for your role.",
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
        )
    # The auth hook also refuses this tool in dataset-scoped mode. Retain the
    # guard for direct service callers: semantic views are not SQL datasets.
    if get_dataset_scope() is not None:
        raise MCPDatasetScopeError(UNSUPPORTED_TOOL_ERROR)
    request = request or ListSemanticViewsRequest()
    rows = SemanticViewDAO.find_accessible_summaries(
        search=request.search,
        offset=(request.page - 1) * request.page_size,
        limit=request.page_size + 1,
    )
    has_more = len(rows) > request.page_size
    return SemanticViewPage(
        sources=[
            SemanticViewSummary(
                source=SemanticViewSource(id=row.id),
                uuid=row.uuid,
                name=row.name,
                provider=row.provider,
            )
            for row in rows[: request.page_size]
        ],
        page=request.page,
        page_size=request.page_size,
        has_more=has_more,
        next_page=request.page + 1 if has_more else None,
    )
