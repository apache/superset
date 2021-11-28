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
from collections import namedtuple
from unittest import mock, skipUnless

import pandas as pd
from sqlalchemy import types
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.sql import select

from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.sql_parse import ParsedQuery
from superset.utils.core import DatasourceName, GenericDataType
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestPrestoDbEngineSpec(TestDbEngineSpec):
    @skipUnless(TestDbEngineSpec.is_module_installed("pyhive"), "pyhive not installed")
    def test_get_datatype_presto(self):
        self.assertEqual("STRING", PrestoEngineSpec.get_datatype("string"))

    def test_presto_get_view_names_return_empty_list(
        self,
    ):  # pylint: disable=invalid-name
        self.assertEqual(
            [], PrestoEngineSpec.get_view_names(mock.ANY, mock.ANY, mock.ANY)
        )

    @mock.patch("superset.db_engine_specs.presto.is_feature_enabled")
    def test_get_view_names(self, mock_is_feature_enabled):
        mock_is_feature_enabled.return_value = True
        mock_execute = mock.MagicMock()
        mock_fetchall = mock.MagicMock(return_value=[["a", "b,", "c"], ["d", "e"]])
        database = mock.MagicMock()
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.execute = (
            mock_execute
        )
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.fetchall = (
            mock_fetchall
        )
        result = PrestoEngineSpec.get_view_names(database, mock.Mock(), None)
        mock_execute.assert_called_once_with(
            "SELECT table_name FROM information_schema.views", {}
        )
        assert result == ["a", "d"]

    @mock.patch("superset.db_engine_specs.presto.is_feature_enabled")
    def test_get_view_names_with_schema(self, mock_is_feature_enabled):
        mock_is_feature_enabled.return_value = True
        mock_execute = mock.MagicMock()
        mock_fetchall = mock.MagicMock(return_value=[["a", "b,", "c"], ["d", "e"]])
        database = mock.MagicMock()
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.execute = (
            mock_execute
        )
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.fetchall = (
            mock_fetchall
        )
        schema = "schema"
        result = PrestoEngineSpec.get_view_names(database, mock.Mock(), schema)
        mock_execute.assert_called_once_with(
            "SELECT table_name FROM information_schema.views "
            "WHERE table_schema=%(schema)s",
            {"schema": schema},
        )
        assert result == ["a", "d"]

    def verify_presto_column(self, column, expected_results):
        inspector = mock.Mock()
        inspector.engine.dialect.identifier_preparer.quote_identifier = mock.Mock()
        keymap = {
            "Column": (None, None, 0),
            "Type": (None, None, 1),
            "Null": (None, None, 2),
        }
        row = RowProxy(mock.Mock(), column, [None, None, None, None], keymap)
        inspector.bind.execute = mock.Mock(return_value=[row])
        results = PrestoEngineSpec.get_columns(inspector, "", "")
        self.assertEqual(len(expected_results), len(results))
        for expected_result, result in zip(expected_results, results):
            self.assertEqual(expected_result[0], result["name"])
            self.assertEqual(expected_result[1], str(result["type"]))

    def test_presto_get_column(self):
        presto_column = ("column_name", "boolean", "")
        expected_results = [("column_name", "BOOLEAN")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_simple_row_column(self):
        presto_column = ("column_name", "row(nested_obj double)", "")
        expected_results = [("column_name", "ROW"), ("column_name.nested_obj", "FLOAT")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_simple_row_column_with_name_containing_whitespace(self):
        presto_column = ("column name", "row(nested_obj double)", "")
        expected_results = [("column name", "ROW"), ("column name.nested_obj", "FLOAT")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_simple_row_column_with_tricky_nested_field_name(self):
        presto_column = ("column_name", 'row("Field Name(Tricky, Name)" double)', "")
        expected_results = [
            ("column_name", "ROW"),
            ('column_name."Field Name(Tricky, Name)"', "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_simple_array_column(self):
        presto_column = ("column_name", "array(double)", "")
        expected_results = [("column_name", "ARRAY")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_row_within_array_within_row_column(self):
        presto_column = (
            "column_name",
            "row(nested_array array(row(nested_row double)), nested_obj double)",
            "",
        )
        expected_results = [
            ("column_name", "ROW"),
            ("column_name.nested_array", "ARRAY"),
            ("column_name.nested_array.nested_row", "FLOAT"),
            ("column_name.nested_obj", "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_get_array_within_row_within_array_column(self):
        presto_column = (
            "column_name",
            "array(row(nested_array array(double), nested_obj double))",
            "",
        )
        expected_results = [
            ("column_name", "ARRAY"),
            ("column_name.nested_array", "ARRAY"),
            ("column_name.nested_obj", "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_fields(self):
        cols = [
            {"name": "column"},
            {"name": "column.nested_obj"},
            {"name": 'column."quoted.nested obj"'},
        ]
        actual_results = PrestoEngineSpec._get_fields(cols)
        expected_results = [
            {"name": '"column"', "label": "column"},
            {"name": '"column"."nested_obj"', "label": "column.nested_obj"},
            {
                "name": '"column"."quoted.nested obj"',
                "label": 'column."quoted.nested obj"',
            },
        ]
        for actual_result, expected_result in zip(actual_results, expected_results):
            self.assertEqual(actual_result.element.name, expected_result["name"])
            self.assertEqual(actual_result.name, expected_result["label"])

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_expand_data_with_simple_structural_columns(self):
        cols = [
            {"name": "row_column", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "array_column", "type": "ARRAY(BIGINT)"},
        ]
        data = [
            {"row_column": ["a"], "array_column": [1, 2, 3]},
            {"row_column": ["b"], "array_column": [4, 5, 6]},
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "row_column", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "row_column.nested_obj", "type": "VARCHAR"},
            {"name": "array_column", "type": "ARRAY(BIGINT)"},
        ]

        expected_data = [
            {"array_column": 1, "row_column": ["a"], "row_column.nested_obj": "a"},
            {"array_column": 2, "row_column": "", "row_column.nested_obj": ""},
            {"array_column": 3, "row_column": "", "row_column.nested_obj": ""},
            {"array_column": 4, "row_column": ["b"], "row_column.nested_obj": "b"},
            {"array_column": 5, "row_column": "", "row_column.nested_obj": ""},
            {"array_column": 6, "row_column": "", "row_column.nested_obj": ""},
        ]

        expected_expanded_cols = [{"name": "row_column.nested_obj", "type": "VARCHAR"}]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_expand_data_with_complex_row_columns(self):
        cols = [
            {
                "name": "row_column",
                "type": "ROW(NESTED_OBJ1 VARCHAR, NESTED_ROW ROW(NESTED_OBJ2 VARCHAR))",
            }
        ]
        data = [{"row_column": ["a1", ["a2"]]}, {"row_column": ["b1", ["b2"]]}]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {
                "name": "row_column",
                "type": "ROW(NESTED_OBJ1 VARCHAR, NESTED_ROW ROW(NESTED_OBJ2 VARCHAR))",
            },
            {"name": "row_column.nested_obj1", "type": "VARCHAR"},
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ2 VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj2", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "row_column": ["a1", ["a2"]],
                "row_column.nested_obj1": "a1",
                "row_column.nested_row": ["a2"],
                "row_column.nested_row.nested_obj2": "a2",
            },
            {
                "row_column": ["b1", ["b2"]],
                "row_column.nested_obj1": "b1",
                "row_column.nested_row": ["b2"],
                "row_column.nested_row.nested_obj2": "b2",
            },
        ]

        expected_expanded_cols = [
            {"name": "row_column.nested_obj1", "type": "VARCHAR"},
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ2 VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj2", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_expand_data_with_complex_row_columns_and_null_values(self):
        cols = [
            {"name": "row_column", "type": "ROW(NESTED_ROW ROW(NESTED_OBJ VARCHAR))",}
        ]
        data = [
            {"row_column": '[["a"]]'},
            {"row_column": "[[null]]"},
            {"row_column": "[null]"},
            {"row_column": "null"},
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "row_column", "type": "ROW(NESTED_ROW ROW(NESTED_OBJ VARCHAR))",},
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "row_column": [["a"]],
                "row_column.nested_row": ["a"],
                "row_column.nested_row.nested_obj": "a",
            },
            {
                "row_column": [[None]],
                "row_column.nested_row": [None],
                "row_column.nested_row.nested_obj": None,
            },
            {
                "row_column": [None],
                "row_column.nested_row": None,
                "row_column.nested_row.nested_obj": "",
            },
            {
                "row_column": None,
                "row_column.nested_row": "",
                "row_column.nested_row.nested_obj": "",
            },
        ]

        expected_expanded_cols = [
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_expand_data_with_complex_array_columns(self):
        cols = [
            {"name": "int_column", "type": "BIGINT"},
            {
                "name": "array_column",
                "type": "ARRAY(ROW(NESTED_ARRAY ARRAY(ROW(NESTED_OBJ VARCHAR))))",
            },
        ]
        data = [
            {"int_column": 1, "array_column": [[[["a"], ["b"]]], [[["c"], ["d"]]]]},
            {"int_column": 2, "array_column": [[[["e"], ["f"]]], [[["g"], ["h"]]]]},
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "int_column", "type": "BIGINT"},
            {
                "name": "array_column",
                "type": "ARRAY(ROW(NESTED_ARRAY ARRAY(ROW(NESTED_OBJ VARCHAR))))",
            },
            {
                "name": "array_column.nested_array",
                "type": "ARRAY(ROW(NESTED_OBJ VARCHAR))",
            },
            {"name": "array_column.nested_array.nested_obj", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "array_column": [[["a"], ["b"]]],
                "array_column.nested_array": ["a"],
                "array_column.nested_array.nested_obj": "a",
                "int_column": 1,
            },
            {
                "array_column": "",
                "array_column.nested_array": ["b"],
                "array_column.nested_array.nested_obj": "b",
                "int_column": "",
            },
            {
                "array_column": [[["c"], ["d"]]],
                "array_column.nested_array": ["c"],
                "array_column.nested_array.nested_obj": "c",
                "int_column": "",
            },
            {
                "array_column": "",
                "array_column.nested_array": ["d"],
                "array_column.nested_array.nested_obj": "d",
                "int_column": "",
            },
            {
                "array_column": [[["e"], ["f"]]],
                "array_column.nested_array": ["e"],
                "array_column.nested_array.nested_obj": "e",
                "int_column": 2,
            },
            {
                "array_column": "",
                "array_column.nested_array": ["f"],
                "array_column.nested_array.nested_obj": "f",
                "int_column": "",
            },
            {
                "array_column": [[["g"], ["h"]]],
                "array_column.nested_array": ["g"],
                "array_column.nested_array.nested_obj": "g",
                "int_column": "",
            },
            {
                "array_column": "",
                "array_column.nested_array": ["h"],
                "array_column.nested_array.nested_obj": "h",
                "int_column": "",
            },
        ]
        expected_expanded_cols = [
            {
                "name": "array_column.nested_array",
                "type": "ARRAY(ROW(NESTED_OBJ VARCHAR))",
            },
            {"name": "array_column.nested_array.nested_obj", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    def test_presto_extra_table_metadata(self):
        db = mock.Mock()
        db.get_indexes = mock.Mock(return_value=[{"column_names": ["ds", "hour"]}])
        db.get_extra = mock.Mock(return_value={})
        df = pd.DataFrame({"ds": ["01-01-19"], "hour": [1]})
        db.get_df = mock.Mock(return_value=df)
        PrestoEngineSpec.get_create_view = mock.Mock(return_value=None)
        result = PrestoEngineSpec.extra_table_metadata(db, "test_table", "test_schema")
        self.assertEqual({"ds": "01-01-19", "hour": 1}, result["partitions"]["latest"])

    def test_presto_where_latest_partition(self):
        db = mock.Mock()
        db.get_indexes = mock.Mock(return_value=[{"column_names": ["ds", "hour"]}])
        db.get_extra = mock.Mock(return_value={})
        df = pd.DataFrame({"ds": ["01-01-19"], "hour": [1]})
        db.get_df = mock.Mock(return_value=df)
        columns = [{"name": "ds"}, {"name": "hour"}]
        result = PrestoEngineSpec.where_latest_partition(
            "test_table", "test_schema", db, select(), columns
        )
        query_result = str(result.compile(compile_kwargs={"literal_binds": True}))
        self.assertEqual("SELECT  \nWHERE ds = '01-01-19' AND hour = 1", query_result)

    def test_convert_dttm(self):
        dttm = self.get_dttm()

        self.assertEqual(
            PrestoEngineSpec.convert_dttm("DATE", dttm),
            "from_iso8601_date('2019-01-02')",
        )

        self.assertEqual(
            PrestoEngineSpec.convert_dttm("TIMESTAMP", dttm),
            "from_iso8601_timestamp('2019-01-02T03:04:05.678900')",
        )

    def test_query_cost_formatter(self):
        raw_cost = [
            {
                "inputTableColumnInfos": [
                    {
                        "table": {
                            "catalog": "hive",
                            "schemaTable": {
                                "schema": "default",
                                "table": "fact_passenger_state",
                            },
                        },
                        "columnConstraints": [
                            {
                                "columnName": "ds",
                                "typeSignature": "varchar",
                                "domain": {
                                    "nullsAllowed": False,
                                    "ranges": [
                                        {
                                            "low": {
                                                "value": "2019-07-10",
                                                "bound": "EXACTLY",
                                            },
                                            "high": {
                                                "value": "2019-07-10",
                                                "bound": "EXACTLY",
                                            },
                                        }
                                    ],
                                },
                            }
                        ],
                        "estimate": {
                            "outputRowCount": 9.04969899e8,
                            "outputSizeInBytes": 3.54143678301e11,
                            "cpuCost": 3.54143678301e11,
                            "maxMemory": 0.0,
                            "networkCost": 0.0,
                        },
                    }
                ],
                "estimate": {
                    "outputRowCount": 9.04969899e8,
                    "outputSizeInBytes": 3.54143678301e11,
                    "cpuCost": 3.54143678301e11,
                    "maxMemory": 0.0,
                    "networkCost": 3.54143678301e11,
                },
            }
        ]
        formatted_cost = PrestoEngineSpec.query_cost_formatter(raw_cost)
        expected = [
            {
                "Output count": "904 M rows",
                "Output size": "354 GB",
                "CPU cost": "354 G",
                "Max memory": "0 B",
                "Network cost": "354 G",
            }
        ]
        self.assertEqual(formatted_cost, expected)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"PRESTO_EXPAND_DATA": True},
        clear=True,
    )
    def test_presto_expand_data_array(self):
        cols = [
            {"name": "event_id", "type": "VARCHAR", "is_date": False},
            {"name": "timestamp", "type": "BIGINT", "is_date": False},
            {
                "name": "user",
                "type": "ROW(ID BIGINT, FIRST_NAME VARCHAR, LAST_NAME VARCHAR)",
                "is_date": False,
            },
        ]
        data = [
            {
                "event_id": "abcdef01-2345-6789-abcd-ef0123456789",
                "timestamp": "1595895506219",
                "user": '[1, "JOHN", "DOE"]',
            }
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "event_id", "type": "VARCHAR", "is_date": False},
            {"name": "timestamp", "type": "BIGINT", "is_date": False},
            {
                "name": "user",
                "type": "ROW(ID BIGINT, FIRST_NAME VARCHAR, LAST_NAME VARCHAR)",
                "is_date": False,
            },
            {"name": "user.id", "type": "BIGINT"},
            {"name": "user.first_name", "type": "VARCHAR"},
            {"name": "user.last_name", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "event_id": "abcdef01-2345-6789-abcd-ef0123456789",
                "timestamp": "1595895506219",
                "user": [1, "JOHN", "DOE"],
                "user.id": 1,
                "user.first_name": "JOHN",
                "user.last_name": "DOE",
            }
        ]
        expected_expanded_cols = [
            {"name": "user.id", "type": "BIGINT"},
            {"name": "user.first_name", "type": "VARCHAR"},
            {"name": "user.last_name", "type": "VARCHAR"},
        ]

        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    def test_get_sqla_column_type(self):
        column_spec = PrestoEngineSpec.get_column_spec("varchar(255)")
        assert isinstance(column_spec.sqla_type, types.VARCHAR)
        assert column_spec.sqla_type.length == 255
        self.assertEqual(column_spec.generic_type, GenericDataType.STRING)

        column_spec = PrestoEngineSpec.get_column_spec("varchar")
        assert isinstance(column_spec.sqla_type, types.String)
        assert column_spec.sqla_type.length is None
        self.assertEqual(column_spec.generic_type, GenericDataType.STRING)

        column_spec = PrestoEngineSpec.get_column_spec("char(10)")
        assert isinstance(column_spec.sqla_type, types.CHAR)
        assert column_spec.sqla_type.length == 10
        self.assertEqual(column_spec.generic_type, GenericDataType.STRING)

        column_spec = PrestoEngineSpec.get_column_spec("char")
        assert isinstance(column_spec.sqla_type, types.CHAR)
        assert column_spec.sqla_type.length is None
        self.assertEqual(column_spec.generic_type, GenericDataType.STRING)

        column_spec = PrestoEngineSpec.get_column_spec("integer")
        assert isinstance(column_spec.sqla_type, types.Integer)
        self.assertEqual(column_spec.generic_type, GenericDataType.NUMERIC)

        column_spec = PrestoEngineSpec.get_column_spec("time")
        assert isinstance(column_spec.sqla_type, types.Time)
        assert type(column_spec.sqla_type).__name__ == "TemporalWrapperType"
        self.assertEqual(column_spec.generic_type, GenericDataType.TEMPORAL)

        column_spec = PrestoEngineSpec.get_column_spec("timestamp")
        assert isinstance(column_spec.sqla_type, types.TIMESTAMP)
        assert type(column_spec.sqla_type).__name__ == "TemporalWrapperType"
        self.assertEqual(column_spec.generic_type, GenericDataType.TEMPORAL)

        sqla_type = PrestoEngineSpec.get_sqla_column_type(None)
        assert sqla_type is None

    @mock.patch(
        "superset.utils.feature_flag_manager.FeatureFlagManager.is_feature_enabled"
    )
    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.get_table_names")
    @mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.get_view_names")
    def test_get_table_names_no_split_views_from_tables(
        self, mock_get_view_names, mock_get_table_names, mock_is_feature_enabled
    ):
        mock_get_view_names.return_value = ["view1", "view2"]
        table_names = ["table1", "table2", "view1", "view2"]
        mock_get_table_names.return_value = table_names
        mock_is_feature_enabled.return_value = False
        tables = PrestoEngineSpec.get_table_names(mock.Mock(), mock.Mock(), None)
        assert tables == table_names

    @mock.patch(
        "superset.utils.feature_flag_manager.FeatureFlagManager.is_feature_enabled"
    )
    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.get_table_names")
    @mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.get_view_names")
    def test_get_table_names_split_views_from_tables(
        self, mock_get_view_names, mock_get_table_names, mock_is_feature_enabled
    ):
        mock_get_view_names.return_value = ["view1", "view2"]
        table_names = ["table1", "table2", "view1", "view2"]
        mock_get_table_names.return_value = table_names
        mock_is_feature_enabled.return_value = True
        tables = PrestoEngineSpec.get_table_names(mock.Mock(), mock.Mock(), None)
        assert sorted(tables) == sorted(table_names)

    @mock.patch(
        "superset.utils.feature_flag_manager.FeatureFlagManager.is_feature_enabled"
    )
    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.get_table_names")
    @mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.get_view_names")
    def test_get_table_names_split_views_from_tables_no_tables(
        self, mock_get_view_names, mock_get_table_names, mock_is_feature_enabled
    ):
        mock_get_view_names.return_value = []
        table_names = []
        mock_get_table_names.return_value = table_names
        mock_is_feature_enabled.return_value = True
        tables = PrestoEngineSpec.get_table_names(mock.Mock(), mock.Mock(), None)
        assert tables == []

    def test_get_full_name(self):
        names = [
            ("part1", "part2"),
            ("part11", "part22"),
        ]
        result = PrestoEngineSpec._get_full_name(names)
        assert result == "part1.part11"

    def test_get_full_name_empty_tuple(self):
        names = [
            ("part1", "part2"),
            ("", "part3"),
            ("part4", "part5"),
            ("", "part6"),
        ]
        result = PrestoEngineSpec._get_full_name(names)
        assert result == "part1.part4"

    def test_split_data_type(self):
        data_type = "value1 value2"
        result = PrestoEngineSpec._split_data_type(data_type, " ")
        assert result == ["value1", "value2"]

        data_type = "value1,value2"
        result = PrestoEngineSpec._split_data_type(data_type, ",")
        assert result == ["value1", "value2"]

        data_type = '"value,1",value2'
        result = PrestoEngineSpec._split_data_type(data_type, ",")
        assert result == ['"value,1"', "value2"]

    def test_show_columns(self):
        inspector = mock.MagicMock()
        inspector.engine.dialect.identifier_preparer.quote_identifier = (
            lambda x: f'"{x}"'
        )
        mock_execute = mock.MagicMock(return_value=["a", "b"])
        inspector.bind.execute = mock_execute
        table_name = "table_name"
        result = PrestoEngineSpec._show_columns(inspector, table_name, None)
        assert result == ["a", "b"]
        mock_execute.assert_called_once_with(f'SHOW COLUMNS FROM "{table_name}"')

    def test_show_columns_with_schema(self):
        inspector = mock.MagicMock()
        inspector.engine.dialect.identifier_preparer.quote_identifier = (
            lambda x: f'"{x}"'
        )
        mock_execute = mock.MagicMock(return_value=["a", "b"])
        inspector.bind.execute = mock_execute
        table_name = "table_name"
        schema = "schema"
        result = PrestoEngineSpec._show_columns(inspector, table_name, schema)
        assert result == ["a", "b"]
        mock_execute.assert_called_once_with(
            f'SHOW COLUMNS FROM "{schema}"."{table_name}"'
        )

    def test_is_column_name_quoted(self):
        column_name = "mock"
        assert PrestoEngineSpec._is_column_name_quoted(column_name) is False

        column_name = '"mock'
        assert PrestoEngineSpec._is_column_name_quoted(column_name) is False

        column_name = '"moc"k'
        assert PrestoEngineSpec._is_column_name_quoted(column_name) is False

        column_name = '"moc"k"'
        assert PrestoEngineSpec._is_column_name_quoted(column_name) is True

    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.select_star")
    def test_select_star_no_presto_expand_data(self, mock_select_star):
        database = mock.Mock()
        table_name = "table_name"
        engine = mock.Mock()
        cols = [
            {"col1": "val1"},
            {"col2": "val2"},
        ]
        PrestoEngineSpec.select_star(database, table_name, engine, cols=cols)
        mock_select_star.assert_called_once_with(
            database, table_name, engine, None, 100, False, True, True, cols
        )

    @mock.patch("superset.db_engine_specs.presto.is_feature_enabled")
    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.select_star")
    def test_select_star_presto_expand_data(
        self, mock_select_star, mock_is_feature_enabled
    ):
        mock_is_feature_enabled.return_value = True
        database = mock.Mock()
        table_name = "table_name"
        engine = mock.Mock()
        cols = [
            {"name": "val1"},
            {"name": "val2<?!@#$312,/'][p098"},
            {"name": ".val2"},
            {"name": "val2."},
            {"name": "val.2"},
            {"name": ".val2."},
        ]
        PrestoEngineSpec.select_star(
            database, table_name, engine, show_cols=True, cols=cols
        )
        mock_select_star.assert_called_once_with(
            database,
            table_name,
            engine,
            None,
            100,
            True,
            True,
            True,
            [{"name": "val1"}, {"name": "val2<?!@#$312,/'][p098"},],
        )

    def test_estimate_statement_cost(self):
        mock_cursor = mock.MagicMock()
        estimate_json = {"a": "b"}
        mock_cursor.fetchone.return_value = [
            '{"a": "b"}',
        ]
        result = PrestoEngineSpec.estimate_statement_cost(
            "SELECT * FROM brth_names", mock_cursor
        )
        assert result == estimate_json

    def test_estimate_statement_cost_invalid_syntax(self):
        mock_cursor = mock.MagicMock()
        mock_cursor.execute.side_effect = Exception()
        with self.assertRaises(Exception):
            PrestoEngineSpec.estimate_statement_cost(
                "DROP TABLE brth_names", mock_cursor
            )

    def test_get_all_datasource_names(self):
        df = pd.DataFrame.from_dict(
            {"table_schema": ["schema1", "schema2"], "table_name": ["name1", "name2"]}
        )
        database = mock.MagicMock()
        database.get_df.return_value = df
        result = PrestoEngineSpec.get_all_datasource_names(database, "table")
        expected_result = [
            DatasourceName(schema="schema1", table="name1"),
            DatasourceName(schema="schema2", table="name2"),
        ]
        assert result == expected_result

    def test_get_create_view(self):
        mock_execute = mock.MagicMock()
        mock_fetchall = mock.MagicMock(return_value=[["a", "b,", "c"], ["d", "e"]])
        database = mock.MagicMock()
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.execute = (
            mock_execute
        )
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.fetchall = (
            mock_fetchall
        )
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.poll.return_value = (
            False
        )
        schema = "schema"
        table = "table"
        result = PrestoEngineSpec.get_create_view(database, schema=schema, table=table)
        assert result == "a"
        mock_execute.assert_called_once_with(f"SHOW CREATE VIEW {schema}.{table}")

    def test_get_create_view_exception(self):
        mock_execute = mock.MagicMock(side_effect=Exception())
        database = mock.MagicMock()
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.execute = (
            mock_execute
        )
        schema = "schema"
        table = "table"
        with self.assertRaises(Exception):
            PrestoEngineSpec.get_create_view(database, schema=schema, table=table)

    def test_get_create_view_database_error(self):
        from pyhive.exc import DatabaseError

        mock_execute = mock.MagicMock(side_effect=DatabaseError())
        database = mock.MagicMock()
        database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value.execute = (
            mock_execute
        )
        schema = "schema"
        table = "table"
        result = PrestoEngineSpec.get_create_view(database, schema=schema, table=table)
        assert result is None

    def test_extract_error_message_orig(self):
        DatabaseError = namedtuple("DatabaseError", ["error_dict"])
        db_err = DatabaseError(
            {"errorName": "name", "errorLocation": "location", "message": "msg"}
        )
        exception = Exception()
        exception.orig = db_err
        result = PrestoEngineSpec._extract_error_message(exception)
        assert result == "name at location: msg"

    def test_extract_error_message_db_errr(self):
        from pyhive.exc import DatabaseError

        exception = DatabaseError({"message": "Err message"})
        result = PrestoEngineSpec._extract_error_message(exception)
        assert result == "Err message"

    def test_extract_error_message_general_exception(self):
        exception = Exception("Err message")
        result = PrestoEngineSpec._extract_error_message(exception)
        assert result == "Err message"

    def test_extract_errors(self):
        msg = "Generic Error"
        result = PrestoEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message="Generic Error",
                error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1002,
                            "message": "Issue 1002 - The database returned an unexpected error.",
                        }
                    ],
                },
            )
        ]

        msg = "line 1:8: Column 'bogus' cannot be resolved"
        result = PrestoEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='We can\'t seem to resolve the column "bogus" at line 1:8.',
                error_type=SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                        },
                        {
                            "code": 1004,
                            "message": "Issue 1004 - The column was deleted or renamed in the database.",
                        },
                    ],
                },
            )
        ]

        msg = "line 1:15: Table 'tpch.tiny.region2' does not exist"
        result = PrestoEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message="The table \"'tpch.tiny.region2'\" does not exist. A valid table must be used to run this query.",
                error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                        },
                        {
                            "code": 1005,
                            "message": "Issue 1005 - The table was deleted or renamed in the database.",
                        },
                    ],
                },
            )
        ]

        msg = "line 1:15: Schema 'tin' does not exist"
        result = PrestoEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='The schema "tin" does not exist. A valid schema must be used to run this query.',
                error_type=SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                        },
                        {
                            "code": 1016,
                            "message": "Issue 1005 - The schema was deleted or renamed in the database.",
                        },
                    ],
                },
            )
        ]

        msg = b"Access Denied: Invalid credentials"
        result = PrestoEngineSpec.extract_errors(Exception(msg), {"username": "alice"})
        assert result == [
            SupersetError(
                message='Either the username "alice" or the password is incorrect.',
                error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1014,
                            "message": "Issue 1014 - Either the username or the password is wrong.",
                        }
                    ],
                },
            )
        ]

        msg = "Failed to establish a new connection: [Errno 8] nodename nor servname provided, or not known"
        result = PrestoEngineSpec.extract_errors(
            Exception(msg), {"hostname": "badhost"}
        )
        assert result == [
            SupersetError(
                message='The hostname "badhost" cannot be resolved.',
                error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1007,
                            "message": "Issue 1007 - The hostname provided can't be resolved.",
                        }
                    ],
                },
            )
        ]

        msg = "Failed to establish a new connection: [Errno 60] Operation timed out"
        result = PrestoEngineSpec.extract_errors(
            Exception(msg), {"hostname": "badhost", "port": 12345}
        )
        assert result == [
            SupersetError(
                message='The host "badhost" might be down, and can\'t be reached on port 12345.',
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, and can't be reached on the provided port.",
                        }
                    ],
                },
            )
        ]

        msg = "Failed to establish a new connection: [Errno 61] Connection refused"
        result = PrestoEngineSpec.extract_errors(
            Exception(msg), {"hostname": "badhost", "port": 12345}
        )
        assert result == [
            SupersetError(
                message='Port 12345 on hostname "badhost" refused the connection.',
                error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {"code": 1008, "message": "Issue 1008 - The port is closed."}
                    ],
                },
            )
        ]

        msg = "line 1:15: Catalog 'wrong' does not exist"
        result = PrestoEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='Unable to connect to catalog named "wrong".',
                error_type=SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Presto",
                    "issue_codes": [
                        {
                            "code": 1015,
                            "message": "Issue 1015 - Either the database is spelled incorrectly or does not exist.",
                        }
                    ],
                },
            )
        ]


def test_is_readonly():
    def is_readonly(sql: str) -> bool:
        return PrestoEngineSpec.is_readonly_query(ParsedQuery(sql))

    assert not is_readonly("SET hivevar:desc='Legislators'")
    assert not is_readonly("UPDATE t1 SET col1 = NULL")
    assert not is_readonly("INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA")
    assert is_readonly("SHOW LOCKS test EXTENDED")
    assert is_readonly("EXPLAIN SELECT 1")
    assert is_readonly("SELECT 1")
    assert is_readonly("WITH (SELECT 1) bla SELECT * from bla")
