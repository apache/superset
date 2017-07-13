from unittest import TestCase

import simplejson as json


class TestBitSizeIntAsString(TestCase):
    # Python 2.5, at least the one that ships on Mac OS X, calculates
    # 2 ** 31 as 0! It manages to calculate 1 << 31 correctly.
    values = [
        (200, 200),
        ((1 << 31) - 1, (1 << 31) - 1),
        ((1 << 31), str(1 << 31)),
        ((1 << 31) + 1, str((1 << 31) + 1)),
        (-100, -100),
        ((-1 << 31), str(-1 << 31)),
        ((-1 << 31) - 1, str((-1 << 31) - 1)),
        ((-1 << 31) + 1, (-1 << 31) + 1),
    ]

    def test_invalid_counts(self):
        for n in ['foo', -1, 0, 1.0]:
            self.assertRaises(
                TypeError,
                json.dumps, 0, int_as_string_bitcount=n)

    def test_ints_outside_range_fails(self):
        self.assertNotEqual(
            str(1 << 15),
            json.loads(json.dumps(1 << 15, int_as_string_bitcount=16)),
            )

    def test_ints(self):
        for val, expect in self.values:
            self.assertEqual(
                val,
                json.loads(json.dumps(val)))
            self.assertEqual(
                expect,
                json.loads(json.dumps(val, int_as_string_bitcount=31)),
                )

    def test_lists(self):
        for val, expect in self.values:
            val = [val, val]
            expect = [expect, expect]
            self.assertEqual(
                val,
                json.loads(json.dumps(val)))
            self.assertEqual(
                expect,
                json.loads(json.dumps(val, int_as_string_bitcount=31)))

    def test_dicts(self):
        for val, expect in self.values:
            val = {'k': val}
            expect = {'k': expect}
            self.assertEqual(
                val,
                json.loads(json.dumps(val)))
            self.assertEqual(
                expect,
                json.loads(json.dumps(val, int_as_string_bitcount=31)))

    def test_dict_keys(self):
        for val, _ in self.values:
            expect = {str(val): 'value'}
            val = {val: 'value'}
            self.assertEqual(
                expect,
                json.loads(json.dumps(val)))
            self.assertEqual(
                expect,
                json.loads(json.dumps(val, int_as_string_bitcount=31)))
