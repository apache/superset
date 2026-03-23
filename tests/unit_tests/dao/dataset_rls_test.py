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


def _setup_tables(session: Session) -> None:
    """Create metadata tables for tests that need them."""
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())


def test_get_rls_filters_for_datasets_empty(session: Session) -> None:
    result = DatasetDAO.get_rls_filters_for_datasets([])
    assert result == {}


def test_get_rls_filters_for_dataset_empty(session: Session) -> None:
    """get_rls_filters_for_dataset returns [] for a nonexistent dataset."""
    _setup_tables(session)
    result = DatasetDAO.get_rls_filters_for_dataset(999999)
    assert result == []


def test_get_rls_filters_for_datasets(session: Session) -> None:
    from superset import db
    from superset.connectors.sqla.models import (
        RowLevelSecurityFilter,
        SqlaTable,
    )
    from superset.models.core import Database

    _setup_tables(session)

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


def test_get_rls_filters_for_dataset_includes_roles(session: Session) -> None:
    """Detail endpoint should include roles with id and name."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="t1", schema="main", database=database)
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

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="table1", schema="main", database=database)
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

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    physical_table = SqlaTable(table_name="orders", schema="main", database=database)
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

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    physical_table = SqlaTable(table_name="customers", schema="main", database=database)
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


def test_dedup_inherited_filters_list(session: Session) -> None:
    """Same RLS filter inherited via two tables in SQL should appear only once."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    phys_a = SqlaTable(table_name="a", schema="main", database=database)
    phys_b = SqlaTable(table_name="b", schema="main", database=database)
    # Same filter attached to both physical tables
    rls_filter = RowLevelSecurityFilter(
        name="shared_filter",
        filter_type="Regular",
        group_key=None,
        clause="1=1",
        tables=[phys_a, phys_b],
    )
    virtual = SqlaTable(
        table_name="v",
        schema="main",
        database=database,
        sql="SELECT * FROM a JOIN b ON a.id = b.id",
    )
    db.session.add_all([database, phys_a, phys_b, virtual, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_datasets([virtual.id])
    assert virtual.id in result
    assert len(result[virtual.id]) == 1, "Should deduplicate the shared filter"
    assert result[virtual.id][0]["name"] == "shared_filter"


def test_dedup_inherited_filters_detail(session: Session) -> None:
    """Detail dedup: same filter from two physical tables should appear once."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    phys_a = SqlaTable(table_name="a", schema="main", database=database)
    phys_b = SqlaTable(table_name="b", schema="main", database=database)
    rls_filter = RowLevelSecurityFilter(
        name="shared_filter",
        filter_type="Regular",
        group_key=None,
        clause="1=1",
        tables=[phys_a, phys_b],
    )
    virtual = SqlaTable(
        table_name="v",
        schema="main",
        database=database,
        sql="SELECT * FROM a JOIN b ON a.id = b.id",
    )
    db.session.add_all([database, phys_a, phys_b, virtual, rls_filter])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_dataset(virtual.id)
    assert len(result) == 1, "Should deduplicate the shared filter"
    assert result[0]["inherited"] is True


def test_virtual_dataset_with_unparseable_sql(session: Session) -> None:
    """Virtual dataset with bad SQL should silently return no inherited filters."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    virtual = SqlaTable(
        table_name="bad_sql",
        schema="main",
        database=database,
        sql="THIS IS NOT VALID SQL !!!",
    )
    db.session.add_all([database, virtual])
    db.session.flush()

    # List endpoint
    list_result = DatasetDAO.get_rls_filters_for_datasets([virtual.id])
    assert list_result.get(virtual.id) is None

    # Detail endpoint
    detail_result = DatasetDAO.get_rls_filters_for_dataset(virtual.id)
    assert detail_result == []


def test_virtual_dataset_no_matching_physical_tables(session: Session) -> None:
    """Virtual dataset referencing nonexistent table should return no inherited."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    virtual = SqlaTable(
        table_name="orphan_virtual",
        schema="main",
        database=database,
        sql="SELECT * FROM nonexistent_table",
    )
    db.session.add_all([database, virtual])
    db.session.flush()

    result = DatasetDAO.get_rls_filters_for_datasets([virtual.id])
    assert result.get(virtual.id) is None


def test_parse_tables_from_virtual_datasets_with_engine() -> None:
    """_parse_tables_from_virtual_datasets should use the provided engine."""
    ds_to_tables, ds_db_map = DatasetDAO._parse_tables_from_virtual_datasets(
        [(1, "SELECT * FROM orders", "main", 10)],
        db_engines={10: "sqlite"},
    )
    assert 1 in ds_to_tables
    assert "orders" in ds_to_tables[1]
    assert ds_db_map[1] == 10


def test_parse_tables_from_virtual_datasets_bad_sql() -> None:
    """Bad SQL should be skipped without raising."""
    ds_to_tables, ds_db_map = DatasetDAO._parse_tables_from_virtual_datasets(
        [(1, "NOT SQL", "main", 10)],
        db_engines={10: ""},
    )
    assert 1 not in ds_to_tables
    assert ds_db_map[1] == 10


def test_multiple_filters_on_same_dataset(session: Session) -> None:
    """Multiple distinct RLS filters on a single dataset should all be returned."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="t1", schema="main", database=database)
    f1 = RowLevelSecurityFilter(
        name="filter_a",
        filter_type="Regular",
        group_key="dept",
        clause="dept='A'",
        tables=[dataset],
    )
    f2 = RowLevelSecurityFilter(
        name="filter_b",
        filter_type="Base",
        group_key=None,
        clause="1=1",
        tables=[dataset],
    )
    db.session.add_all([database, dataset, f1, f2])
    db.session.flush()

    list_result = DatasetDAO.get_rls_filters_for_datasets([dataset.id])
    assert len(list_result[dataset.id]) == 2
    names = {f["name"] for f in list_result[dataset.id]}
    assert names == {"filter_a", "filter_b"}

    detail_result = DatasetDAO.get_rls_filters_for_dataset(dataset.id)
    assert len(detail_result) == 2
    detail_names = {f["name"] for f in detail_result}
    assert detail_names == {"filter_a", "filter_b"}


def test_mixed_direct_and_inherited_filters(session: Session) -> None:
    """Virtual dataset with both direct and inherited filters returns both."""
    from superset import db
    from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
    from superset.models.core import Database

    _setup_tables(session)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    physical = SqlaTable(table_name="physical_t", schema="main", database=database)
    virtual = SqlaTable(
        table_name="virtual_t",
        schema="main",
        database=database,
        sql="SELECT * FROM physical_t",
    )
    direct_filter = RowLevelSecurityFilter(
        name="direct",
        filter_type="Regular",
        group_key=None,
        clause="x=1",
        tables=[virtual],
    )
    inherited_filter = RowLevelSecurityFilter(
        name="inherited",
        filter_type="Base",
        group_key=None,
        clause="y=2",
        tables=[physical],
    )
    db.session.add_all([database, physical, virtual, direct_filter, inherited_filter])
    db.session.flush()

    # Detail endpoint
    result = DatasetDAO.get_rls_filters_for_dataset(virtual.id)
    names = {f["name"] for f in result}
    assert names == {"direct", "inherited"}
    inherited_entries = [f for f in result if f.get("inherited")]
    direct_entries = [f for f in result if not f.get("inherited")]
    assert len(inherited_entries) == 1
    assert len(direct_entries) == 1
    assert inherited_entries[0]["name"] == "inherited"
    assert direct_entries[0]["name"] == "direct"

    # List endpoint
    list_result = DatasetDAO.get_rls_filters_for_datasets([virtual.id])
    assert len(list_result[virtual.id]) == 2
