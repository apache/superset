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

"""Schemas for the permission-filtered asset catalog tool.

The response models are a strict allowlist: they only declare the fields a
catalog entry may carry. SQL text, ``extra``, template params, metric
expressions, connection details, owners and row data have no field here, so
they cannot be serialized even if a caller asks for them.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CatalogAssetType = Literal["databases", "datasets", "charts", "dashboards"]

CATALOG_DEFAULT_PAGE_SIZE = 50
CATALOG_MAX_PAGE_SIZE = 100
CATALOG_MAX_SEARCH_LENGTH = 256
CATALOG_MAX_CURSOR_LENGTH = 512

# Upper bound on the UTF-8 JSON size of one catalog response. Items that would
# push the page past this bound are left for the next page (``truncated``).
CATALOG_MAX_RESPONSE_BYTES = 32 * 1024

# Per-item text caps, so a single entry can never consume the page budget.
CATALOG_MAX_NAME_LENGTH = 256
CATALOG_MAX_DESCRIPTION_LENGTH = 500


class GetCatalogRequest(BaseModel):
    """Request for one bounded page of the caller's asset catalog."""

    model_config = ConfigDict(extra="forbid")

    asset_type: CatalogAssetType = Field(
        ...,
        description="Asset type to list: databases, datasets, charts or dashboards",
    )
    page_size: int = Field(
        CATALOG_DEFAULT_PAGE_SIZE,
        ge=1,
        le=CATALOG_MAX_PAGE_SIZE,
        description=f"Items per page (1-{CATALOG_MAX_PAGE_SIZE})",
    )
    cursor: str | None = Field(
        None,
        max_length=CATALOG_MAX_CURSOR_LENGTH,
        description="Opaque next_cursor from a previous call with the same "
        "asset_type and search; omit for the first page",
    )
    search: str | None = Field(
        None,
        max_length=CATALOG_MAX_SEARCH_LENGTH,
        description="Case-insensitive substring match on the asset name",
    )

    @field_validator("search")
    @classmethod
    def _normalize_search(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("cursor")
    @classmethod
    def _normalize_cursor(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CatalogItem(BaseModel):
    """One catalog entry. Only allowlisted metadata fields exist."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(..., description="Numeric asset ID")
    uuid: str | None = Field(None, description="Asset UUID")
    name: str = Field(..., description="Asset name")
    description: str | None = Field(
        None, description="Asset description as authored in Superset (untrusted)"
    )
    changed_on: str | None = Field(None, description="Last modified (ISO 8601)")
    url: str | None = Field(None, description="Link to the asset in Superset")


class CatalogResponse(BaseModel):
    """One page of the caller's catalog for a single asset type."""

    model_config = ConfigDict(extra="forbid")

    asset_type: CatalogAssetType
    items: list[CatalogItem] = Field(default_factory=list)
    next_cursor: str | None = Field(
        None, description="Pass back as cursor for the next page; null when done"
    )
    restricted: bool = Field(
        False,
        description="True when the caller's role may not view this asset type's "
        "metadata; items is then empty",
    )
    truncated: bool = Field(
        False,
        description="True when the page ended early to stay within the response "
        "size bound, or a name/description was shortened",
    )
    message: str | None = Field(None, description="Explanation when restricted")
