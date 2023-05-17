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


from marshmallow import fields, Schema
from marshmallow.validate import Length, OneOf

from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.utils.core import RowLevelSecurityFilterType

id_description = "Unique if of rls filter"
name_description = "Name of rls filter"
description_description = "Detailed description"
# pylint: disable=line-too-long
filter_type_description = "Regular filters add where clauses to queries if a user belongs to a role referenced in the filter, base filters apply filters to all queries except the roles defined in the filter, and can be used to define what users can see if no RLS filters within a filter group apply to them."
tables_description = "These are the tables this filter will be applied to."
# pylint: disable=line-too-long
roles_description = "For regular filters, these are the roles this filter will be applied to. For base filters, these are the roles that the filter DOES NOT apply to, e.g. Admin if admin should see all data."
# pylint: disable=line-too-long
group_key_description = "Filters with the same group key will be ORed together within the group, while different filter groups will be ANDed together. Undefined group keys are treated as unique groups, i.e. are not grouped together. For example, if a table has three filters, of which two are for departments Finance and Marketing (group key = 'department'), and one refers to the region Europe (group key = 'region'), the filter clause would apply the filter (department = 'Finance' OR department = 'Marketing') AND (region = 'Europe')."
# pylint: disable=line-too-long
clause_description = "This is the condition that will be added to the WHERE clause. For example, to only return rows for a particular client, you might define a regular filter with the clause `client_id = 9`. To display no rows unless a user belongs to a RLS filter role, a base filter can be created with the clause `1 = 0` (always false)."

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}


class RolesSchema(Schema):
    name = fields.String()
    id = fields.Integer()


class TablesSchema(Schema):
    schema = fields.String()
    table_name = fields.String()
    id = fields.Integer()


class RLSListSchema(Schema):
    id = fields.Integer(description=id_description)
    name = fields.String(description=name_description)
    filter_type = fields.String(
        description=filter_type_description,
        validate=OneOf(
            [filter_type.value for filter_type in RowLevelSecurityFilterType]
        ),
    )
    roles = fields.List(fields.Nested(RolesSchema))
    tables = fields.List(fields.Nested(TablesSchema))
    clause = fields.String(description=clause_description)
    changed_on_delta_humanized = fields.Function(
        RowLevelSecurityFilter.created_on_delta_humanized
    )
    group_key = fields.String(description=group_key_description)
    description = fields.String(description=description_description)


class RLSShowSchema(Schema):
    id = fields.Integer(description=id_description)
    name = fields.String(description=name_description)
    filter_type = fields.String(
        description=filter_type_description,
        validate=OneOf(
            [filter_type.value for filter_type in RowLevelSecurityFilterType]
        ),
    )
    roles = fields.List(fields.Nested(RolesSchema))
    tables = fields.List(fields.Nested(TablesSchema))
    clause = fields.String(description=clause_description)
    group_key = fields.String(description=group_key_description)
    description = fields.String(description=description_description)


class RLSPostSchema(Schema):
    name = fields.String(
        description=name_description,
        required=True,
        allow_none=False,
        validate=Length(1, 255),
    )
    description = fields.String(
        description=description_description, required=False, allow_none=True
    )
    filter_type = fields.String(
        description=filter_type_description,
        required=True,
        allow_none=False,
        validate=OneOf(
            [filter_type.value for filter_type in RowLevelSecurityFilterType]
        ),
    )
    tables = fields.List(
        fields.Integer(),
        description=tables_description,
        required=True,
        allow_none=False,
        validate=Length(1),
    )
    roles = fields.List(
        fields.Integer(), description=roles_description, required=True, allow_none=False
    )
    group_key = fields.String(
        description=group_key_description, required=False, allow_none=True
    )
    clause = fields.String(
        description=clause_description, required=True, allow_none=False
    )


class RLSPutSchema(Schema):
    name = fields.String(
        description=name_description,
        required=False,
        allow_none=False,
        validate=Length(1, 255),
    )
    description = fields.String(
        description=description_description, required=False, allow_none=True
    )
    filter_type = fields.String(
        description=filter_type_description,
        required=False,
        allow_none=False,
        validate=OneOf(
            [filter_type.value for filter_type in RowLevelSecurityFilterType]
        ),
    )
    tables = fields.List(
        fields.Integer(),
        description=tables_description,
        required=False,
        allow_none=False,
    )
    roles = fields.List(
        fields.Integer(),
        description=roles_description,
        required=False,
        allow_none=False,
    )
    group_key = fields.String(
        description=group_key_description, required=False, allow_none=True
    )
    clause = fields.String(
        description=clause_description, required=False, allow_none=False
    )
