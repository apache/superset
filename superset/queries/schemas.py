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
from marshmallow import fields
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from superset.models.sql_lab import Query

openapi_spec_methods_override = {
    "get": {"get": {"description": "Get query detail information."}},
    "get_list": {
        "get": {
            "description": "Get a list of queries, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
}


class QuerySchema(SQLAlchemyAutoSchema):
    """
    Schema for the ``Query`` model.
    """

    start_time = fields.Float(attribute="start_time")
    end_time = fields.Float(attribute="end_time")

    class Meta:  # pylint: disable=too-few-public-methods
        model = Query
        load_instance = True
        include_relationships = True
