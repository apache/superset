from wtforms.form import Form

from superset.forms import (
    CommaSeparatedListField, filter_not_empty_values)
from tests.base_tests import SupersetTestCase


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
