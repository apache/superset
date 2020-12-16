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
from unittest import mock, skipUnless

import pandas as pd
from sqlalchemy import types
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.sql import select

from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.sql_parse import ParsedQuery
from tests.db_engine_specs.base_tests import TestDbEngineSpec


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
        sqla_type = PrestoEngineSpec.get_sqla_column_type("varchar(255)")
        assert isinstance(sqla_type, types.VARCHAR)
        assert sqla_type.length == 255

        sqla_type = PrestoEngineSpec.get_sqla_column_type("varchar")
        assert isinstance(sqla_type, types.String)
        assert sqla_type.length is None

        sqla_type = PrestoEngineSpec.get_sqla_column_type("char(10)")
        assert isinstance(sqla_type, types.CHAR)
        assert sqla_type.length == 10

        sqla_type = PrestoEngineSpec.get_sqla_column_type("char")
        assert isinstance(sqla_type, types.CHAR)
        assert sqla_type.length is None

        sqla_type = PrestoEngineSpec.get_sqla_column_type("integer")
        assert isinstance(sqla_type, types.Integer)

        sqla_type = PrestoEngineSpec.get_sqla_column_type(None)
        assert sqla_type is None


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
