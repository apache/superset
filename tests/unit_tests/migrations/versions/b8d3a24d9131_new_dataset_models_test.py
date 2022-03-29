"""
Test the SIP-68 migration.
"""
# pylint: disable=import-outside-toplevel, unused-argument

from pytest_mock import MockerFixture

from superset.sql_parse import Table


def test_get_dependencies(mocker: MockerFixture, app_context: None) -> None:
    """
    Test the ``get_dependencies`` helper function.
    """
    from superset.migrations.versions.b8d3a24d9131_new_dataset_models import (
        get_dependencies,
    )

    assert get_dependencies("SELECT 1", "trino") == set()
    assert get_dependencies("SELECT 1 FROM some_table", "trino") == {
        Table(table="some_table", schema=None, catalog=None)
    }
    assert get_dependencies(
        "SELECT 1 FROM some_catalog.some_schema.some_table", "trino"
    ) == {Table(table="some_table", schema="some_schema", catalog="some_catalog")}
    assert get_dependencies(
        "SELECT * FROM some_table JOIN other_table ON some_table.id = other_table.id",
        "trino",
    ) == {
        Table(table="some_table", schema=None, catalog=None),
        Table(table="other_table", schema=None, catalog=None),
    }

    # test falling back to sqlparse
    logger = mocker.patch(
        "superset.migrations.versions.b8d3a24d9131_new_dataset_models.logger"
    )
    sql = "SELECT * FROM table UNION ALL SELECT * FROM other_table"
    assert get_dependencies(sql, "trino",) == {
        Table(table="other_table", schema=None, catalog=None)
    }
    logger.warning.assert_called_with("Unable to parse query with sqloxide: %s", sql)
