# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import date, datetime, time, timedelta
from decimal import Decimal
import unittest
import uuid

from mock import patch
import numpy

from superset.exceptions import SupersetException
from superset.utils import (
    base_json_conv, datetime_f, json_int_dttm_ser, json_iso_dttm_ser,
    JSONEncodedDict, memoized, merge_extra_filters, merge_request_params,
    parse_human_timedelta, validate_json, zlib_compress, zlib_decompress_to_string,
)


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

    @patch('superset.utils.datetime')
    def test_parse_human_timedelta(self, mock_now):
        mock_now.return_value = datetime(2016, 12, 1)
        self.assertEquals(parse_human_timedelta('now'), timedelta(0))

    def test_zlib_compression(self):
        json_str = '{"test": 1}'
        blob = zlib_compress(json_str)
        got_str = zlib_decompress_to_string(blob)
        self.assertEquals(json_str, got_str)

    def test_merge_extra_filters(self):
        # does nothing if no extra filters
        form_data = {'A': 1, 'B': 2, 'c': 'test'}
        expected = {'A': 1, 'B': 2, 'c': 'test'}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # empty extra_filters
        form_data = {'A': 1, 'B': 2, 'c': 'test', 'extra_filters': []}
        expected = {'A': 1, 'B': 2, 'c': 'test', 'filters': []}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # copy over extra filters into empty filters
        form_data = {'extra_filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ]}
        expected = {'filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ]}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # adds extra filters to existing filters
        form_data = {'extra_filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ], 'filters': [{'col': 'D', 'op': '!=', 'val': ['G1', 'g2']}]}
        expected = {'filters': [
            {'col': 'D', 'op': '!=', 'val': ['G1', 'g2']},
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ]}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        # adds extra filters to existing filters and sets time options
        form_data = {'extra_filters': [
            {'col': '__from', 'op': 'in', 'val': '1 year ago'},
            {'col': '__to', 'op': 'in', 'val': None},
            {'col': '__time_col', 'op': 'in', 'val': 'birth_year'},
            {'col': '__time_grain', 'op': 'in', 'val': 'years'},
            {'col': 'A', 'op': 'like', 'val': 'hello'},
            {'col': '__time_origin', 'op': 'in', 'val': 'now'},
            {'col': '__granularity', 'op': 'in', 'val': '90 seconds'},
        ]}
        expected = {
            'filters': [{'col': 'A', 'op': 'like', 'val': 'hello'}],
            'since': '1 year ago',
            'granularity_sqla': 'birth_year',
            'time_grain_sqla': 'years',
            'granularity': '90 seconds',
            'druid_time_origin': 'now',
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_extra_filters_ignores_empty_filters(self):
        form_data = {'extra_filters': [
            {'col': 'a', 'op': 'in', 'val': ''},
            {'col': 'B', 'op': '==', 'val': []},
        ]}
        expected = {'filters': []}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_extra_filters_ignores_nones(self):
        form_data = {
            'filters': [
                {'col': None, 'op': 'in', 'val': ''},
            ],
            'extra_filters': [
                {'col': 'B', 'op': '==', 'val': []},
            ],
        }
        expected = {
            'filters': [
                {'col': None, 'op': 'in', 'val': ''},
            ],
        }
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_extra_filters_ignores_equal_filters(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
        }
        expected = {'filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
        ]}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_extra_filters_merges_different_val_types(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
        }
        expected = {'filters': [
            {'col': 'a', 'op': 'in', 'val': 'someval'},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
        ]}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': 'someval'},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
            'filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
        }
        expected = {'filters': [
            {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            {'col': 'a', 'op': 'in', 'val': 'someval'},
        ]}
        merge_extra_filters(form_data)
        self.assertEquals(form_data, expected)

    def test_merge_extra_filters_adds_unequal_lists(self):
        form_data = {
            'extra_filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2', 'g3']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2', 'c3']},
            ],
            'filters': [
                {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
                {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            ],
        }
        expected = {'filters': [
            {'col': 'a', 'op': 'in', 'val': ['g1', 'g2']},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2']},
            {'col': 'a', 'op': 'in', 'val': ['g1', 'g2', 'g3']},
            {'col': 'B', 'op': '==', 'val': ['c1', 'c2', 'c3']},
        ]}
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
