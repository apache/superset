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
"""Mixin for APIs that need custom_tags optimization with frontend compatibility."""

from typing import Any

from flask import current_app, request, Response
from werkzeug.datastructures import ImmutableMultiDict


class CustomTagsOptimizationMixin:
    """Reusable mixin for APIs that optimize tag queries via custom_tags relationship.

    When enabled via config, this mixin:
    1. Configures list_columns to use custom_tags (filtered relationship)
    2. Rewrites frontend requests from 'tags.*' to 'custom_tags.*'
    3. Transforms responses to rename 'custom_tags' back to 'tags'

    This provides SQL query optimization (97% reduction) while maintaining
    frontend compatibility.

    Usage:
        class MyRestApi(CustomTagsOptimizationMixin, BaseSupersetModelRestApi):
            def __init__(self):
                self._setup_custom_tags_optimization(
                    config_key="MY_API_CUSTOM_TAGS_ONLY",
                    full_columns=FULL_TAG_COLUMNS,
                    custom_columns=CUSTOM_TAG_COLUMNS,
                )
                super().__init__()
    """

    _custom_tags_only: bool

    def _setup_custom_tags_optimization(
        self,
        config_key: str,
        full_columns: list[str],
        custom_columns: list[str],
    ) -> None:
        """Configure custom tags optimization based on config.

        Args:
            config_key: Config key to check (e.g., "DASHBOARD_LIST_CUSTOM_TAGS_ONLY")
            full_columns: list_columns when optimization disabled (includes all tags)
            custom_columns: list_columns when optimization enabled (only custom_tags)
        """
        self._custom_tags_only = current_app.config.get(config_key, False)
        self.list_columns = custom_columns if self._custom_tags_only else full_columns

    def get_list(self, **kwargs: Any) -> Response:
        """Override to rewrite request parameters for custom_tags optimization.

        When config is enabled, rewrites 'tags.*' → 'custom_tags.*' in request
        so FAB can find the columns in list_columns.
        """
        if self._custom_tags_only:
            # Parse and rewrite query parameter
            query_str = request.args.get("q", "")
            if query_str and "tags." in query_str:
                # Replace 'tags.' with 'custom_tags.' in select_columns
                modified_query = query_str.replace("tags.id", "custom_tags.id")
                modified_query = modified_query.replace("tags.name", "custom_tags.name")
                modified_query = modified_query.replace("tags.type", "custom_tags.type")

                # Temporarily patch request.args
                modified_args = request.args.copy()
                modified_args["q"] = modified_query
                original_args = request.args
                request.args = ImmutableMultiDict(modified_args)

                try:
                    return super().get_list(**kwargs)  # type: ignore
                finally:
                    # Restore original args
                    request.args = original_args

        return super().get_list(**kwargs)  # type: ignore

    def pre_get_list(self, data: dict[str, Any]) -> None:
        """Rename custom_tags → tags in response for frontend compatibility.

        Called by FAB before sending the list response. This ensures the frontend
        always receives 'tags' regardless of backend optimization config.
        """
        if self._custom_tags_only and "result" in data:
            for item in data["result"]:
                if "custom_tags" in item:
                    item["tags"] = item.pop("custom_tags")

        super().pre_get_list(data)  # type: ignore
