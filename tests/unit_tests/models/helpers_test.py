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
import builtins
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa
from jinja2.exceptions import TemplateError
from sqlalchemy import Column, create_engine, Integer, select, String, Table
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.exceptions import (
    QueryClauseValidationException,
    QueryObjectValidationError,
    SupersetSecurityException,
)
from superset.jinja_context import BaseTemplateProcessor, PrestoTemplateProcessor
from superset.models.helpers import ExploreMixin

table = "my_table"
my_table = Table(
    table,
    SqlaTable.metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
)


class MyExploreClass(ExploreMixin):
    def __init__(self, id=1):
        self.id = id

    @property
    def database(self):
        return "my_database"

    @property
    def schema(self):
        return "my_schema"

    @property
    def sql(self):
        return "SELECT * FROM my_table"

    @property
    def columns(self):
        return ["column1", "column2", "column3"]

    def get_fetch_values_predicate(self, template_processor=None):
        return "my_predicate"

    def get_extra_cache_keys(self, query_obj):
        return ["key1", "key2", "key3"]

    def get_template_processor(self, **kwargs):
        return MagicMock()


class MyExploreClassExtra(MyExploreClass):
    @property
    def db_engine_spec(self):
        return PostgresEngineSpec()


def test_sqla_aggregations():
    """
    Test the SQL aggregations used in Superset's Explore view.
    """
    mixin = ExploreMixin()
    assert (
        mixin.sqla_aggregations["COUNT_DISTINCT"]("column").compare(
            sa.func.COUNT(sa.distinct("column"))
        )
        is True
    )
    assert (
        mixin.sqla_aggregations["COUNT"]("column").compare(sa.func.COUNT("column"))
        is True
    )
    assert (
        mixin.sqla_aggregations["SUM"]("column").compare(sa.func.SUM("column")) is True
    )
    assert (
        mixin.sqla_aggregations["AVG"]("column").compare(sa.func.AVG("column")) is True
    )
    assert (
        mixin.sqla_aggregations["MIN"]("column").compare(sa.func.MIN("column")) is True
    )
    assert (
        mixin.sqla_aggregations["MAX"]("column").compare(sa.func.MAX("column")) is True
    )


def test_type():
    """
    Test the type property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.type


def test_db_extra():
    """
    Test the db_extra property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.db_extra


def test_query():
    """
    Test the query method of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.query({})


def test_database_id():
    """
    Test the database_id property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.database_id


def test_owners_data():
    """
    Test the owners_data property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.owners_data


def test_metrics():
    """
    Test the metrics property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    assert mixin.metrics == []


def test_uid():
    """
    Test the uid property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.uid


def test_is_rls_supported():
    """
    Test the is_rls_supported property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.is_rls_supported


def test_cache_timeout():
    """
    Test the cache_timeout property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.cache_timeout


def test_column_names():
    """
    Test the column_names property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.column_names


def test_offset():
    """
    Test the offset property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.offset


def test_main_dttm_col():
    """
    Test the main_dttm_col property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.main_dttm_col


def test_always_filter_main_dttm():
    """
    Test the always_filter_main_dttm property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    assert mixin.always_filter_main_dttm == False


def test_dttm_cols():
    """
    Test the dttm_cols property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.dttm_cols


def test_db_engine_spec():
    """
    Test the db_engine_spec property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.db_engine_spec


def test_database():
    """
    Test the database property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.database


def test_schema():
    """
    Test the schema property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.schema


def test_sql():
    """
    Test the sql property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.sql


def test_columns():
    """
    Test the columns property of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.columns


def test_get_extra_cache_keys():
    """
    Test the get_extra_cache_keys method of the ExploreMixin class.
    """
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.get_extra_cache_keys({})
        with pytest.raises(NotImplementedError):
            mixin.get_extra_cache_keys({})


def test_get_template_processor():
    mixin = ExploreMixin()
    with pytest.raises(NotImplementedError):
        mixin.get_template_processor()


def test_database_with_class():
    mixin = MyExploreClass()
    assert mixin.database == "my_database"


def test_schema_with_class():
    mixin = MyExploreClass()
    assert mixin.schema == "my_schema"


def test_sql_with_class():
    mixin = MyExploreClass()
    assert mixin.sql == "SELECT * FROM my_table"


def test_columns_with_class():
    mixin = MyExploreClass()
    assert mixin.columns == ["column1", "column2", "column3"]


def test_get_extra_cache_keys_with_class():
    mixin = MyExploreClass()
    assert mixin.get_extra_cache_keys({}) == ["key1", "key2", "key3"]


def test_get_template_processor_with_class():
    mixin = MyExploreClass()
    assert isinstance(mixin.get_template_processor(), MagicMock)


def test_type_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.type


def test_db_extra_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.db_extra


def test_query_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.query({})


def test_database_id_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.database_id


def test_owners_data_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.owners_data


def test_metrics_with_class():
    my_explore = MyExploreClass()
    assert my_explore.metrics == []


def test_uid_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.uid


def test_is_rls_supported_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.is_rls_supported


def test_cache_timeout_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.cache_timeout


def test_column_names_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.column_names


def test_offset_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.offset


def test_main_dttm_col_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.main_dttm_col


def test_always_filter_main_dttm_with_class():
    my_explore = MyExploreClass()
    assert my_explore.always_filter_main_dttm == False


def test_dttm_cols_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.dttm_cols


def test_db_engine_spec_with_class():
    my_explore = MyExploreClass()
    with pytest.raises(NotImplementedError):
        my_explore.db_engine_spec


def test_get_sqla_row_level_filters(mocker):
    g = mocker.patch("superset.security.manager.g")
    g.user.email = "admin@example.com"
    my_explore = MyExploreClass()
    template_processor = MagicMock()
    filters = my_explore.get_sqla_row_level_filters(template_processor)
    assert isinstance(filters, list)


def test_get_sqla_row_level_filters_with_empty_filters(mocker):
    g = mocker.patch("superset.security.manager.g")
    g.user.email = "admin@example.com"
    mixin = ExploreMixin()
    template_processor = MagicMock()
    security_manager.get_rls_filters = MagicMock(return_value=[])
    filters = mixin.get_sqla_row_level_filters(template_processor)
    assert isinstance(filters, list)
    assert len(filters) == 0


def test_get_sqla_row_level_filters_with_grouped_filters(mocker):
    g = mocker.patch("superset.security.manager.g")
    g.user.email = "admin@example.com"
    my_explore = MyExploreClassExtra()
    template_processor = MagicMock()
    filter1 = MagicMock(group_key=1, clause="filter1")
    filter2 = MagicMock(group_key=1, clause="filter2")
    filter3 = MagicMock(group_key=2, clause="filter3")
    security_manager.get_rls_filters = MagicMock(
        return_value=[filter1, filter2, filter3]
    )
    filters = my_explore.get_sqla_row_level_filters(template_processor)
    assert isinstance(filters, list)
    assert len(filters) == 2


def test_get_sqla_row_level_filters_with_template_error():
    mixin = ExploreMixin()
    template_processor = MagicMock()
    template_processor.process_template = MagicMock(side_effect=TemplateError("error"))
    with pytest.raises(QueryObjectValidationError):
        mixin.get_sqla_row_level_filters(template_processor)


def test_process_sql_expression_with_template_processor():
    mixin = ExploreMixin()
    template_processor = MagicMock(spec=BaseTemplateProcessor)
    template_processor.process_template = MagicMock(
        return_value="SELECT * FROM my_table"
    )
    expression = "{{ sql }}"
    database_id = 1
    schema = "my_schema"
    with patch("superset.models.helpers.is_feature_enabled", return_value=True):
        result = mixin._process_sql_expression(
            expression, database_id, schema, template_processor
        )
    assert result == "SELECT * FROM my_table"


@patch("superset.models.helpers.is_feature_enabled", return_value=True)
@patch(
    "superset.sql_parse.sanitize_clause",
    side_effect=QueryClauseValidationException("Invalid clause"),
)
def test_process_sql_expression_with_invalid_clause(
    mock_sanitize_clause, mock_is_feature_enabled
):
    mixin = ExploreMixin()
    template_processor = PrestoTemplateProcessor(MagicMock())
    expression = "SELECT * FROM my_table; SELECT * FROM my_other_table;"
    database_id = 1
    schema = "my_schema"
    with pytest.raises(QueryObjectValidationError):
        mixin._process_sql_expression(
            expression, database_id, schema, template_processor
        )


@patch("superset.models.helpers.is_feature_enabled", return_value=True)
def test_process_sql_expression_with_valid_clause(mock_is_feature_enabled):
    mixin = ExploreMixin()
    template_processor = PrestoTemplateProcessor(MagicMock())
    expression = "SELECT * FROM my_table WHERE {{ valid_clause }}"
    database_id = 1
    schema = "my_schema"
    with patch(
        "superset.models.helpers.sanitize_clause",
        return_value="SELECT * FROM my_table WHERE 1=1",
    ):
        result = mixin._process_sql_expression(
            expression, database_id, schema, template_processor
        )
    assert result == "SELECT * FROM my_table WHERE 1=1"


def test_process_sql_expression_with_subqueries_raises():
    mixin = ExploreMixin()
    template_processor = PrestoTemplateProcessor(MagicMock())
    expression = "SELECT * FROM my_table WHERE {{ valid_clause }}"
    database_id = 1
    schema = "my_schema"
    with patch(
        "superset.models.helpers.sanitize_clause",
        return_value="SELECT * FROM my_table WHERE EXISTS (SELECT * FROM my_other_table)",
    ):
        with pytest.raises(
            SupersetSecurityException,
            match="Custom SQL fields cannot contain sub-queries",
        ):
            mixin._process_sql_expression(
                expression, database_id, schema, template_processor
            )


def test_process_sql_expression_with_no_expression():
    mixin = ExploreMixin()
    template_processor = MagicMock(spec=BaseTemplateProcessor)
    expression = None
    database_id = 1
    schema = "my_schema"
    result = mixin._process_sql_expression(
        expression, database_id, schema, template_processor
    )
    assert result is None


def test_make_sqla_column_compatible_with_label(session: Session):
    instance = MyExploreClassExtra()
    engine = session.get_bind()

    SqlaTable.metadata.drop_all(engine)
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    query = select([my_table.c.id, my_table.c.name])
    sqla_col = query.columns[1]
    label = "my_label"
    result = instance.make_sqla_column_compatible(sqla_col, label)
    expected = query.columns[1].label(label)
    assert str(result) == str(expected)


def test_make_sqla_column_compatible_without_label(session: Session):
    instance = MyExploreClassExtra()
    engine = session.get_bind()
    SqlaTable.metadata.drop_all(engine)

    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    query = select([my_table.c.id, my_table.c.name])
    sqla_col = query.columns[1]
    result = instance.make_sqla_column_compatible(sqla_col)
    expected = query.columns[1].label("name")
    assert str(result) == str(expected)


@patch(
    "superset.models.helpers.config",
    {
        "SQL_QUERY_MUTATOR": lambda sql, **kwargs: f"-- {sql}",
        "MUTATE_AFTER_SPLIT": False,
    },
)
def test_mutate_query_from_config():
    instance = MyExploreClassExtra()
    sql = "SELECT * FROM my_table"
    result = instance.mutate_query_from_config(sql)
    expected = "-- SELECT * FROM my_table"
    assert result == expected


@patch(
    "superset.models.helpers.config",
    {
        "SQL_QUERY_MUTATOR": lambda sql, **kwargs: f"-- {sql}",
        "MUTATE_AFTER_SPLIT": True,
    },
)
def test_no_mutate_query_from_config():
    instance = MyExploreClassExtra()
    sql = "SELECT * FROM my_table"
    result = instance.mutate_query_from_config(sql)
    expected = "SELECT * FROM my_table"
    assert result == expected
