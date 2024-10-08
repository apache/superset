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
# isort:skip_file
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import os
import re
from typing import Any, Optional
from unittest.mock import Mock, patch  # noqa: F401

from superset.commands.database.exceptions import DatabaseInvalidError
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)

import numpy as np
import pandas as pd
import pytest
from flask import Flask, g  # noqa: F401
import marshmallow
from sqlalchemy.exc import ArgumentError  # noqa: F401

import tests.integration_tests.test_app  # noqa: F401
from superset import app, db, security_manager
from superset.constants import NO_TIME_RANGE
from superset.exceptions import CertificateException, SupersetException  # noqa: F401
from superset.models.core import Database, Log
from superset.models.dashboard import Dashboard  # noqa: F401
from superset.models.slice import Slice  # noqa: F401
from superset.utils.core import (
    cast_to_num,
    convert_legacy_filters_into_adhoc,
    create_ssl_cert_file,
    DTTM_ALIAS,
    extract_dataframe_dtypes,
    GenericDataType,
    get_form_data_token,
    as_list,
    get_email_address_list,
    get_stacktrace,
    merge_extra_filters,
    merge_extra_form_data,
    merge_request_params,
    normalize_dttm_col,
    parse_ssl_cert,
    parse_js_uri_path_item,
    split,
    zlib_compress,
    zlib_decompress,
    DateColumn,
)
from superset.utils import json
from superset.utils.database import get_or_create_db
from superset.utils import schema
from superset.utils.hashing import md5_sha_from_str
from superset.views.utils import build_extra_filters, get_form_data  # noqa: F401
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)

from .fixtures.certificates import ssl_certificate


class TestUtils(SupersetTestCase):
    def test_json_int_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        ts = 1577836800000.0
        assert json.json_int_dttm_ser(dttm) == ts
        assert json.json_int_dttm_ser(date(2020, 1, 1)) == ts
        assert json.json_int_dttm_ser(datetime(1970, 1, 1)) == 0
        assert json.json_int_dttm_ser(date(1970, 1, 1)) == 0
        assert json.json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)
        assert json.json_int_dttm_ser(np.int64(1)) == 1

        with self.assertRaises(TypeError):
            json.json_int_dttm_ser(np.datetime64())

    def test_json_iso_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        dt = date(2020, 1, 1)
        t = time()
        assert json.json_iso_dttm_ser(dttm) == dttm.isoformat()
        assert json.json_iso_dttm_ser(dt) == dt.isoformat()
        assert json.json_iso_dttm_ser(t) == t.isoformat()
        assert json.json_iso_dttm_ser(np.int64(1)) == 1

        assert (
            json.json_iso_dttm_ser(np.datetime64(), pessimistic=True)
            == "Unserializable [<class 'numpy.datetime64'>]"
        )

        with self.assertRaises(TypeError):
            json.json_iso_dttm_ser(np.datetime64())

    def test_base_json_conv(self):
        assert isinstance(json.base_json_conv(np.bool_(1)), bool)
        assert isinstance(json.base_json_conv(np.int64(1)), int)
        assert isinstance(json.base_json_conv(np.array([1, 2, 3])), list)
        assert json.base_json_conv(np.array(None)) is None
        assert isinstance(json.base_json_conv({1}), list)
        assert isinstance(json.base_json_conv(Decimal("1.0")), float)
        assert isinstance(json.base_json_conv(uuid.uuid4()), str)
        assert isinstance(json.base_json_conv(time()), str)
        assert isinstance(json.base_json_conv(timedelta(0)), str)
        assert isinstance(json.base_json_conv(b""), str)
        assert isinstance(json.base_json_conv(b"\xff\xfe"), str)
        assert json.base_json_conv(b"\xff") == "[bytes]"

        with pytest.raises(TypeError):
            json.base_json_conv(np.datetime64())

    def test_zlib_compression(self):
        json_str = '{"test": 1}'
        blob = zlib_compress(json_str)
        got_str = zlib_decompress(blob)
        assert json_str == got_str

    def test_merge_extra_filters(self):
        # does nothing if no extra filters
        form_data = {"A": 1, "B": 2, "c": "test"}
        expected = {**form_data, "adhoc_filters": [], "applied_time_extras": {}}
        merge_extra_filters(form_data)
        assert form_data == expected
        # empty extra_filters
        form_data = {"A": 1, "B": 2, "c": "test", "extra_filters": []}
        expected = {
            "A": 1,
            "B": 2,
            "c": "test",
            "adhoc_filters": [],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected
        # copy over extra filters into empty filters
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": "someval"},
                {"col": "B", "op": "==", "val": ["c1", "c2"]},
            ]
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                    "isExtra": True,
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "filterOptionName": "6c178d069965f1c02640661280415d96",
                    "isExtra": True,
                    "operator": "==",
                    "subject": "B",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected
        # adds extra filters to existing filters
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": "someval"},
                {"col": "B", "op": "==", "val": ["c1", "c2"]},
            ],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["G1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "!=",
                    "subject": "D",
                }
            ],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["G1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "!=",
                    "subject": "D",
                },
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                    "isExtra": True,
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "filterOptionName": "6c178d069965f1c02640661280415d96",
                    "isExtra": True,
                    "operator": "==",
                    "subject": "B",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected
        # adds extra filters to existing filters and sets time options
        form_data = {
            "extra_filters": [
                {"col": "__time_range", "op": "in", "val": "1 year ago :"},
                {"col": "__time_col", "op": "in", "val": "birth_year"},
                {"col": "__time_grain", "op": "in", "val": "years"},
                {"col": "A", "op": "like", "val": "hello"},
            ]
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "hello",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "e3cbdd92a2ae23ca92c6d7fca42e36a6",
                    "isExtra": True,
                    "operator": "like",
                    "subject": "A",
                }
            ],
            "time_range": "1 year ago :",
            "granularity_sqla": "birth_year",
            "time_grain_sqla": "years",
            "applied_time_extras": {
                "__time_range": "1 year ago :",
                "__time_col": "birth_year",
                "__time_grain": "years",
            },
        }
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_ignores_empty_filters(self):
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": ""},
                {"col": "B", "op": "==", "val": []},
            ]
        }
        expected = {"adhoc_filters": [], "applied_time_extras": {}}
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_ignores_nones(self):
        form_data = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": None,
                }
            ],
            "extra_filters": [{"col": "B", "op": "==", "val": []}],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": None,
                }
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_ignores_equal_filters(self):
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": "someval"},
                {"col": "B", "op": "==", "val": ["c1", "c2"]},
                {"col": "c", "op": "in", "val": ["c1", 1, None]},
            ],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", 1, None],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "c",
                },
            ],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", 1, None],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "c",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_merges_different_val_types(self):
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": ["g1", "g2"]},
                {"col": "B", "op": "==", "val": ["c1", "c2"]},
            ],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
            ],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2"],
                    "expressionType": "SIMPLE",
                    "filterOptionName": "c11969c994b40a83a4ae7d48ff1ea28e",
                    "isExtra": True,
                    "operator": "in",
                    "subject": "a",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": "someval"},
                {"col": "B", "op": "==", "val": ["c1", "c2"]},
            ],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
            ],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                    "isExtra": True,
                    "operator": "in",
                    "subject": "a",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_adds_unequal_lists(self):
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": ["g1", "g2", "g3"]},
                {"col": "B", "op": "==", "val": ["c1", "c2", "c3"]},
            ],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
            ],
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2"],
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["g1", "g2", "g3"],
                    "expressionType": "SIMPLE",
                    "filterOptionName": "21cbb68af7b17e62b3b2f75e2190bfd7",
                    "isExtra": True,
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2", "c3"],
                    "expressionType": "SIMPLE",
                    "filterOptionName": "0a8dcb928f1f4bba97643c6e68d672f1",
                    "isExtra": True,
                    "operator": "==",
                    "subject": "B",
                },
            ],
            "applied_time_extras": {},
        }
        merge_extra_filters(form_data)
        assert form_data == expected

    def test_merge_extra_filters_when_applied_time_extras_predefined(self):
        form_data = {"applied_time_extras": {"__time_range": "Last week"}}
        merge_extra_filters(form_data)

        assert form_data == {
            "applied_time_extras": {"__time_range": "Last week"},
            "adhoc_filters": [],
        }

    def test_merge_request_params_when_url_params_undefined(self):
        form_data = {"since": "2000", "until": "now"}
        url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
        merge_request_params(form_data, url_params)
        assert "url_params" in form_data.keys()
        assert "dashboard_ids" in form_data["url_params"]
        assert "form_data" not in form_data.keys()

    def test_merge_request_params_when_url_params_predefined(self):
        form_data = {
            "since": "2000",
            "until": "now",
            "url_params": {"abc": "123", "dashboard_ids": "(1,2,3)"},
        }
        url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
        merge_request_params(form_data, url_params)
        assert "url_params" in form_data.keys()
        assert "abc" in form_data["url_params"]
        assert url_params["dashboard_ids"] == form_data["url_params"]["dashboard_ids"]

    def test_format_timedelta(self):
        assert json.format_timedelta(timedelta(0)) == "0:00:00"
        assert json.format_timedelta(timedelta(days=1)) == "1 day, 0:00:00"
        assert json.format_timedelta(timedelta(minutes=-6)) == "-0:06:00"
        assert (
            json.format_timedelta(timedelta(0) - timedelta(days=1, hours=5, minutes=6))
            == "-1 day, 5:06:00"
        )
        assert (
            json.format_timedelta(timedelta(0) - timedelta(days=16, hours=4, minutes=3))
            == "-16 days, 4:03:00"
        )

    def test_validate_json(self):
        valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
        assert json.validate_json(valid) is None
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        with self.assertRaises(json.JSONDecodeError):
            json.validate_json(invalid)

    def test_convert_legacy_filters_into_adhoc_where(self):
        form_data = {"where": "a = 1"}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SQL",
                    "filterOptionName": "46fb6d7891e23596e42ae38da94a57e0",
                    "sqlExpression": "a = 1",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        assert form_data == expected

    def test_convert_legacy_filters_into_adhoc_filters(self):
        form_data = {"filters": [{"col": "a", "op": "in", "val": "someval"}]}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "filterOptionName": "135c7ee246666b840a3d7a9c3a30cf38",
                    "operator": "in",
                    "subject": "a",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        assert form_data == expected

    def test_convert_legacy_filters_into_adhoc_present_and_empty(self):
        form_data = {"adhoc_filters": [], "where": "a = 1"}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SQL",
                    "filterOptionName": "46fb6d7891e23596e42ae38da94a57e0",
                    "sqlExpression": "a = 1",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        assert form_data == expected

    def test_convert_legacy_filters_into_adhoc_having(self):
        form_data = {"having": "COUNT(1) = 1"}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "HAVING",
                    "expressionType": "SQL",
                    "filterOptionName": "683f1c26466ab912f75a00842e0f2f7b",
                    "sqlExpression": "COUNT(1) = 1",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        assert form_data == expected

    def test_convert_legacy_filters_into_adhoc_present_and_nonempty(self):
        form_data = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ],
            "filters": [{"col": "a", "op": "in", "val": "someval"}],
            "having": "COUNT(1) = 1",
        }
        expected = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        assert form_data == expected

    def test_parse_js_uri_path_items_eval_undefined(self):
        assert parse_js_uri_path_item("undefined", eval_undefined=True) is None
        assert parse_js_uri_path_item("null", eval_undefined=True) is None
        assert "undefined" == parse_js_uri_path_item("undefined")
        assert "null" == parse_js_uri_path_item("null")

    def test_parse_js_uri_path_items_unquote(self):
        assert "slashed/name" == parse_js_uri_path_item("slashed%2fname")
        assert "slashed%2fname" == parse_js_uri_path_item(
            "slashed%2fname", unquote=False
        )

    def test_parse_js_uri_path_items_item_optional(self):
        assert parse_js_uri_path_item(None) is None
        assert parse_js_uri_path_item("item") is not None

    def test_get_stacktrace(self):
        app.config["SHOW_STACKTRACE"] = True
        try:
            raise Exception("NONONO!")
        except Exception:
            stacktrace = get_stacktrace()
            assert "NONONO" in stacktrace

        app.config["SHOW_STACKTRACE"] = False
        try:
            raise Exception("NONONO!")
        except Exception:
            stacktrace = get_stacktrace()
            assert stacktrace is None

    def test_split(self):
        assert list(split("a b")) == ["a", "b"]
        assert list(split("a,b", delimiter=",")) == ["a", "b"]
        assert list(split("a,(b,a)", delimiter=",")) == ["a", "(b,a)"]
        assert list(split('a,(b,a),"foo , bar"', delimiter=",")) == [
            "a",
            "(b,a)",
            '"foo , bar"',
        ]
        assert list(split("a,'b,c'", delimiter=",", quote="'")) == ["a", "'b,c'"]
        assert list(split('a "b c"')) == ["a", '"b c"']
        assert list(split('a "b \\" c"')) == ["a", '"b \\" c"']

    def test_get_or_create_db(self):
        get_or_create_db("test_db", "sqlite:///superset.db")
        database = db.session.query(Database).filter_by(database_name="test_db").one()
        assert database is not None
        assert database.sqlalchemy_uri == "sqlite:///superset.db"
        assert (
            security_manager.find_permission_view_menu("database_access", database.perm)
            is not None
        )
        # Test change URI
        get_or_create_db("test_db", "sqlite:///changed.db")
        database = db.session.query(Database).filter_by(database_name="test_db").one()
        assert database.sqlalchemy_uri == "sqlite:///changed.db"
        db.session.delete(database)
        db.session.commit()

    def test_get_or_create_db_invalid_uri(self):
        with self.assertRaises(DatabaseInvalidError):
            get_or_create_db("test_db", "yoursql:superset.db/()")

    def test_get_or_create_db_existing_invalid_uri(self):
        database = get_or_create_db("test_db", "sqlite:///superset.db")
        database.sqlalchemy_uri = "None"
        db.session.commit()
        database = get_or_create_db("test_db", "sqlite:///superset.db")
        assert database.sqlalchemy_uri == "sqlite:///superset.db"

    def test_as_list(self):
        self.assertListEqual(as_list(123), [123])  # noqa: PT009
        self.assertListEqual(as_list([123]), [123])  # noqa: PT009
        self.assertListEqual(as_list("foo"), ["foo"])  # noqa: PT009

    def test_merge_extra_filters_with_no_extras(self):
        form_data = {
            "time_range": "Last 10 days",
        }
        merge_extra_form_data(form_data)
        assert form_data == {"time_range": "Last 10 days", "adhoc_filters": []}

    def test_merge_extra_filters_with_unset_legacy_time_range(self):
        """
        Make sure native filter is applied if filter time range is unset.
        """
        form_data = {
            "time_range": "Last 10 days",
            "extra_filters": [
                {"col": "__time_range", "op": "==", "val": NO_TIME_RANGE},
            ],
            "extra_form_data": {"time_range": "Last year"},
        }
        merge_extra_filters(form_data)
        assert form_data == {
            "time_range": "Last year",
            "applied_time_extras": {},
            "adhoc_filters": [],
        }

    def test_merge_extra_filters_with_extras(self):
        form_data = {
            "time_range": "Last 10 days",
            "extra_form_data": {
                "filters": [{"col": "foo", "op": "IN", "val": ["bar"]}],
                "adhoc_filters": [
                    {
                        "expressionType": "SQL",
                        "clause": "WHERE",
                        "sqlExpression": "1 = 0",
                    }
                ],
                "time_range": "Last 100 years",
                "time_grain_sqla": "PT1M",
                "relative_start": "now",
            },
        }
        merge_extra_form_data(form_data)
        adhoc_filters = form_data["adhoc_filters"]
        assert adhoc_filters[0] == {
            "clause": "WHERE",
            "expressionType": "SQL",
            "isExtra": True,
            "sqlExpression": "1 = 0",
        }
        converted_filter = adhoc_filters[1]
        del converted_filter["filterOptionName"]
        assert converted_filter == {
            "clause": "WHERE",
            "comparator": ["bar"],
            "expressionType": "SIMPLE",
            "isExtra": True,
            "operator": "IN",
            "subject": "foo",
        }
        assert form_data["time_range"] == "Last 100 years"
        assert form_data["time_grain_sqla"] == "PT1M"
        assert form_data["extras"]["relative_start"] == "now"

    def test_ssl_certificate_parse(self):
        parsed_certificate = parse_ssl_cert(ssl_certificate)
        assert parsed_certificate.serial_number == 12355228710836649848

    def test_ssl_certificate_file_creation(self):
        path = create_ssl_cert_file(ssl_certificate)
        expected_filename = md5_sha_from_str(ssl_certificate)
        assert expected_filename in path
        assert os.path.exists(path)

    def test_get_email_address_list(self):
        assert get_email_address_list("a@a") == ["a@a"]
        assert get_email_address_list(" a@a ") == ["a@a"]
        assert get_email_address_list("a@a\n") == ["a@a"]
        assert get_email_address_list(",a@a;") == ["a@a"]
        assert get_email_address_list(",a@a; b@b c@c a-c@c; d@d, f@f") == [
            "a@a",
            "b@b",
            "c@c",
            "a-c@c",
            "d@d",
            "f@f",
        ]

    def test_get_form_data_default(self) -> None:
        form_data, slc = get_form_data()
        assert slc is None

    def test_get_form_data_request_args(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"foo": "bar"})}
        ):
            form_data, slc = get_form_data()
            assert form_data == {"foo": "bar"}
            assert slc is None

    def test_get_form_data_request_form(self) -> None:
        with app.test_request_context(data={"form_data": json.dumps({"foo": "bar"})}):
            form_data, slc = get_form_data()
            assert form_data == {"foo": "bar"}
            assert slc is None

    def test_get_form_data_request_form_with_queries(self) -> None:
        # the CSV export uses for requests, even when sending requests to
        # /api/v1/chart/data
        with app.test_request_context(
            data={
                "form_data": json.dumps({"queries": [{"url_params": {"foo": "bar"}}]})
            }
        ):
            form_data, slc = get_form_data()
            assert form_data == {"url_params": {"foo": "bar"}}
            assert slc is None

    def test_get_form_data_request_args_and_form(self) -> None:
        with app.test_request_context(
            data={"form_data": json.dumps({"foo": "bar"})},
            query_string={"form_data": json.dumps({"baz": "bar"})},
        ):
            form_data, slc = get_form_data()
            assert form_data == {"baz": "bar", "foo": "bar"}
            assert slc is None

    def test_get_form_data_globals(self) -> None:
        with app.test_request_context():
            g.form_data = {"foo": "bar"}
            form_data, slc = get_form_data()
            delattr(g, "form_data")
            assert form_data == {"foo": "bar"}
            assert slc is None

    def test_get_form_data_corrupted_json(self) -> None:
        with app.test_request_context(
            data={"form_data": "{x: '2324'}"},
            query_string={"form_data": '{"baz": "bar"'},
        ):
            form_data, slc = get_form_data()
            assert form_data == {}
            assert slc is None

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_log_this(self) -> None:
        # TODO: Add additional scenarios.
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Top 10 Girl Name Share")
        dashboard_id = 1

        assert slc.viz is not None
        resp = self.get_json_resp(  # noqa: F841
            f"/superset/explore_json/{slc.datasource_type}/{slc.datasource_id}/"
            + f'?form_data={{"slice_id": {slc.id}}}&dashboard_id={dashboard_id}',
            {"form_data": json.dumps(slc.viz.form_data)},
        )

        record = (
            db.session.query(Log)
            .filter_by(action="explore_json", slice_id=slc.id)
            .order_by(Log.dttm.desc())
            .first()
        )

        assert record.dashboard_id == dashboard_id
        assert json.loads(record.json)["dashboard_id"] == str(dashboard_id)
        assert json.loads(record.json)["form_data"]["slice_id"] == slc.id

        assert (
            json.loads(record.json)["form_data"]["viz_type"]
            == slc.viz.form_data["viz_type"]
        )

    def test_schema_validate_json(self):
        valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
        assert schema.validate_json(valid) is None
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        self.assertRaises(marshmallow.ValidationError, schema.validate_json, invalid)

    def test_schema_one_of_case_insensitive(self):
        validator = schema.OneOfCaseInsensitive(choices=[1, 2, 3, "FoO", "BAR", "baz"])
        assert 1 == validator(1)
        assert 2 == validator(2)
        assert "FoO" == validator("FoO")
        assert "FOO" == validator("FOO")
        assert "bar" == validator("bar")
        assert "BaZ" == validator("BaZ")
        self.assertRaises(marshmallow.ValidationError, validator, "qwerty")
        self.assertRaises(marshmallow.ValidationError, validator, 4)

    def test_cast_to_num(self) -> None:
        assert cast_to_num("5") == 5
        assert cast_to_num("5.2") == 5.2
        assert cast_to_num(10) == 10
        assert cast_to_num(10.1) == 10.1
        assert cast_to_num(None) is None
        assert cast_to_num("this is not a string") is None

    def test_get_form_data_token(self):
        assert get_form_data_token({"token": "token_abcdefg1"}) == "token_abcdefg1"
        generated_token = get_form_data_token({})
        assert re.match(r"^token_[a-z0-9]{8}$", generated_token) is not None

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_extract_dataframe_dtypes(self):
        slc = self.get_slice("Girls")
        cols: tuple[tuple[str, GenericDataType, list[Any]], ...] = (
            ("dt", GenericDataType.TEMPORAL, [date(2021, 2, 4), date(2021, 2, 4)]),
            (
                "dttm",
                GenericDataType.TEMPORAL,
                [datetime(2021, 2, 4, 1, 1, 1), datetime(2021, 2, 4, 1, 1, 1)],
            ),
            ("str", GenericDataType.STRING, ["foo", "foo"]),
            ("int", GenericDataType.NUMERIC, [1, 1]),
            ("float", GenericDataType.NUMERIC, [0.5, 0.5]),
            ("mixed-int-float", GenericDataType.NUMERIC, [0.5, 1.0]),
            ("bool", GenericDataType.BOOLEAN, [True, False]),
            ("mixed-str-int", GenericDataType.STRING, ["abc", 1.0]),
            ("obj", GenericDataType.STRING, [{"a": 1}, {"a": 1}]),
            ("dt_null", GenericDataType.TEMPORAL, [None, date(2021, 2, 4)]),
            (
                "dttm_null",
                GenericDataType.TEMPORAL,
                [None, datetime(2021, 2, 4, 1, 1, 1)],
            ),
            ("str_null", GenericDataType.STRING, [None, "foo"]),
            ("int_null", GenericDataType.NUMERIC, [None, 1]),
            ("float_null", GenericDataType.NUMERIC, [None, 0.5]),
            ("bool_null", GenericDataType.BOOLEAN, [None, False]),
            ("obj_null", GenericDataType.STRING, [None, {"a": 1}]),
            # Non-timestamp columns should be identified as temporal if
            # `is_dttm` is set to `True` in the underlying datasource
            ("ds", GenericDataType.TEMPORAL, [None, {"ds": "2017-01-01"}]),
        )

        df = pd.DataFrame(data={col[0]: col[2] for col in cols})
        assert extract_dataframe_dtypes(df, slc.datasource) == [col[1] for col in cols]

    def test_normalize_dttm_col(self):
        def normalize_col(
            df: pd.DataFrame,
            timestamp_format: Optional[str],
            offset: int,
            time_shift: Optional[str],
        ) -> pd.DataFrame:
            df = df.copy()
            normalize_dttm_col(
                df,
                tuple(
                    [
                        DateColumn.get_legacy_time_column(
                            timestamp_format=timestamp_format,
                            offset=offset,
                            time_shift=time_shift,
                        )
                    ]
                ),
            )
            return df

        ts = pd.Timestamp(2021, 2, 15, 19, 0, 0, 0)
        df = pd.DataFrame([{"__timestamp": ts, "a": 1}])

        # test regular (non-numeric) format
        assert normalize_col(df, None, 0, None)[DTTM_ALIAS][0] == ts
        assert normalize_col(df, "epoch_ms", 0, None)[DTTM_ALIAS][0] == ts
        assert normalize_col(df, "epoch_s", 0, None)[DTTM_ALIAS][0] == ts

        # test offset
        assert normalize_col(df, None, 1, None)[DTTM_ALIAS][0] == pd.Timestamp(
            2021, 2, 15, 20, 0, 0, 0
        )

        # test offset and timedelta
        assert normalize_col(df, None, 1, "30 minutes")[DTTM_ALIAS][0] == pd.Timestamp(
            2021, 2, 15, 20, 30, 0, 0
        )

        # test numeric epoch_s format
        df = pd.DataFrame([{"__timestamp": ts.timestamp(), "a": 1}])
        assert normalize_col(df, "epoch_s", 0, None)[DTTM_ALIAS][0] == ts

        # test numeric epoch_ms format
        df = pd.DataFrame([{"__timestamp": ts.timestamp() * 1000, "a": 1}])
        assert normalize_col(df, "epoch_ms", 0, None)[DTTM_ALIAS][0] == ts

        # test that we raise an error when we can't convert
        df = pd.DataFrame([{"__timestamp": "1677-09-21 00:00:00", "a": 1}])
        with pytest.raises(pd.errors.OutOfBoundsDatetime):
            normalize_col(df, None, 0, None)
