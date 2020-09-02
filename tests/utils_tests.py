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
import unittest
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import hashlib
import json
import os
import re
from unittest.mock import Mock, patch

import numpy
from flask import Flask, g
from flask_caching import Cache
import marshmallow
from sqlalchemy.exc import ArgumentError

import tests.test_app
from superset import app, db, security_manager
from superset.exceptions import CertificateException, SupersetException
from superset.models.core import Database, Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.cache_manager import CacheManager
from superset.utils.core import (
    base_json_conv,
    cast_to_num,
    convert_legacy_filters_into_adhoc,
    create_ssl_cert_file,
    format_timedelta,
    get_form_data_token,
    get_iterable,
    get_email_address_list,
    get_or_create_db,
    get_since_until,
    get_stacktrace,
    json_int_dttm_ser,
    json_iso_dttm_ser,
    JSONEncodedDict,
    memoized,
    merge_extra_filters,
    merge_request_params,
    parse_ssl_cert,
    parse_human_timedelta,
    parse_js_uri_path_item,
    parse_past_timedelta,
    split,
    TimeRangeEndpoint,
    validate_json,
    zlib_compress,
    zlib_decompress,
)
from superset.utils import schema
from superset.views.utils import (
    build_extra_filters,
    get_form_data,
    get_time_range_endpoints,
)
from tests.base_tests import SupersetTestCase

from .fixtures.certificates import ssl_certificate


def mock_parse_human_datetime(s):
    if s == "now":
        return datetime(2016, 11, 7, 9, 30, 10)
    elif s == "today":
        return datetime(2016, 11, 7)
    elif s == "yesterday":
        return datetime(2016, 11, 6)
    elif s == "tomorrow":
        return datetime(2016, 11, 8)
    elif s == "Last year":
        return datetime(2015, 11, 7)
    elif s == "Last week":
        return datetime(2015, 10, 31)
    elif s == "Last 5 months":
        return datetime(2016, 6, 7)
    elif s == "Next 5 months":
        return datetime(2017, 4, 7)
    elif s in ["5 days", "5 days ago"]:
        return datetime(2016, 11, 2)
    elif s == "2018-01-01T00:00:00":
        return datetime(2018, 1, 1)
    elif s == "2018-12-31T23:59:59":
        return datetime(2018, 12, 31, 23, 59, 59)


def mock_to_adhoc(filt, expressionType="SIMPLE", clause="where"):
    result = {"clause": clause.upper(), "expressionType": expressionType}

    if expressionType == "SIMPLE":
        result.update(
            {"comparator": filt["val"], "operator": filt["op"], "subject": filt["col"]}
        )
    elif expressionType == "SQL":
        result.update({"sqlExpression": filt[clause]})

    return result


class TestUtils(SupersetTestCase):
    def test_json_int_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        ts = 1577836800000.0
        assert json_int_dttm_ser(dttm) == ts
        assert json_int_dttm_ser(date(2020, 1, 1)) == ts
        assert json_int_dttm_ser(datetime(1970, 1, 1)) == 0
        assert json_int_dttm_ser(date(1970, 1, 1)) == 0
        assert json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)

        with self.assertRaises(TypeError):
            json_int_dttm_ser("this is not a date")

    def test_json_iso_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        dt = date(2020, 1, 1)
        t = time()
        assert json_iso_dttm_ser(dttm) == dttm.isoformat()
        assert json_iso_dttm_ser(dt) == dt.isoformat()
        assert json_iso_dttm_ser(t) == t.isoformat()

        with self.assertRaises(TypeError):
            json_iso_dttm_ser("this is not a date")

    def test_base_json_conv(self):
        assert isinstance(base_json_conv(numpy.bool_(1)), bool) is True
        assert isinstance(base_json_conv(numpy.int64(1)), int) is True
        assert isinstance(base_json_conv(numpy.array([1, 2, 3])), list) is True
        assert isinstance(base_json_conv(set([1])), list) is True
        assert isinstance(base_json_conv(Decimal("1.0")), float) is True
        assert isinstance(base_json_conv(uuid.uuid4()), str) is True
        assert isinstance(base_json_conv(timedelta(0)), str) is True

    @patch("superset.utils.core.datetime")
    def test_parse_human_timedelta(self, mock_datetime):
        mock_datetime.now.return_value = datetime(2019, 4, 1)
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        self.assertEqual(parse_human_timedelta("now"), timedelta(0))
        self.assertEqual(parse_human_timedelta("1 year"), timedelta(366))
        self.assertEqual(parse_human_timedelta("-1 year"), timedelta(-365))
        self.assertEqual(parse_human_timedelta(None), timedelta(0))

    @patch("superset.utils.core.datetime")
    def test_parse_past_timedelta(self, mock_datetime):
        mock_datetime.now.return_value = datetime(2019, 4, 1)
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        self.assertEqual(parse_past_timedelta("1 year"), timedelta(365))
        self.assertEqual(parse_past_timedelta("-1 year"), timedelta(365))
        self.assertEqual(parse_past_timedelta("52 weeks"), timedelta(364))
        self.assertEqual(parse_past_timedelta("1 month"), timedelta(31))

    def test_zlib_compression(self):
        json_str = '{"test": 1}'
        blob = zlib_compress(json_str)
        got_str = zlib_decompress(blob)
        self.assertEqual(json_str, got_str)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_merge_extra_filters(self):
        # does nothing if no extra filters
        form_data = {"A": 1, "B": 2, "c": "test"}
        expected = {"A": 1, "B": 2, "c": "test"}
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)
        # empty extra_filters
        form_data = {"A": 1, "B": 2, "c": "test", "extra_filters": []}
        expected = {"A": 1, "B": 2, "c": "test", "adhoc_filters": []}
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)
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
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)
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
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)
        # adds extra filters to existing filters and sets time options
        form_data = {
            "extra_filters": [
                {"col": "__time_range", "op": "in", "val": "1 year ago :"},
                {"col": "__time_col", "op": "in", "val": "birth_year"},
                {"col": "__time_grain", "op": "in", "val": "years"},
                {"col": "A", "op": "like", "val": "hello"},
                {"col": "__time_origin", "op": "in", "val": "now"},
                {"col": "__granularity", "op": "in", "val": "90 seconds"},
            ]
        }
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "hello",
                    "expressionType": "SIMPLE",
                    "operator": "like",
                    "subject": "A",
                }
            ],
            "time_range": "1 year ago :",
            "granularity_sqla": "birth_year",
            "time_grain_sqla": "years",
            "granularity": "90 seconds",
            "druid_time_origin": "now",
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_merge_extra_filters_ignores_empty_filters(self):
        form_data = {
            "extra_filters": [
                {"col": "a", "op": "in", "val": ""},
                {"col": "B", "op": "==", "val": []},
            ]
        }
        expected = {"adhoc_filters": []}
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
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
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
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
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
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
                    "operator": "in",
                    "subject": "a",
                },
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)
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
                    "operator": "in",
                    "subject": "a",
                },
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
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
                    "operator": "in",
                    "subject": "a",
                },
                {
                    "clause": "WHERE",
                    "comparator": ["c1", "c2", "c3"],
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "B",
                },
            ]
        }
        merge_extra_filters(form_data)
        self.assertEqual(form_data, expected)

    def test_merge_request_params_when_url_params_undefined(self):
        form_data = {"since": "2000", "until": "now"}
        url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
        merge_request_params(form_data, url_params)
        self.assertIn("url_params", form_data.keys())
        self.assertIn("dashboard_ids", form_data["url_params"])
        self.assertNotIn("form_data", form_data.keys())

    def test_merge_request_params_when_url_params_predefined(self):
        form_data = {
            "since": "2000",
            "until": "now",
            "url_params": {"abc": "123", "dashboard_ids": "(1,2,3)"},
        }
        url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
        merge_request_params(form_data, url_params)
        self.assertIn("url_params", form_data.keys())
        self.assertIn("abc", form_data["url_params"])
        self.assertEqual(
            url_params["dashboard_ids"], form_data["url_params"]["dashboard_ids"]
        )

    def test_format_timedelta(self):
        self.assertEqual(format_timedelta(timedelta(0)), "0:00:00")
        self.assertEqual(format_timedelta(timedelta(days=1)), "1 day, 0:00:00")
        self.assertEqual(format_timedelta(timedelta(minutes=-6)), "-0:06:00")
        self.assertEqual(
            format_timedelta(timedelta(0) - timedelta(days=1, hours=5, minutes=6)),
            "-1 day, 5:06:00",
        )
        self.assertEqual(
            format_timedelta(timedelta(0) - timedelta(days=16, hours=4, minutes=3)),
            "-16 days, 4:03:00",
        )

    def test_json_encoded_obj(self):
        obj = {"a": 5, "b": ["a", "g", 5]}
        val = '{"a": 5, "b": ["a", "g", 5]}'
        jsonObj = JSONEncodedDict()
        resp = jsonObj.process_bind_param(obj, "dialect")
        self.assertIn('"a": 5', resp)
        self.assertIn('"b": ["a", "g", 5]', resp)
        self.assertEqual(jsonObj.process_result_value(val, "dialect"), obj)

    def test_validate_json(self):
        valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
        self.assertIsNone(validate_json(valid))
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        with self.assertRaises(SupersetException):
            validate_json(invalid)

    def test_memoized_on_functions(self):
        watcher = {"val": 0}

        @memoized
        def test_function(a, b, c):
            watcher["val"] += 1
            return a * b * c

        result1 = test_function(1, 2, 3)
        result2 = test_function(1, 2, 3)
        self.assertEqual(result1, result2)
        self.assertEqual(watcher["val"], 1)

    def test_memoized_on_methods(self):
        class test_class:
            def __init__(self, num):
                self.num = num
                self.watcher = 0

            @memoized
            def test_method(self, a, b, c):
                self.watcher += 1
                return a * b * c * self.num

        instance = test_class(5)
        result1 = instance.test_method(1, 2, 3)
        result2 = instance.test_method(1, 2, 3)
        self.assertEqual(result1, result2)
        self.assertEqual(instance.watcher, 1)
        instance.num = 10
        self.assertEqual(result2, instance.test_method(1, 2, 3))

    def test_memoized_on_methods_with_watches(self):
        class test_class:
            def __init__(self, x, y):
                self.x = x
                self.y = y
                self.watcher = 0

            @memoized(watch=("x", "y"))
            def test_method(self, a, b, c):
                self.watcher += 1
                return a * b * c * self.x * self.y

        instance = test_class(3, 12)
        result1 = instance.test_method(1, 2, 3)
        result2 = instance.test_method(1, 2, 3)
        self.assertEqual(result1, result2)
        self.assertEqual(instance.watcher, 1)
        result3 = instance.test_method(2, 3, 4)
        self.assertEqual(instance.watcher, 2)
        result4 = instance.test_method(2, 3, 4)
        self.assertEqual(instance.watcher, 2)
        self.assertEqual(result3, result4)
        self.assertNotEqual(result3, result1)
        instance.x = 1
        result5 = instance.test_method(2, 3, 4)
        self.assertEqual(instance.watcher, 3)
        self.assertNotEqual(result5, result4)
        result6 = instance.test_method(2, 3, 4)
        self.assertEqual(instance.watcher, 3)
        self.assertEqual(result6, result5)
        instance.x = 10
        instance.y = 10
        result7 = instance.test_method(2, 3, 4)
        self.assertEqual(instance.watcher, 4)
        self.assertNotEqual(result7, result6)
        instance.x = 3
        instance.y = 12
        result8 = instance.test_method(1, 2, 3)
        self.assertEqual(instance.watcher, 4)
        self.assertEqual(result1, result8)

    @patch("superset.utils.core.parse_human_datetime", mock_parse_human_datetime)
    def test_get_since_until(self):
        result = get_since_until()
        expected = None, datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(" : now")
        expected = None, datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("yesterday : tomorrow")
        expected = datetime(2016, 11, 6), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until("2018-01-01T00:00:00 : 2018-12-31T23:59:59")
        expected = datetime(2018, 1, 1), datetime(2018, 12, 31, 23, 59, 59)
        self.assertEqual(result, expected)

        result = get_since_until("Last year")
        expected = datetime(2015, 11, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last 5 months")
        expected = datetime(2016, 6, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Next 5 months")
        expected = datetime(2016, 11, 7), datetime(2017, 4, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since="5 days")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since="5 days ago", until="tomorrow")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until(time_range="yesterday : tomorrow", time_shift="1 day")
        expected = datetime(2016, 11, 5), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(time_range="5 days : now")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_end="now")
        expected = datetime(2016, 10, 31), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_start="now")
        expected = datetime(2016, 10, 31, 9, 30, 10), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_start="now", relative_end="now")
        expected = datetime(2016, 10, 31, 9, 30, 10), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        with self.assertRaises(ValueError):
            get_since_until(time_range="tomorrow : yesterday")

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_where(self):
        form_data = {"where": "a = 1"}
        expected = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_filters(self):
        form_data = {"filters": [{"col": "a", "op": "in", "val": "someval"}]}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "someval",
                    "expressionType": "SIMPLE",
                    "operator": "in",
                    "subject": "a",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_having(self):
        form_data = {"having": "COUNT(1) = 1"}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "HAVING",
                    "expressionType": "SQL",
                    "sqlExpression": "COUNT(1) = 1",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_having_filters(self):
        form_data = {"having_filters": [{"col": "COUNT(1)", "op": "==", "val": 1}]}
        expected = {
            "adhoc_filters": [
                {
                    "clause": "HAVING",
                    "comparator": 1,
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "COUNT(1)",
                }
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_present_and_empty(self):
        form_data = {"adhoc_filters": [], "where": "a = 1"}
        expected = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    @patch("superset.utils.core.to_adhoc", mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_present_and_nonempty(self):
        form_data = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ],
            "filters": [{"col": "a", "op": "in", "val": "someval"}],
            "having": "COUNT(1) = 1",
            "having_filters": [{"col": "COUNT(1)", "op": "==", "val": 1}],
        }
        expected = {
            "adhoc_filters": [
                {"clause": "WHERE", "expressionType": "SQL", "sqlExpression": "a = 1"}
            ]
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEqual(form_data, expected)

    def test_parse_js_uri_path_items_eval_undefined(self):
        self.assertIsNone(parse_js_uri_path_item("undefined", eval_undefined=True))
        self.assertIsNone(parse_js_uri_path_item("null", eval_undefined=True))
        self.assertEqual("undefined", parse_js_uri_path_item("undefined"))
        self.assertEqual("null", parse_js_uri_path_item("null"))

    def test_parse_js_uri_path_items_unquote(self):
        self.assertEqual("slashed/name", parse_js_uri_path_item("slashed%2fname"))
        self.assertEqual(
            "slashed%2fname", parse_js_uri_path_item("slashed%2fname", unquote=False)
        )

    def test_parse_js_uri_path_items_item_optional(self):
        self.assertIsNone(parse_js_uri_path_item(None))
        self.assertIsNotNone(parse_js_uri_path_item("item"))

    def test_setup_cache_null_config(self):
        app = Flask(__name__)
        cache_config = {"CACHE_TYPE": "null"}
        assert isinstance(CacheManager._setup_cache(app, cache_config), Cache)

    def test_setup_cache_standard_config(self):
        app = Flask(__name__)
        cache_config = {
            "CACHE_TYPE": "redis",
            "CACHE_DEFAULT_TIMEOUT": 60,
            "CACHE_KEY_PREFIX": "superset_results",
            "CACHE_REDIS_URL": "redis://localhost:6379/0",
        }
        assert isinstance(CacheManager._setup_cache(app, cache_config), Cache) is True

    def test_setup_cache_custom_function(self):
        app = Flask(__name__)
        CustomCache = type("CustomCache", (object,), {"__init__": lambda *args: None})

        def init_cache(app):
            return CustomCache(app, {})

        assert (
            isinstance(CacheManager._setup_cache(app, init_cache), CustomCache) is True
        )

    def test_get_stacktrace(self):
        with app.app_context():
            app.config["SHOW_STACKTRACE"] = True
            try:
                raise Exception("NONONO!")
            except Exception:
                stacktrace = get_stacktrace()
                self.assertIn("NONONO", stacktrace)

            app.config["SHOW_STACKTRACE"] = False
            try:
                raise Exception("NONONO!")
            except Exception:
                stacktrace = get_stacktrace()
                assert stacktrace is None

    def test_split(self):
        self.assertEqual(list(split("a b")), ["a", "b"])
        self.assertEqual(list(split("a,b", delimiter=",")), ["a", "b"])
        self.assertEqual(list(split("a,(b,a)", delimiter=",")), ["a", "(b,a)"])
        self.assertEqual(
            list(split('a,(b,a),"foo , bar"', delimiter=",")),
            ["a", "(b,a)", '"foo , bar"'],
        )
        self.assertEqual(
            list(split("a,'b,c'", delimiter=",", quote="'")), ["a", "'b,c'"]
        )
        self.assertEqual(list(split('a "b c"')), ["a", '"b c"'])
        self.assertEqual(list(split(r'a "b \" c"')), ["a", r'"b \" c"'])

    def test_get_or_create_db(self):
        get_or_create_db("test_db", "sqlite:///superset.db")
        database = db.session.query(Database).filter_by(database_name="test_db").one()
        self.assertIsNotNone(database)
        self.assertEqual(database.sqlalchemy_uri, "sqlite:///superset.db")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu("database_access", database.perm)
        )
        # Test change URI
        get_or_create_db("test_db", "sqlite:///changed.db")
        database = db.session.query(Database).filter_by(database_name="test_db").one()
        self.assertEqual(database.sqlalchemy_uri, "sqlite:///changed.db")
        db.session.delete(database)
        db.session.commit()

    def test_get_or_create_db_invalid_uri(self):
        with self.assertRaises(ArgumentError):
            get_or_create_db("test_db", "yoursql:superset.db/()")

    def test_get_time_range_endpoints(self):
        self.assertEqual(
            get_time_range_endpoints(form_data={}),
            (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE),
        )

        self.assertEqual(
            get_time_range_endpoints(
                form_data={"time_range_endpoints": ["inclusive", "inclusive"]}
            ),
            (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.INCLUSIVE),
        )

        self.assertEqual(
            get_time_range_endpoints(form_data={"datasource": "1_druid"}),
            (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE),
        )

        slc = Mock()
        slc.datasource.database.get_extra.return_value = {}

        self.assertEqual(
            get_time_range_endpoints(form_data={"datasource": "1__table"}, slc=slc),
            (TimeRangeEndpoint.UNKNOWN, TimeRangeEndpoint.INCLUSIVE),
        )

        slc.datasource.database.get_extra.return_value = {
            "time_range_endpoints": ["inclusive", "inclusive"]
        }

        self.assertEqual(
            get_time_range_endpoints(form_data={"datasource": "1__table"}, slc=slc),
            (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.INCLUSIVE),
        )

        self.assertIsNone(get_time_range_endpoints(form_data={}, slc=slc))

        with app.app_context():
            app.config["SIP_15_GRACE_PERIOD_END"] = date.today() + timedelta(days=1)

            self.assertEqual(
                get_time_range_endpoints(form_data={"datasource": "1__table"}, slc=slc),
                (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.INCLUSIVE),
            )

            app.config["SIP_15_GRACE_PERIOD_END"] = date.today()

            self.assertEqual(
                get_time_range_endpoints(form_data={"datasource": "1__table"}, slc=slc),
                (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE),
            )

    def test_get_iterable(self):
        self.assertListEqual(get_iterable(123), [123])
        self.assertListEqual(get_iterable([123]), [123])
        self.assertListEqual(get_iterable("foo"), ["foo"])

    def test_build_extra_filters(self):
        world_health = db.session.query(Dashboard).filter_by(slug="world_health").one()
        layout = json.loads(world_health.position_json)
        filter_ = db.session.query(Slice).filter_by(slice_name="Region Filter").one()
        world = db.session.query(Slice).filter_by(slice_name="World's Population").one()
        box_plot = db.session.query(Slice).filter_by(slice_name="Box plot").one()
        treemap = db.session.query(Slice).filter_by(slice_name="Treemap").one()

        filter_scopes = {
            str(filter_.id): {
                "region": {"scope": ["ROOT_ID"], "immune": [treemap.id]},
                "country_name": {
                    "scope": ["ROOT_ID"],
                    "immune": [treemap.id, box_plot.id],
                },
            }
        }

        default_filters = {
            str(filter_.id): {
                "region": ["North America"],
                "country_name": ["United States"],
            }
        }

        # immune to all filters
        assert (
            build_extra_filters(layout, filter_scopes, default_filters, treemap.id)
            == []
        )

        # in scope
        assert build_extra_filters(
            layout, filter_scopes, default_filters, world.id
        ) == [
            {"col": "region", "op": "==", "val": "North America"},
            {"col": "country_name", "op": "in", "val": ["United States"]},
        ]

        assert build_extra_filters(
            layout, filter_scopes, default_filters, box_plot.id
        ) == [{"col": "region", "op": "==", "val": "North America"}]

    def test_ssl_certificate_parse(self):
        parsed_certificate = parse_ssl_cert(ssl_certificate)
        self.assertEqual(parsed_certificate.serial_number, 12355228710836649848)
        self.assertRaises(CertificateException, parse_ssl_cert, "abc" + ssl_certificate)

    def test_ssl_certificate_file_creation(self):
        path = create_ssl_cert_file(ssl_certificate)
        expected_filename = hashlib.md5(ssl_certificate.encode("utf-8")).hexdigest()
        self.assertIn(expected_filename, path)
        self.assertTrue(os.path.exists(path))

    def test_get_email_address_list(self):
        self.assertEqual(get_email_address_list("a@a"), ["a@a"])
        self.assertEqual(get_email_address_list(" a@a "), ["a@a"])
        self.assertEqual(get_email_address_list("a@a\n"), ["a@a"])
        self.assertEqual(get_email_address_list(",a@a;"), ["a@a"])
        self.assertEqual(
            get_email_address_list(",a@a; b@b c@c a-c@c; d@d, f@f"),
            ["a@a", "b@b", "c@c", "a-c@c", "d@d", "f@f"],
        )

    def test_get_form_data_default(self) -> None:
        with app.test_request_context():
            form_data, slc = get_form_data()

            self.assertEqual(
                form_data,
                {"time_range_endpoints": get_time_range_endpoints(form_data={}),},
            )

            self.assertEqual(slc, None)

    def test_get_form_data_request_args(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"foo": "bar"})}
        ):
            form_data, slc = get_form_data()

            self.assertEqual(
                form_data,
                {
                    "foo": "bar",
                    "time_range_endpoints": get_time_range_endpoints(form_data={}),
                },
            )

            self.assertEqual(slc, None)

    def test_get_form_data_request_form(self) -> None:
        with app.test_request_context(data={"form_data": json.dumps({"foo": "bar"})}):
            form_data, slc = get_form_data()

            self.assertEqual(
                form_data,
                {
                    "foo": "bar",
                    "time_range_endpoints": get_time_range_endpoints(form_data={}),
                },
            )

            self.assertEqual(slc, None)

    def test_get_form_data_request_args_and_form(self) -> None:
        with app.test_request_context(
            data={"form_data": json.dumps({"foo": "bar"})},
            query_string={"form_data": json.dumps({"baz": "bar"})},
        ):
            form_data, slc = get_form_data()

            self.assertEqual(
                form_data,
                {
                    "baz": "bar",
                    "foo": "bar",
                    "time_range_endpoints": get_time_range_endpoints(form_data={}),
                },
            )

            self.assertEqual(slc, None)

    def test_get_form_data_globals(self) -> None:
        with app.test_request_context():
            g.form_data = {"foo": "bar"}
            form_data, slc = get_form_data()
            delattr(g, "form_data")

            self.assertEqual(
                form_data,
                {
                    "foo": "bar",
                    "time_range_endpoints": get_time_range_endpoints(form_data={}),
                },
            )

            self.assertEqual(slc, None)

    def test_log_this(self) -> None:
        # TODO: Add additional scenarios.
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        dashboard_id = 1

        resp = self.get_json_resp(
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

        self.assertEqual(record.dashboard_id, dashboard_id)
        self.assertEqual(json.loads(record.json)["dashboard_id"], str(dashboard_id))
        self.assertEqual(json.loads(record.json)["form_data"]["slice_id"], slc.id)

        self.assertEqual(
            json.loads(record.json)["form_data"]["viz_type"],
            slc.viz.form_data["viz_type"],
        )

    def test_schema_validate_json(self):
        valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
        self.assertIsNone(schema.validate_json(valid))
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        self.assertRaises(marshmallow.ValidationError, schema.validate_json, invalid)

    def test_schema_one_of_case_insensitive(self):
        validator = schema.OneOfCaseInsensitive(choices=[1, 2, 3, "FoO", "BAR", "baz"])
        self.assertEqual(1, validator(1))
        self.assertEqual(2, validator(2))
        self.assertEqual("FoO", validator("FoO"))
        self.assertEqual("FOO", validator("FOO"))
        self.assertEqual("bar", validator("bar"))
        self.assertEqual("BaZ", validator("BaZ"))
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
