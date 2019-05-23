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
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import unittest
from unittest.mock import patch
import uuid

import numpy

from superset.exceptions import SupersetException
from superset.utils.core import (
    base_json_conv,
    convert_legacy_filters_into_adhoc,
    datetime_f,
    get_since_until,
    json_int_dttm_ser,
    json_iso_dttm_ser,
    JSONEncodedDict,
    memoized,
    merge_extra_filters,
    merge_request_params,
    parse_human_timedelta,
    parse_js_uri_path_item,
    validate_json,
    zlib_compress,
    zlib_decompress_to_string,
)


def mock_parse_human_datetime(s):
    if s in ['now', 'today']:
        return datetime(2016, 11, 7)
    elif s == 'yesterday':
        return datetime(2016, 11, 6)
    elif s == 'tomorrow':
        return datetime(2016, 11, 8)
    elif s == 'Last year':
        return datetime(2015, 11, 7)
    elif s == 'Last 5 months':
        return datetime(2016, 6, 7)
    elif s == 'Next 5 months':
        return datetime(2017, 4, 7)
    elif s in ['5 days', '5 days ago']:
        return datetime(2016, 11, 2)
    elif s == '2018-01-01T00:00:00':
        return datetime(2018, 1, 1)
    elif s == '2018-12-31T23:59:59':
        return datetime(2018, 12, 31, 23, 59, 59)


def mock_to_adhoc(filt, expressionType='SIMPLE', clause='where'):
    result = {
        'clause': clause.upper(),
        'expressionType': expressionType,
    }

    if expressionType == 'SIMPLE':
        result.update({
            'comparator': filt['val'],
            'operator': filt['op'],
            'subject': filt['col'],
        })
    elif expressionType == 'SQL':
        result.update({
            'sqlExpression': filt[clause],
        })

    return result


class UtilsTestCase(unittest.TestCase):
    def test_json_int_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        ts = 1577836800000.0
        assert json_int_dttm_ser(dttm) == ts
        assert json_int_dttm_ser(date(2020, 1, 1)) == ts
        assert json_int_dttm_ser(datetime(1970, 1, 1)) == 0
        assert json_int_dttm_ser(date(1970, 1, 1)) == 0
        assert json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)

        with self.assertRaises(TypeError):
            json_int_dttm_ser('this is not a date')

    def test_json_iso_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        dt = date(2020, 1, 1)
        t = time()
        assert json_iso_dttm_ser(dttm) == dttm.isoformat()
        assert json_iso_dttm_ser(dt) == dt.isoformat()
        assert json_iso_dttm_ser(t) == t.isoformat()

        with self.assertRaises(TypeError):
            json_iso_dttm_ser('this is not a date')

    def test_base_json_conv(self):
        assert isinstance(base_json_conv(numpy.bool_(1)), bool) is True
        assert isinstance(base_json_conv(numpy.int64(1)), int) is True
        assert isinstance(base_json_conv(set([1])), list) is True
        assert isinstance(base_json_conv(Decimal('1.0')), float) is True
        assert isinstance(base_json_conv(uuid.uuid4()), str) is True

    @patch('superset.utils.core.datetime')
    def test_parse_human_timedelta(self, mock_now):
        mock_now.return_value = datetime(2016, 12, 1)
        self.assertEquals(parse_human_timedelta('now'), timedelta(0))

    def test_zlib_compression(self):
        json_str = '{"test": 1}'
        blob = zlib_compress(json_str)
        got_str = zlib_decompress_to_string(blob)
        self.assertEquals(json_str, got_str)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters(self):
        # does nothing if no extra filters
        form_data = {'A': 1, 'B': 2, 'c': 'test'}
        expected = {'A': 1, 'B': 2, 'c': 'test'}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # empty extra_filters
        form_data = {'A': 1, 'B': 2, 'c': 'test', 'extra_filters': []}
        expected = {'A': 1, 'B': 2, 'c': 'test', 'adhoc_filters': []}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # copy over extra filters into empty filters
        form_data = {'extra_filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ]}
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # adds extra filters to existing filters
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['G1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': '!=',
                    'subject': 'D',
                },
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['G1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': '!=',
                    'subject': 'D',
                },
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # adds extra filters to existing filters and sets time options
        form_data = {'extra_filters': [
            {'col': '__time_range', 'op': 'in', 'val': '1 year ago :'},
            {'col': '__time_col', 'op': 'in', 'val': 'birth_year'},
            {'col': '__time_grain', 'op': 'in', 'val': 'years'},
            {'col': 'A', 'op': 'like', 'val': 'hello'},
            {'col': '__time_origin', 'op': 'in', 'val': 'now'},
            {'col': '__granularity', 'op': 'in', 'val': '90 seconds'},
        ]}
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'hello',
                    'expressionType': 'SIMPLE',
                    'operator': 'like',
                    'subject': 'A',
                },
            ],
            'time_range': '1 year ago :',
            'granularity_sqla': 'birth_year',
            'time_grain_sqla': 'years',
            'granularity': '90 seconds',
            'druid_time_origin': 'now',
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters_ignores_empty_filters(self):
        form_data = {'extra_filters': [
            {'col': 'a', 'op': 'in', 'val': ''},
            {'col': 'B', 'op': '==', 'val': []},
        ]}
        expected = {'adhoc_filters': []}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters_ignores_nones(self):
        form_data = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': '',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': None,
                },
            ],
            'extra_filters': [
                {'col': 'B', 'op': '==', 'val': []},
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': '',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': None,
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters_ignores_equal_filters(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters_merges_different_val_types(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_merge_extra_filters_adds_unequal_lists(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2', 'g3']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2', 'c3']},
            ],
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['g1', 'g2', 'g3'],
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
                {
                    'clause': 'WHERE',
                    'comparator': ['c1', 'c2', 'c3'],
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'B',
                },
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_request_params(self):
        form_data = {
            'since': '2000',
            'until': 'now',
        }
        url_params = {
            'form_data': form_data,
            'dashboard_ids': '(1,2,3,4,5)',
        }
        merge_request_params(form_data, url_params)
        self.assertIn('url_params', form_data.keys())
        self.assertIn('dashboard_ids', form_data['url_params'])
        self.assertNotIn('form_data', form_data.keys())

    def test_datetime_f(self):
        self.assertEquals(
            datetime_f(datetime(1990, 9, 21, 19, 11, 19, 626096)),
            '<nobr>1990-09-21T19:11:19.626096</nobr>',
        )
        self.assertEquals(len(datetime_f(datetime.now())), 28)
        self.assertEquals(datetime_f(None), '<nobr>None</nobr>')
        iso = datetime.now().isoformat()[:10].split('-')
        [a, b, c] = [int(v) for v in iso]
        self.assertEquals(
            datetime_f(datetime(a, b, c)), '<nobr>00:00:00</nobr>',
        )

    def test_json_encoded_obj(self):
        obj = {'a': 5, 'b': ['a', 'g', 5]}
        val = '{"a": 5, "b": ["a", "g", 5]}'
        jsonObj = JSONEncodedDict()
        resp = jsonObj.process_bind_param(obj, 'dialect')
        self.assertIn('"a": 5', resp)
        self.assertIn('"b": ["a", "g", 5]', resp)
        self.assertEquals(jsonObj.process_result_value(val, 'dialect'), obj)

    def test_validate_json(self):
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        with self.assertRaises(SupersetException):
            validate_json(invalid)

    def test_memoized_on_functions(self):
        watcher = {'val': 0}

        @memoized
        def test_function(a, b, c):
            watcher['val'] += 1
            return a * b * c
        result1 = test_function(1, 2, 3)
        result2 = test_function(1, 2, 3)
        self.assertEquals(result1, result2)
        self.assertEquals(watcher['val'], 1)

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
        self.assertEquals(result1, result2)
        self.assertEquals(instance.watcher, 1)
        instance.num = 10
        self.assertEquals(result2, instance.test_method(1, 2, 3))

    def test_memoized_on_methods_with_watches(self):

        class test_class:
            def __init__(self, x, y):
                self.x = x
                self.y = y
                self.watcher = 0

            @memoized(watch=('x', 'y'))
            def test_method(self, a, b, c):
                self.watcher += 1
                return a * b * c * self.x * self.y

        instance = test_class(3, 12)
        result1 = instance.test_method(1, 2, 3)
        result2 = instance.test_method(1, 2, 3)
        self.assertEquals(result1, result2)
        self.assertEquals(instance.watcher, 1)
        result3 = instance.test_method(2, 3, 4)
        self.assertEquals(instance.watcher, 2)
        result4 = instance.test_method(2, 3, 4)
        self.assertEquals(instance.watcher, 2)
        self.assertEquals(result3, result4)
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

    @patch('superset.utils.core.parse_human_datetime', mock_parse_human_datetime)
    def test_get_since_until(self):
        result = get_since_until()
        expected = None, datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(' : now')
        expected = None, datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until('yesterday : tomorrow')
        expected = datetime(2016, 11, 6), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until('2018-01-01T00:00:00 : 2018-12-31T23:59:59')
        expected = datetime(2018, 1, 1), datetime(2018, 12, 31, 23, 59, 59)
        self.assertEqual(result, expected)

        result = get_since_until('Last year')
        expected = datetime(2015, 11, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until('Last 5 months')
        expected = datetime(2016, 6, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until('Next 5 months')
        expected = datetime(2016, 11, 7), datetime(2017, 4, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since='5 days')
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since='5 days ago', until='tomorrow')
        expected = datetime(2016, 11, 2), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until(time_range='yesterday : tomorrow', time_shift='1 day')
        expected = datetime(2016, 11, 5), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(time_range='5 days : now')
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        with self.assertRaises(ValueError):
            get_since_until(time_range='tomorrow : yesterday')

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_where(self):
        form_data = {
            'where': 'a = 1',
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'expressionType': 'SQL',
                    'sqlExpression': 'a = 1',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_filters(self):
        form_data = {
            'filters': [{'col': 'a', 'op': 'in', 'val': 'someval'}],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'comparator': 'someval',
                    'expressionType': 'SIMPLE',
                    'operator': 'in',
                    'subject': 'a',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_having(self):
        form_data = {
            'having': 'COUNT(1) = 1',
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'HAVING',
                    'expressionType': 'SQL',
                    'sqlExpression': 'COUNT(1) = 1',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_having_filters(self):
        form_data = {
            'having_filters': [{'col': 'COUNT(1)', 'op': '==', 'val': 1}],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'HAVING',
                    'comparator': 1,
                    'expressionType': 'SIMPLE',
                    'operator': '==',
                    'subject': 'COUNT(1)',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_present_and_empty(self):
        form_data = {
            'adhoc_filters': [],
            'where': 'a = 1',
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'expressionType': 'SQL',
                    'sqlExpression': 'a = 1',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    @patch('superset.utils.core.to_adhoc', mock_to_adhoc)
    def test_convert_legacy_filters_into_adhoc_present_and_nonempty(self):
        form_data = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'expressionType': 'SQL',
                    'sqlExpression': 'a = 1',
                },
            ],
            'filters': [{'col': 'a', 'op': 'in', 'val': 'someval'}],
            'having': 'COUNT(1) = 1',
            'having_filters': [{'col': 'COUNT(1)', 'op': '==', 'val': 1}],
        }
        expected = {
            'adhoc_filters': [
                {
                    'clause': 'WHERE',
                    'expressionType': 'SQL',
                    'sqlExpression': 'a = 1',
                },
            ],
        }
        convert_legacy_filters_into_adhoc(form_data)
        self.assertEquals(form_data, expected)

    def test_parse_js_uri_path_items_eval_undefined(self):
        self.assertIsNone(parse_js_uri_path_item('undefined', eval_undefined=True))
        self.assertIsNone(parse_js_uri_path_item('null', eval_undefined=True))
        self.assertEqual('undefined', parse_js_uri_path_item('undefined'))
        self.assertEqual('null', parse_js_uri_path_item('null'))

    def test_parse_js_uri_path_items_unquote(self):
        self.assertEqual('slashed/name', parse_js_uri_path_item('slashed%2fname'))
        self.assertEqual('slashed%2fname', parse_js_uri_path_item('slashed%2fname',
                                                                  unquote=False))

    def test_parse_js_uri_path_items_item_optional(self):
        self.assertIsNone(parse_js_uri_path_item(None))
        self.assertIsNotNone(parse_js_uri_path_item('item'))
