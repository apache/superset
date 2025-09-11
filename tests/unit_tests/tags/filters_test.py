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

import pytest
from flask_appbuilder import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.filters import BaseTagIdFilter, BaseTagNameFilter

FILTER_MODELS = [Slice, Dashboard, SavedQuery]
OBJECT_TYPES = {
    "dashboards": "dashboard",
    "slices": "chart",
    "saved_query": "query",
}


@pytest.mark.parametrize("model", FILTER_MODELS)
@pytest.mark.parametrize("name", ["my_tag", "test tag", "blaah"])
def test_base_tag_filter_by_name(session: Session, model: Model, name: str) -> None:
    table = model.__tablename__
    engine = session.get_bind()
    query = session.query(model)
    filter = BaseTagNameFilter("tags", SQLAInterface(model))
    final_query = filter.apply(query, name)
    compiled_query = final_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )

    # Assert the JOIN clause is correct
    assert (
        f"FROM {table} JOIN tagged_object AS tagged_object_1 ON {table}.id "
        "= tagged_object_1.object_id AND tagged_object_1.object_type = "
        f"'{OBJECT_TYPES.get(table)}' JOIN tag ON tagged_object_1.tag_id = tag.id"
    ) in str(compiled_query)

    # Assert the WHERE clause is correct
    assert str(compiled_query).endswith(
        f"WHERE lower(tag.name) LIKE lower('%{name}%'))"
    )


@pytest.mark.parametrize("model", FILTER_MODELS)
@pytest.mark.parametrize("id", [3, 5, 8])
def test_base_tag_filter_by_id(session: Session, model: Model, id: int) -> None:
    table = model.__tablename__
    engine = session.get_bind()
    query = session.query(model)

    filter = BaseTagIdFilter("tags", SQLAInterface(model))
    filter.id_based_filter = True
    final_query = filter.apply(query, id)
    compiled_query = final_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )

    # Assert the JOIN clause is correct
    assert (
        f"FROM {table} JOIN tagged_object AS tagged_object_1 ON {table}.id "
        "= tagged_object_1.object_id AND tagged_object_1.object_type = "
        f"'{OBJECT_TYPES.get(table)}' JOIN tag ON tagged_object_1.tag_id = tag.id"
    ) in str(compiled_query)

    # Assert the WHERE clause is correct
    assert str(compiled_query).endswith(f"WHERE tag.id = {id})")
