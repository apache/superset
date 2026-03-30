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
"""Marshmallow schemas for the combined datasource list endpoint."""

from __future__ import annotations

from marshmallow import fields, Schema

from superset.connectors.sqla.models import SqlaTable
from superset.semantic_layers.models import SemanticView


class _ChangedBySchema(Schema):
    first_name = fields.String()
    last_name = fields.String()


class _OwnerSchema(Schema):
    id = fields.Integer()
    first_name = fields.String()
    last_name = fields.String()


class _DatabaseSchema(Schema):
    id = fields.Integer()
    database_name = fields.String()


class DatasetListSchema(Schema):
    """Serializes a SqlaTable ORM object for the combined list response."""

    id = fields.Integer()
    uuid = fields.Method("get_uuid")
    table_name = fields.String()
    kind = fields.String()
    source_type = fields.Constant("database")
    description = fields.String(allow_none=True)
    explore_url = fields.String()
    database = fields.Method("get_database")
    schema = fields.String(allow_none=True)
    sql = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    owners = fields.Method("get_owners")
    changed_by_name = fields.String()
    changed_by = fields.Method("get_changed_by")
    changed_on_delta_humanized = fields.Method("get_changed_on_delta_humanized")
    changed_on_utc = fields.Method("get_changed_on_utc")

    def get_uuid(self, obj: SqlaTable) -> str:
        return str(obj.uuid)

    def get_database(self, obj: SqlaTable) -> dict[str, object] | None:
        if not obj.database:
            return None
        return _DatabaseSchema().dump(
            {"id": obj.database_id, "database_name": obj.database.database_name}
        )

    def get_owners(self, obj: SqlaTable) -> list[dict[str, object]]:
        return _OwnerSchema(many=True).dump(
            [
                {"id": o.id, "first_name": o.first_name, "last_name": o.last_name}
                for o in obj.owners
            ]
        )

    def get_changed_by(self, obj: SqlaTable) -> dict[str, object] | None:
        if not obj.changed_by:
            return None
        return _ChangedBySchema().dump(
            {
                "first_name": obj.changed_by.first_name,
                "last_name": obj.changed_by.last_name,
            }
        )

    def get_changed_on_delta_humanized(self, obj: SqlaTable) -> str:
        return obj.changed_on_delta_humanized()

    def get_changed_on_utc(self, obj: SqlaTable) -> str:
        return obj.changed_on_utc()


class SemanticViewListSchema(Schema):
    """Serializes a SemanticView ORM object for the combined list response."""

    id = fields.Integer()
    uuid = fields.Method("get_uuid")
    table_name = fields.Method("get_table_name")
    kind = fields.Constant("semantic_view")
    source_type = fields.Constant("semantic_layer")
    description = fields.String(allow_none=True)
    explore_url = fields.String()
    database = fields.Constant(None)
    schema = fields.Constant(None)
    sql = fields.Constant(None)
    extra = fields.Constant(None)
    owners = fields.Constant([])
    changed_by_name = fields.String()
    changed_by = fields.Method("get_changed_by")
    changed_on_delta_humanized = fields.Method("get_changed_on_delta_humanized")
    changed_on_utc = fields.Method("get_changed_on_utc")
    cache_timeout = fields.Integer(allow_none=True)

    def get_uuid(self, obj: SemanticView) -> str:
        return str(obj.uuid)

    def get_table_name(self, obj: SemanticView) -> str:
        return obj.name

    def get_changed_by(self, obj: SemanticView) -> dict[str, object] | None:
        if not obj.changed_by:
            return None
        return _ChangedBySchema().dump(
            {
                "first_name": obj.changed_by.first_name,
                "last_name": obj.changed_by.last_name,
            }
        )

    def get_changed_on_delta_humanized(self, obj: SemanticView) -> str:
        return obj.changed_on_delta_humanized()

    def get_changed_on_utc(self, obj: SemanticView) -> str:
        return obj.changed_on_utc()
