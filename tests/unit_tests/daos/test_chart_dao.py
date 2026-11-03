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
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.daos.base import ColumnOperator
from superset.daos.chart import ChartDAO
from superset.models.slice import Slice


@pytest.mark.parametrize(
    ("opr", "value", "expected_ids"),
    [
        ("eq", 10, [1]),
        ("ne", 10, [2]),
        ("in", [10], [1]),
        ("nin", [10], [2]),
    ],
)
def test_dataset_id_filters_exclude_other_datasource_types(
    opr: str, value: int | list[int], expected_ids: list[int]
) -> None:
    """Dataset ID operators never include same-ID semantic-view charts."""
    engine = create_engine("sqlite://")
    try:
        Slice.__table__.create(engine)
        with Session(engine) as session:
            session.execute(
                Slice.__table__.insert(),
                [
                    {"id": 1, "datasource_id": 10, "datasource_type": "table"},
                    {"id": 2, "datasource_id": 20, "datasource_type": "table"},
                    {"id": 3, "datasource_id": 10, "datasource_type": "semantic_view"},
                    {"id": 4, "datasource_id": 20, "datasource_type": "semantic_view"},
                ],
            )
            query = ChartDAO.apply_column_operators(
                session.query(Slice.id),
                [ColumnOperator(col="datasource_id", opr=opr, value=value)],
            )
            assert [row.id for row in query.order_by(Slice.id)] == expected_ids
    finally:
        engine.dispose()
