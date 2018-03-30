# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from superset.dataframe import dedup
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
