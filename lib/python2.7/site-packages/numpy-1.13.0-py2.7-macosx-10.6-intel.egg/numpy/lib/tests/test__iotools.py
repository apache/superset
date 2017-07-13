from __future__ import division, absolute_import, print_function

import sys
import time
from datetime import date

import numpy as np
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_equal, assert_allclose,
    assert_raises
    )
from numpy.lib._iotools import (
    LineSplitter, NameValidator, StringConverter,
    has_nested_fields, easy_dtype, flatten_dtype
    )


class TestLineSplitter(TestCase):
    "Tests the LineSplitter class."

    def test_no_delimiter(self):
        "Test LineSplitter w/o delimiter"
        strg = b" 1 2 3 4  5 # test"
        test = LineSplitter()(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'5'])
        test = LineSplitter('')(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'5'])

    def test_space_delimiter(self):
        "Test space delimiter"
        strg = b" 1 2 3 4  5 # test"
        test = LineSplitter(b' ')(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'', b'5'])
        test = LineSplitter(b'  ')(strg)
        assert_equal(test, [b'1 2 3 4', b'5'])

    def test_tab_delimiter(self):
        "Test tab delimiter"
        strg = b" 1\t 2\t 3\t 4\t 5  6"
        test = LineSplitter(b'\t')(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'5  6'])
        strg = b" 1  2\t 3  4\t 5  6"
        test = LineSplitter(b'\t')(strg)
        assert_equal(test, [b'1  2', b'3  4', b'5  6'])

    def test_other_delimiter(self):
        "Test LineSplitter on delimiter"
        strg = b"1,2,3,4,,5"
        test = LineSplitter(b',')(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'', b'5'])
        #
        strg = b" 1,2,3,4,,5 # test"
        test = LineSplitter(b',')(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'', b'5'])

    def test_constant_fixed_width(self):
        "Test LineSplitter w/ fixed-width fields"
        strg = b"  1  2  3  4     5   # test"
        test = LineSplitter(3)(strg)
        assert_equal(test, [b'1', b'2', b'3', b'4', b'', b'5', b''])
        #
        strg = b"  1     3  4  5  6# test"
        test = LineSplitter(20)(strg)
        assert_equal(test, [b'1     3  4  5  6'])
        #
        strg = b"  1     3  4  5  6# test"
        test = LineSplitter(30)(strg)
        assert_equal(test, [b'1     3  4  5  6'])

    def test_variable_fixed_width(self):
        strg = b"  1     3  4  5  6# test"
        test = LineSplitter((3, 6, 6, 3))(strg)
        assert_equal(test, [b'1', b'3', b'4  5', b'6'])
        #
        strg = b"  1     3  4  5  6# test"
        test = LineSplitter((6, 6, 9))(strg)
        assert_equal(test, [b'1', b'3  4', b'5  6'])

# -----------------------------------------------------------------------------


class TestNameValidator(TestCase):

    def test_case_sensitivity(self):
        "Test case sensitivity"
        names = ['A', 'a', 'b', 'c']
        test = NameValidator().validate(names)
        assert_equal(test, ['A', 'a', 'b', 'c'])
        test = NameValidator(case_sensitive=False).validate(names)
        assert_equal(test, ['A', 'A_1', 'B', 'C'])
        test = NameValidator(case_sensitive='upper').validate(names)
        assert_equal(test, ['A', 'A_1', 'B', 'C'])
        test = NameValidator(case_sensitive='lower').validate(names)
        assert_equal(test, ['a', 'a_1', 'b', 'c'])

        # check exceptions
        assert_raises(ValueError, NameValidator, case_sensitive='foobar')

    def test_excludelist(self):
        "Test excludelist"
        names = ['dates', 'data', 'Other Data', 'mask']
        validator = NameValidator(excludelist=['dates', 'data', 'mask'])
        test = validator.validate(names)
        assert_equal(test, ['dates_', 'data_', 'Other_Data', 'mask_'])

    def test_missing_names(self):
        "Test validate missing names"
        namelist = ('a', 'b', 'c')
        validator = NameValidator()
        assert_equal(validator(namelist), ['a', 'b', 'c'])
        namelist = ('', 'b', 'c')
        assert_equal(validator(namelist), ['f0', 'b', 'c'])
        namelist = ('a', 'b', '')
        assert_equal(validator(namelist), ['a', 'b', 'f0'])
        namelist = ('', 'f0', '')
        assert_equal(validator(namelist), ['f1', 'f0', 'f2'])

    def test_validate_nb_names(self):
        "Test validate nb names"
        namelist = ('a', 'b', 'c')
        validator = NameValidator()
        assert_equal(validator(namelist, nbfields=1), ('a',))
        assert_equal(validator(namelist, nbfields=5, defaultfmt="g%i"),
                     ['a', 'b', 'c', 'g0', 'g1'])

    def test_validate_wo_names(self):
        "Test validate no names"
        namelist = None
        validator = NameValidator()
        assert_(validator(namelist) is None)
        assert_equal(validator(namelist, nbfields=3), ['f0', 'f1', 'f2'])

# -----------------------------------------------------------------------------


def _bytes_to_date(s):
    if sys.version_info[0] >= 3:
        return date(*time.strptime(s.decode('latin1'), "%Y-%m-%d")[:3])
    else:
        return date(*time.strptime(s, "%Y-%m-%d")[:3])


class TestStringConverter(TestCase):
    "Test StringConverter"

    def test_creation(self):
        "Test creation of a StringConverter"
        converter = StringConverter(int, -99999)
        assert_equal(converter._status, 1)
        assert_equal(converter.default, -99999)

    def test_upgrade(self):
        "Tests the upgrade method."

        converter = StringConverter()
        assert_equal(converter._status, 0)

        # test int
        assert_equal(converter.upgrade(b'0'), 0)
        assert_equal(converter._status, 1)

        # On systems where integer defaults to 32-bit, the statuses will be
        # offset by one, so we check for this here.
        import numpy.core.numeric as nx
        status_offset = int(nx.dtype(nx.integer).itemsize < nx.dtype(nx.int64).itemsize)

        # test int > 2**32
        assert_equal(converter.upgrade(b'17179869184'), 17179869184)
        assert_equal(converter._status, 1 + status_offset)

        # test float
        assert_allclose(converter.upgrade(b'0.'), 0.0)
        assert_equal(converter._status, 2 + status_offset)

        # test complex
        assert_equal(converter.upgrade(b'0j'), complex('0j'))
        assert_equal(converter._status, 3 + status_offset)

        # test str
        assert_equal(converter.upgrade(b'a'), b'a')
        assert_equal(converter._status, len(converter._mapper) - 1)

    def test_missing(self):
        "Tests the use of missing values."
        converter = StringConverter(missing_values=(b'missing',
                                                    b'missed'))
        converter.upgrade(b'0')
        assert_equal(converter(b'0'), 0)
        assert_equal(converter(b''), converter.default)
        assert_equal(converter(b'missing'), converter.default)
        assert_equal(converter(b'missed'), converter.default)
        try:
            converter('miss')
        except ValueError:
            pass

    def test_upgrademapper(self):
        "Tests updatemapper"
        dateparser = _bytes_to_date
        StringConverter.upgrade_mapper(dateparser, date(2000, 1, 1))
        convert = StringConverter(dateparser, date(2000, 1, 1))
        test = convert(b'2001-01-01')
        assert_equal(test, date(2001, 1, 1))
        test = convert(b'2009-01-01')
        assert_equal(test, date(2009, 1, 1))
        test = convert(b'')
        assert_equal(test, date(2000, 1, 1))

    def test_string_to_object(self):
        "Make sure that string-to-object functions are properly recognized"
        conv = StringConverter(_bytes_to_date)
        assert_equal(conv._mapper[-2][0](0), 0j)
        assert_(hasattr(conv, 'default'))

    def test_keep_default(self):
        "Make sure we don't lose an explicit default"
        converter = StringConverter(None, missing_values=b'',
                                    default=-999)
        converter.upgrade(b'3.14159265')
        assert_equal(converter.default, -999)
        assert_equal(converter.type, np.dtype(float))
        #
        converter = StringConverter(
            None, missing_values=b'', default=0)
        converter.upgrade(b'3.14159265')
        assert_equal(converter.default, 0)
        assert_equal(converter.type, np.dtype(float))

    def test_keep_default_zero(self):
        "Check that we don't lose a default of 0"
        converter = StringConverter(int, default=0,
                                    missing_values=b"N/A")
        assert_equal(converter.default, 0)

    def test_keep_missing_values(self):
        "Check that we're not losing missing values"
        converter = StringConverter(int, default=0,
                                    missing_values=b"N/A")
        assert_equal(
            converter.missing_values, set([b'', b'N/A']))

    def test_int64_dtype(self):
        "Check that int64 integer types can be specified"
        converter = StringConverter(np.int64, default=0)
        val = b"-9223372036854775807"
        assert_(converter(val) == -9223372036854775807)
        val = b"9223372036854775807"
        assert_(converter(val) == 9223372036854775807)

    def test_uint64_dtype(self):
        "Check that uint64 integer types can be specified"
        converter = StringConverter(np.uint64, default=0)
        val = b"9223372043271415339"
        assert_(converter(val) == 9223372043271415339)


class TestMiscFunctions(TestCase):

    def test_has_nested_dtype(self):
        "Test has_nested_dtype"
        ndtype = np.dtype(np.float)
        assert_equal(has_nested_fields(ndtype), False)
        ndtype = np.dtype([('A', '|S3'), ('B', float)])
        assert_equal(has_nested_fields(ndtype), False)
        ndtype = np.dtype([('A', int), ('B', [('BA', float), ('BB', '|S1')])])
        assert_equal(has_nested_fields(ndtype), True)

    def test_easy_dtype(self):
        "Test ndtype on dtypes"
        # Simple case
        ndtype = float
        assert_equal(easy_dtype(ndtype), np.dtype(float))
        # As string w/o names
        ndtype = "i4, f8"
        assert_equal(easy_dtype(ndtype),
                     np.dtype([('f0', "i4"), ('f1', "f8")]))
        # As string w/o names but different default format
        assert_equal(easy_dtype(ndtype, defaultfmt="field_%03i"),
                     np.dtype([('field_000', "i4"), ('field_001', "f8")]))
        # As string w/ names
        ndtype = "i4, f8"
        assert_equal(easy_dtype(ndtype, names="a, b"),
                     np.dtype([('a', "i4"), ('b', "f8")]))
        # As string w/ names (too many)
        ndtype = "i4, f8"
        assert_equal(easy_dtype(ndtype, names="a, b, c"),
                     np.dtype([('a', "i4"), ('b', "f8")]))
        # As string w/ names (not enough)
        ndtype = "i4, f8"
        assert_equal(easy_dtype(ndtype, names=", b"),
                     np.dtype([('f0', "i4"), ('b', "f8")]))
        # ... (with different default format)
        assert_equal(easy_dtype(ndtype, names="a", defaultfmt="f%02i"),
                     np.dtype([('a', "i4"), ('f00', "f8")]))
        # As list of tuples w/o names
        ndtype = [('A', int), ('B', float)]
        assert_equal(easy_dtype(ndtype), np.dtype([('A', int), ('B', float)]))
        # As list of tuples w/ names
        assert_equal(easy_dtype(ndtype, names="a,b"),
                     np.dtype([('a', int), ('b', float)]))
        # As list of tuples w/ not enough names
        assert_equal(easy_dtype(ndtype, names="a"),
                     np.dtype([('a', int), ('f0', float)]))
        # As list of tuples w/ too many names
        assert_equal(easy_dtype(ndtype, names="a,b,c"),
                     np.dtype([('a', int), ('b', float)]))
        # As list of types w/o names
        ndtype = (int, float, float)
        assert_equal(easy_dtype(ndtype),
                     np.dtype([('f0', int), ('f1', float), ('f2', float)]))
        # As list of types w names
        ndtype = (int, float, float)
        assert_equal(easy_dtype(ndtype, names="a, b, c"),
                     np.dtype([('a', int), ('b', float), ('c', float)]))
        # As simple dtype w/ names
        ndtype = np.dtype(float)
        assert_equal(easy_dtype(ndtype, names="a, b, c"),
                     np.dtype([(_, float) for _ in ('a', 'b', 'c')]))
        # As simple dtype w/o names (but multiple fields)
        ndtype = np.dtype(float)
        assert_equal(
            easy_dtype(ndtype, names=['', '', ''], defaultfmt="f%02i"),
            np.dtype([(_, float) for _ in ('f00', 'f01', 'f02')]))

    def test_flatten_dtype(self):
        "Testing flatten_dtype"
        # Standard dtype
        dt = np.dtype([("a", "f8"), ("b", "f8")])
        dt_flat = flatten_dtype(dt)
        assert_equal(dt_flat, [float, float])
        # Recursive dtype
        dt = np.dtype([("a", [("aa", '|S1'), ("ab", '|S2')]), ("b", int)])
        dt_flat = flatten_dtype(dt)
        assert_equal(dt_flat, [np.dtype('|S1'), np.dtype('|S2'), int])
        # dtype with shaped fields
        dt = np.dtype([("a", (float, 2)), ("b", (int, 3))])
        dt_flat = flatten_dtype(dt)
        assert_equal(dt_flat, [float, int])
        dt_flat = flatten_dtype(dt, True)
        assert_equal(dt_flat, [float] * 2 + [int] * 3)
        # dtype w/ titles
        dt = np.dtype([(("a", "A"), "f8"), (("b", "B"), "f8")])
        dt_flat = flatten_dtype(dt)
        assert_equal(dt_flat, [float, float])

if __name__ == "__main__":
    run_module_suite()
