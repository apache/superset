# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from superset.dataframe import dedup, SupersetDataFrame
from superset.db_engine_specs import BaseEngineSpec
from .base_tests import SupersetTestCase


class SupersetDataFrameTestCase(SupersetTestCase):
    def test_dedup(self):
        self.assertEquals(
            dedup(['foo', 'bar']),
            ['foo', 'bar'],
        )
        self.assertEquals(
            dedup(['foo', 'bar', 'foo', 'bar']),
            ['foo', 'bar', 'foo__1', 'bar__1'],
        )
        self.assertEquals(
            dedup(['foo', 'bar', 'bar', 'bar']),
            ['foo', 'bar', 'bar__1', 'bar__2'],
        )

    def test_get_columns_basic(self):
        data = [
            ('a1', 'b1', 'c1'),
            ('a2', 'b2', 'c2'),
        ]
        cursor_descr = (
            ('a', 'string'),
            ('b', 'string'),
            ('c', 'string'),
        )
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
        self.assertEqual(
            cdf.columns,
            [
                {
                    'is_date': False,
                    'type': 'STRING',
                    'name': 'a',
                    'is_dim': True,
                }, {
                    'is_date': False,
                    'type': 'STRING',
                    'name': 'b',
                    'is_dim': True,
                }, {
                    'is_date': False,
                    'type': 'STRING',
                    'name': 'c',
                    'is_dim': True,
                },
            ],
        )

    def test_get_columns_with_int(self):
        data = [
            ('a1', 1),
            ('a2', 2),
        ]
        cursor_descr = (
            ('a', 'string'),
            ('b', 'int'),
        )
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
        self.assertEqual(
            cdf.columns,
            [
                {
                    'is_date': False,
                    'type': 'STRING',
                    'name': 'a',
                    'is_dim': True,
                }, {
                    'is_date': False,
                    'type': 'INT',
                    'name': 'b',
                    'is_dim': False,
                    'agg': 'sum',
                },
            ],
        )

    def test_get_columns_type_inference(self):
        data = [
            (1.2, 1),
            (3.14, 2),
        ]
        cursor_descr = (
            ('a', None),
            ('b', None),
        )
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
        self.assertEqual(
            cdf.columns,
            [
                {
                    'is_date': False,
                    'type': 'FLOAT',
                    'name': 'a',
                    'is_dim': False,
                    'agg': 'sum',
                }, {
                    'is_date': False,
                    'type': 'INT',
                    'name': 'b',
                    'is_dim': False,
                    'agg': 'sum',
                },
            ],
        )

    def test_dedup_with_data(self):
        data = [
            ('a', 1),
            ('a', 2),
        ]
        cursor_descr = (
            ('a', 'string'),
            ('a', 'string'),
        )
        cdf = SupersetDataFrame(data, cursor_descr, BaseEngineSpec)
        self.assertListEqual(cdf.column_names, ['a', 'a__1'])
