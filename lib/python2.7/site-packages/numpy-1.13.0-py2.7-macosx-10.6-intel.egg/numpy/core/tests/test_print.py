from __future__ import division, absolute_import, print_function

import sys
import locale
import nose

import numpy as np
from numpy.testing import (
    run_module_suite, assert_, assert_equal, SkipTest
)


if sys.version_info[0] >= 3:
    from io import StringIO
else:
    from StringIO import StringIO

_REF = {np.inf: 'inf', -np.inf: '-inf', np.nan: 'nan'}


def check_float_type(tp):
    for x in [0, 1, -1, 1e20]:
        assert_equal(str(tp(x)), str(float(x)),
                     err_msg='Failed str formatting for type %s' % tp)

    if tp(1e10).itemsize > 4:
        assert_equal(str(tp(1e10)), str(float('1e10')),
                     err_msg='Failed str formatting for type %s' % tp)
    else:
        ref = '1e+10'
        assert_equal(str(tp(1e10)), ref,
                     err_msg='Failed str formatting for type %s' % tp)

def test_float_types():
    """ Check formatting.

        This is only for the str function, and only for simple types.
        The precision of np.float and np.longdouble aren't the same as the
        python float precision.

    """
    for t in [np.float32, np.double, np.longdouble]:
        yield check_float_type, t

def check_nan_inf_float(tp):
    for x in [np.inf, -np.inf, np.nan]:
        assert_equal(str(tp(x)), _REF[x],
                     err_msg='Failed str formatting for type %s' % tp)

def test_nan_inf_float():
    """ Check formatting of nan & inf.

        This is only for the str function, and only for simple types.
        The precision of np.float and np.longdouble aren't the same as the
        python float precision.

    """
    for t in [np.float32, np.double, np.longdouble]:
        yield check_nan_inf_float, t

def check_complex_type(tp):
    for x in [0, 1, -1, 1e20]:
        assert_equal(str(tp(x)), str(complex(x)),
                     err_msg='Failed str formatting for type %s' % tp)
        assert_equal(str(tp(x*1j)), str(complex(x*1j)),
                     err_msg='Failed str formatting for type %s' % tp)
        assert_equal(str(tp(x + x*1j)), str(complex(x + x*1j)),
                     err_msg='Failed str formatting for type %s' % tp)

    if tp(1e10).itemsize > 8:
        assert_equal(str(tp(1e10)), str(complex(1e10)),
                     err_msg='Failed str formatting for type %s' % tp)
    else:
        ref = '(1e+10+0j)'
        assert_equal(str(tp(1e10)), ref,
                     err_msg='Failed str formatting for type %s' % tp)

def test_complex_types():
    """Check formatting of complex types.

        This is only for the str function, and only for simple types.
        The precision of np.float and np.longdouble aren't the same as the
        python float precision.

    """
    for t in [np.complex64, np.cdouble, np.clongdouble]:
        yield check_complex_type, t

def test_complex_inf_nan():
    """Check inf/nan formatting of complex types."""
    TESTS = {
        complex(np.inf, 0): "(inf+0j)",
        complex(0, np.inf): "inf*j",
        complex(-np.inf, 0): "(-inf+0j)",
        complex(0, -np.inf): "-inf*j",
        complex(np.inf, 1): "(inf+1j)",
        complex(1, np.inf): "(1+inf*j)",
        complex(-np.inf, 1): "(-inf+1j)",
        complex(1, -np.inf): "(1-inf*j)",
        complex(np.nan, 0): "(nan+0j)",
        complex(0, np.nan): "nan*j",
        complex(-np.nan, 0): "(nan+0j)",
        complex(0, -np.nan): "nan*j",
        complex(np.nan, 1): "(nan+1j)",
        complex(1, np.nan): "(1+nan*j)",
        complex(-np.nan, 1): "(nan+1j)",
        complex(1, -np.nan): "(1+nan*j)",
    }
    for tp in [np.complex64, np.cdouble, np.clongdouble]:
        for c, s in TESTS.items():
            yield _check_complex_inf_nan, c, s, tp

def _check_complex_inf_nan(c, s, dtype):
    assert_equal(str(dtype(c)), s)

# print tests
def _test_redirected_print(x, tp, ref=None):
    file = StringIO()
    file_tp = StringIO()
    stdout = sys.stdout
    try:
        sys.stdout = file_tp
        print(tp(x))
        sys.stdout = file
        if ref:
            print(ref)
        else:
            print(x)
    finally:
        sys.stdout = stdout

    assert_equal(file.getvalue(), file_tp.getvalue(),
                 err_msg='print failed for type%s' % tp)

def check_float_type_print(tp):
    for x in [0, 1, -1, 1e20]:
        _test_redirected_print(float(x), tp)

    for x in [np.inf, -np.inf, np.nan]:
        _test_redirected_print(float(x), tp, _REF[x])

    if tp(1e10).itemsize > 4:
        _test_redirected_print(float(1e10), tp)
    else:
        ref = '1e+10'
        _test_redirected_print(float(1e10), tp, ref)

def check_complex_type_print(tp):
    # We do not create complex with inf/nan directly because the feature is
    # missing in python < 2.6
    for x in [0, 1, -1, 1e20]:
        _test_redirected_print(complex(x), tp)

    if tp(1e10).itemsize > 8:
        _test_redirected_print(complex(1e10), tp)
    else:
        ref = '(1e+10+0j)'
        _test_redirected_print(complex(1e10), tp, ref)

    _test_redirected_print(complex(np.inf, 1), tp, '(inf+1j)')
    _test_redirected_print(complex(-np.inf, 1), tp, '(-inf+1j)')
    _test_redirected_print(complex(-np.nan, 1), tp, '(nan+1j)')

def test_float_type_print():
    """Check formatting when using print """
    for t in [np.float32, np.double, np.longdouble]:
        yield check_float_type_print, t

def test_complex_type_print():
    """Check formatting when using print """
    for t in [np.complex64, np.cdouble, np.clongdouble]:
        yield check_complex_type_print, t

def test_scalar_format():
    """Test the str.format method with NumPy scalar types"""
    tests = [('{0}', True, np.bool_),
            ('{0}', False, np.bool_),
            ('{0:d}', 130, np.uint8),
            ('{0:d}', 50000, np.uint16),
            ('{0:d}', 3000000000, np.uint32),
            ('{0:d}', 15000000000000000000, np.uint64),
            ('{0:d}', -120, np.int8),
            ('{0:d}', -30000, np.int16),
            ('{0:d}', -2000000000, np.int32),
            ('{0:d}', -7000000000000000000, np.int64),
            ('{0:g}', 1.5, np.float16),
            ('{0:g}', 1.5, np.float32),
            ('{0:g}', 1.5, np.float64),
            ('{0:g}', 1.5, np.longdouble),
            ('{0:g}', 1.5+0.5j, np.complex64),
            ('{0:g}', 1.5+0.5j, np.complex128),
            ('{0:g}', 1.5+0.5j, np.clongdouble)]

    for (fmat, val, valtype) in tests:
        try:
            assert_equal(fmat.format(val), fmat.format(valtype(val)),
                    "failed with val %s, type %s" % (val, valtype))
        except ValueError as e:
            assert_(False,
               "format raised exception (fmt='%s', val=%s, type=%s, exc='%s')" %
                            (fmat, repr(val), repr(valtype), str(e)))


# Locale tests: scalar types formatting should be independent of the locale
def in_foreign_locale(func):
    """
    Swap LC_NUMERIC locale to one in which the decimal point is ',' and not '.'
    If not possible, raise SkipTest

    """
    if sys.platform == 'win32':
        locales = ['FRENCH']
    else:
        locales = ['fr_FR', 'fr_FR.UTF-8', 'fi_FI', 'fi_FI.UTF-8']

    def wrapper(*args, **kwargs):
        curloc = locale.getlocale(locale.LC_NUMERIC)
        try:
            for loc in locales:
                try:
                    locale.setlocale(locale.LC_NUMERIC, loc)
                    break
                except locale.Error:
                    pass
            else:
                raise SkipTest("Skipping locale test, because "
                                "French locale not found")
            return func(*args, **kwargs)
        finally:
            locale.setlocale(locale.LC_NUMERIC, locale=curloc)
    return nose.tools.make_decorator(func)(wrapper)

@in_foreign_locale
def test_locale_single():
    assert_equal(str(np.float32(1.2)), str(float(1.2)))

@in_foreign_locale
def test_locale_double():
    assert_equal(str(np.double(1.2)), str(float(1.2)))

@in_foreign_locale
def test_locale_longdouble():
    assert_equal(str(np.longdouble(1.2)), str(float(1.2)))

if __name__ == "__main__":
    run_module_suite()
