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
Schema for the column model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "column" in a table or dataset. In addition to a column, new models for
tables, metrics, and datasets were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from superset.columns.models import Column


class ColumnSchema(SQLAlchemyAutoSchema):
    """
    Schema for the ``Column`` model.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        model = Column
        load_instance = True
        include_relationships = True
