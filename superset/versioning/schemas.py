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
"""Shared Marshmallow schemas for entity version history endpoints.

Consumed by ChartRestApi, DashboardRestApi, and DatasetRestApi — the response
shape is identical across all three resources, so the schemas live here to
avoid triplicated definitions.
"""

from __future__ import annotations

from marshmallow import fields, Schema


class VersionChangedBySchema(Schema):
    """Subset of the User model included in each version history entry."""

    id = fields.Integer()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class VersionChangeRecordSchema(Schema):
    """One field-level diff hunk from ``version_changes``.

    The frontend renders human-readable prose from (``kind``,
    ``from_value``, ``to_value``) via Flask-Babel. Server-side the
    shape is deliberately machine-readable only — see spec FR-019.
    """

    kind = fields.String(
        metadata={
            "description": (
                "Semantic category of the change. First-class values in V1: "
                "'filter', 'metric', 'dimension', 'column', 'chart', "
                "'time_range', 'color_palette'. Falls back to 'field' for "
                "generic scalar changes that don't map to a named kind."
            )
        },
    )
    path = fields.Raw(
        metadata={
            "description": (
                "Array of segments locating the change in the entity's state. "
                "Example: ['params', 'adhoc_filters', 'country']."
            )
        },
    )
    from_value = fields.Raw(
        allow_none=True,
        metadata={
            "description": (
                "Value at path before the save; null when the field did not exist."
            ),
        },
    )
    to_value = fields.Raw(
        allow_none=True,
        metadata={
            "description": (
                "Value at path after the save; null when the field was removed."
            ),
        },
    )


class VersionListItemSchema(Schema):
    """A single version row in the version history response."""

    version_number = fields.Integer(
        metadata={"description": "0-based position in the history, oldest first"},
    )
    transaction_id = fields.Integer(
        metadata={"description": "Underlying Continuum transaction id"},
    )
    operation_type = fields.String(
        metadata={
            "description": (
                "One of 'baseline', 'update', 'delete', 'restore'. Derived "
                "from the Continuum integer constant."
            )
        },
    )
    issued_at = fields.DateTime(
        metadata={"description": "UTC timestamp of the commit that produced the row"},
    )
    changed_by = fields.Nested(
        VersionChangedBySchema,
        allow_none=True,
        metadata={
            "description": (
                "User who produced the version, or null when the commit had no "
                "authenticated Flask user (CLI, Celery, import)."
            )
        },
    )
    changes = fields.List(
        fields.Nested(VersionChangeRecordSchema),
        metadata={
            "description": (
                "Structured diff records describing the atomic field-level "
                "changes at this version, ordered by emission sequence. "
                "Empty for baseline (op=0) transactions per spec M4."
            )
        },
    )


class VersionListResponseSchema(Schema):
    """Envelope for version list responses."""

    result = fields.List(fields.Nested(VersionListItemSchema))
    count = fields.Integer()
