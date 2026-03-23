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

from sqlalchemy.orm.session import Session

from superset.daos.dataset import DatasetDAO


def test_get_rls_filters_for_datasets_empty(session: Session) -> None:
    result = DatasetDAO.get_rls_filters_for_datasets([])
    assert result == {}


def test_get_rls_filters_for_datasets(session: Session) -> None:
    from superset import db
    from superset.connectors.sqla.models import (
        RowLevelSecurityFilter,
        SqlaTable,
    )
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset1 = SqlaTable(
        table_name="table1",
        schema="main",
        database=database,
    )
    dataset2 = SqlaTable(
        table_name="table2",
        schema="main",
        database=database,
    )
    rls_filter = RowLevelSecurityFilter(
        name="test_filter",
        filter_type="Regular",
        group_key="dept",
        clause="dept = 'Finance'",
        tables=[dataset1],
    )
    db.session.add_all([database, dataset1, dataset2, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_datasets([dataset1.id, dataset2.id])
    assert dataset1.id in result
    assert dataset2.id not in result
    assert len(result[dataset1.id]) == 1
    assert result[dataset1.id][0]["name"] == "test_filter"
    assert result[dataset1.id][0]["filter_type"] == "Regular"
    assert result[dataset1.id][0]["group_key"] == "dept"


def test_get_rls_filters_for_dataset(session: Session) -> None:
    from superset import db
    from superset.connectors.sqla.models import (
        RowLevelSecurityFilter,
        SqlaTable,
    )
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="table1",
        schema="main",
        database=database,
    )
    rls_filter = RowLevelSecurityFilter(
        name="detail_filter",
        filter_type="Base",
        group_key=None,
        clause="1 = 0",
        tables=[dataset],
    )
    db.session.add_all([database, dataset, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_dataset(dataset.id)
    assert len(result) == 1
    assert result[0]["name"] == "detail_filter"
    assert result[0]["filter_type"] == "Base"
    assert result[0]["clause"] == "1 = 0"
    assert result[0]["roles"] == []


def test_get_rls_filters_for_dataset_no_filters(session: Session) -> None:
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="table1",
        schema="main",
        database=database,
    )
    db.session.add_all([database, dataset])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_dataset(dataset.id)
    assert result == []


def test_get_rls_filters_inherited_from_virtual_dataset_list(
    session: Session,
) -> None:
    """Virtual datasets should inherit RLS filters from physical tables in their SQL."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    physical_table = SqlaTable(
        table_name="orders",
        schema="main",
        database=database,
    )
    virtual_dataset = SqlaTable(
        table_name="my_virtual",
        schema="main",
        database=database,
        sql="SELECT * FROM orders WHERE status = 'active'",
    )
    rls_filter = RowLevelSecurityFilter(
        name="orders_filter",
        filter_type="Regular",
        group_key=None,
        clause="region = 'EU'",
        tables=[physical_table],
    )
    db.session.add_all([database, physical_table, virtual_dataset, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_datasets([virtual_dataset.id])
    assert virtual_dataset.id in result
    assert len(result[virtual_dataset.id]) == 1
    assert result[virtual_dataset.id][0]["name"] == "orders_filter"


def test_get_rls_filters_inherited_from_virtual_dataset_detail(
    session: Session,
) -> None:
    """Detail view for virtual dataset should show inherited filters with flag."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    physical_table = SqlaTable(
        table_name="customers",
        schema="main",
        database=database,
    )
    virtual_dataset = SqlaTable(
        table_name="my_report",
        schema="main",
        database=database,
        sql="SELECT * FROM customers",
    )
    rls_filter = RowLevelSecurityFilter(
        name="customer_filter",
        filter_type="Base",
        group_key=None,
        clause="1 = 0",
        tables=[physical_table],
    )
    db.session.add_all([database, physical_table, virtual_dataset, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_dataset(virtual_dataset.id)
    assert len(result) == 1
    assert result[0]["name"] == "customer_filter"
    assert result[0]["inherited"] is True
    assert result[0]["clause"] == "1 = 0"
