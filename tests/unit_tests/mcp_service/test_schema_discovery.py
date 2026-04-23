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

"""Tests for MCP schema discovery helpers."""

import sqlalchemy as sa
from sqlalchemy.orm import declarative_base

from superset.mcp_service.common.schema_discovery import (
    ColumnMetadata,
    get_columns_from_model,
)

Base = declarative_base()


class ExampleModel(Base):
    __tablename__ = "example_model"

    id = sa.Column(sa.Integer, primary_key=True)


def test_get_columns_from_model_excludes_matching_extra_columns():
    columns = get_columns_from_model(
        ExampleModel,
        default_columns=["id"],
        extra_columns={
            "owners": ColumnMetadata(
                name="owners",
                description="Owner list",
                type="list",
                is_default=False,
            ),
            "url": ColumnMetadata(
                name="url",
                description="Resource URL",
                type="str",
                is_default=False,
            ),
        },
        exclude_columns={"owners"},
    )

    assert [column.name for column in columns] == ["id", "url"]
