# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from tests.base_tests import SupersetTestCase
from wtforms.form import Form

from superset.forms import (
    CommaSeparatedListField, filter_not_empty_values)


class FormTestCase(SupersetTestCase):

    def test_comma_separated_list_field(self):
        field = CommaSeparatedListField().bind(Form(), 'foo')
        field.process_formdata([u''])
        self.assertEqual(field.data, [u''])

        field.process_formdata(['a,comma,separated,list'])
        self.assertEqual(field.data, [u'a', u'comma', u'separated', u'list'])

    def test_filter_not_empty_values(self):
        self.assertEqual(filter_not_empty_values(None), None)
        self.assertEqual(filter_not_empty_values([]), None)
        self.assertEqual(filter_not_empty_values(['']), None)
        self.assertEqual(filter_not_empty_values(['hi']), ['hi'])
