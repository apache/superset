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

from superset.db_engine_specs.type_parsing.base import Array, Map, Row, Type
from superset.db_engine_specs.type_parsing.trino import TrinoTypeParser

# Complex type nested three levels of ROW deep, with multiple fields at each
# level, to ensure fields are correctly parsed at multiple layers
DEEPLY_NESTED_ROWS_IN = (
    "row(row_1 row(row_1a row(f1 int, f2 varchar), "
    "row_1b row(f3 int, f4 int)), row_2 row(f5 varchar, f6 varchar), "
    "top_field_3 int)"
)
DEEPLY_NESTED_ROWS_OUT = Row(
    [
        (
            "row_1",
            Row(
                [
                    ("row_1a", Row([("f1", Type("int")), ("f2", Type("varchar"))])),
                    ("row_1b", Row([("f3", Type("int")), ("f4", Type("int"))])),
                ]
            ),
        ),
        ("row_2", Row([("f5", Type("varchar")), ("f6", Type("varchar"))])),
        ("top_field_3", Type("int")),
    ]
)


@pytest.mark.parametrize(
    "typedef,expected",
    [
        ("varchar", Type("varchar")),
        ("array(int)", Array(Type("int"))),
        ("array(array(int))", Array(Array(Type("int")))),
        ("map(int, int)", Map(Type("int"), Type("int"))),
        ("map(varchar, array(int))", Map(Type("varchar"), Array(Type("int")))),
        (
            "map(varchar, map(varchar, varchar))",
            Map(Type("varchar"), Map(Type("varchar"), Type("varchar"))),
        ),
        (
            "row(f1 int, f2 varchar)",
            Row([("f1", Type("int")), ("f2", Type("varchar"))]),
        ),
        (
            "row(f1 int, f2 array(int))",
            Row([("f1", Type("int")), ("f2", Array(Type("int")))]),
        ),
        # Rows may also have unnamed fields, or a mix of named and unnamed
        ("row(int, int, int)", Row([(None, Type("int"))] * 3)),
        ("row(x int, int)", Row([("x", Type("int")), (None, Type("int"))])),
        # Types can also be nested arbitrarily deep
        ("row(r1 row(f1 int))", Row([("r1", Row([("f1", Type("int"))]))])),
        (DEEPLY_NESTED_ROWS_IN, DEEPLY_NESTED_ROWS_OUT),
    ],
)
def test_trino_type_parser(typedef: str, expected: Type):
    """Test that trino structural types are parsed correctly"""
    parser = TrinoTypeParser()
    actual = parser.parse_type(typedef)

    assert actual == expected, f"{actual.to_dict()} != {expected.to_dict()}"


@pytest.mark.parametrize(
    "typedef", ["row(field name has spaces varchar)", "row(or_worse()) varchar)"]
)
def test_trino_type_parser_malformed(typedef: str):
    """Test that malformed or ambiguous inputs from trino fail to parse"""
    parser = TrinoTypeParser()

    with pytest.raises(ValueError):
        parser.parse_type(typedef)
