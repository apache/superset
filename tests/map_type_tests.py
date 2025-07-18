from unittest.mock import MagicMock, patch

import pytest

from superset.connectors.sqla.models import SqlMetric
from superset.utils.core import (
    get_metric_type_from_column,
    map_sql_type_to_inferred_type,
)


def test_column_not_in_datasource():
    datasource = MagicMock(metrics=[])
    column = "non_existent_column"
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_column_with_valid_operation():
    metric = SqlMetric(metric_name="my_column", expression="SUM(my_column)")
    datasource = MagicMock(metrics=[metric])
    column = "my_column"
    assert (get_metric_type_from_column(column, datasource)) == "SUM"


def test_column_with_invalid_operation():
    metric = SqlMetric(metric_name="my_column", expression="INVALID(my_column)")
    datasource = MagicMock(metrics=[metric])
    column = "my_column"
    with patch("logging.warning") as mock_warning:
        assert (get_metric_type_from_column(column, datasource)) == ""
        mock_warning.assert_called_once()


def test_empty_datasource():
    datasource = MagicMock(metrics=[])
    column = "my_column"
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_column_is_none():
    datasource = MagicMock(metrics=[])
    column = None
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_datasource_is_none():
    datasource = None
    column = "my_column"
    with pytest.raises(AttributeError):
        get_metric_type_from_column(column, datasource)


def test_none_input():
    assert (map_sql_type_to_inferred_type(None)) == "string"


def test_empty_string_input():
    assert (map_sql_type_to_inferred_type("")) == "string"


def test_recognized_sql_type():
    # Assuming TYPE_MAPPING contains a pattern for "integer"
    assert (map_sql_type_to_inferred_type("integer")) == "int64"


def test_unrecognized_sql_type():
    assert (map_sql_type_to_inferred_type("unknown_type")) == "string"


def test_sql_type_with_special_chars():
    assert (map_sql_type_to_inferred_type("varchar(255)")) == "string"
