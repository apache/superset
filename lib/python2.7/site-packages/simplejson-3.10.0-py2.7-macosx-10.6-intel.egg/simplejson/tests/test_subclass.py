from unittest import TestCase
import simplejson as json

from decimal import Decimal

class AlternateInt(int):
    def __repr__(self):
        return 'invalid json'
    __str__ = __repr__


class AlternateFloat(float):
    def __repr__(self):
        return 'invalid json'
    __str__ = __repr__


# class AlternateDecimal(Decimal):
#     def __repr__(self):
#         return 'invalid json'


class TestSubclass(TestCase):
    def test_int(self):
        self.assertEqual(json.dumps(AlternateInt(1)), '1')
        self.assertEqual(json.dumps(AlternateInt(-1)), '-1')
        self.assertEqual(json.loads(json.dumps({AlternateInt(1): 1})), {'1': 1})

    def test_float(self):
        self.assertEqual(json.dumps(AlternateFloat(1.0)), '1.0')
        self.assertEqual(json.dumps(AlternateFloat(-1.0)), '-1.0')
        self.assertEqual(json.loads(json.dumps({AlternateFloat(1.0): 1})), {'1.0': 1})

    # NOTE: Decimal subclasses are not supported as-is
    # def test_decimal(self):
    #     self.assertEqual(json.dumps(AlternateDecimal('1.0')), '1.0')
    #     self.assertEqual(json.dumps(AlternateDecimal('-1.0')), '-1.0')
