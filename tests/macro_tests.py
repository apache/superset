# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask import json

from superset import app
from superset import jinja_context
from tests.base_tests import SupersetTestCase


class MacroTestCase(SupersetTestCase):

    def test_filter_values_macro(self):
        form_data1 = {
            'extra_filters': [
                {'col': 'my_special_filter', 'op': 'in', 'val': ['foo']},
            ],
            'filters': [
                {'col': 'my_special_filter2', 'op': 'in', 'val': ['bar']},
            ],
        }

        form_data2 = {
            'extra_filters': [
                {'col': 'my_special_filter', 'op': 'in', 'val': ['foo', 'bar']},
            ],
        }

        form_data3 = {
            'extra_filters': [
                {'col': 'my_special_filter', 'op': 'in', 'val': ['foo', 'bar']},
            ],
            'filters': [
                {'col': 'my_special_filter', 'op': 'in', 'val': ['savage']},
            ],
        }

        data1 = {'form_data': json.dumps(form_data1)}
        data2 = {'form_data': json.dumps(form_data2)}
        data3 = {'form_data': json.dumps(form_data3)}

        with app.test_request_context(data=data1):
            filter_values = jinja_context.filter_values('my_special_filter')
            self.assertEqual(filter_values, ['foo'])

            filter_values = jinja_context.filter_values('my_special_filter2')
            self.assertEqual(filter_values, ['bar'])

            filter_values = jinja_context.filter_values('')
            self.assertEqual(filter_values, [])

        with app.test_request_context(data=data2):
            filter_values = jinja_context.filter_values('my_special_filter')
            self.assertEqual(filter_values, ['foo', 'bar'])

        with app.test_request_context(data=data3):
            filter_values = jinja_context.filter_values('my_special_filter')
            self.assertEqual(filter_values, ['savage', 'foo', 'bar'])

        with app.test_request_context():
            filter_values = jinja_context.filter_values('nonexistent_filter', 'foo')
            self.assertEqual(filter_values, ['foo'])
