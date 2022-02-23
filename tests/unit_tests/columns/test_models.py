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

# pylint: disable=import-outside-toplevel, unused-argument

from sqlalchemy.orm.session import Session


def test_column_model(app_context: None, session: Session) -> None:
    """
    Test basic attributes of a ``Column``.
    """
    from superset.columns.models import Column

    engine = session.get_bind()
    Column.metadata.create_all(engine)  # pylint: disable=no-member

    column = Column(name="ds", type="TIMESTAMP", expression="ds",)

    session.add(column)
    session.flush()

    assert column.id == 1
    assert column.uuid is not None

    assert column.name == "ds"
    assert column.type == "TIMESTAMP"
    assert column.expression == "ds"

    # test that default values are set correctly
    assert column.description is None
    assert column.warning_text is None
    assert column.unit is None
    assert column.is_temporal is False
    assert column.is_spatial is False
    assert column.is_partition is False
    assert column.is_aggregation is False
    assert column.is_additive is False
    assert column.is_increase_desired is True
