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


def test_table_model(app_context: None, session: Session) -> None:
    """
    Test basic attributes of a ``Table``.
    """
    from superset.columns.models import Column
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Table.metadata.create_all(engine)  # pylint: disable=no-member

    table = Table(
        name="my_table",
        schema="my_schema",
        catalog="my_catalog",
        database=Database(database_name="my_database", sqlalchemy_uri="test://"),
        columns=[Column(name="ds", type="TIMESTAMP", expression="ds",)],
    )
    session.add(table)
    session.flush()

    assert table.id == 1
    assert table.uuid is not None
    assert table.database_id == 1
    assert table.catalog == "my_catalog"
    assert table.schema == "my_schema"
    assert table.name == "my_table"
    assert [column.name for column in table.columns] == ["ds"]
