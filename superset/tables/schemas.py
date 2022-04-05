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
"""
Schema for table model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "table" in a given database -- either a physical table or a view. In
addition to a table, new models for columns, metrics, and datasets were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from superset.tables.models import Table


class TableSchema(SQLAlchemyAutoSchema):
    """
    Schema for the ``Table`` model.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        model = Table
        load_instance = True
        include_relationships = True
