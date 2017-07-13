from __future__ import division, absolute_import, print_function

import warnings

from numpy.testing import (dec, assert_, assert_raises, run_module_suite,
                           SkipTest, KnownFailureException)


def test_slow():
    @dec.slow
    def slow_func(x, y, z):
        pass

    assert_(slow_func.slow)

def test_setastest():
    @dec.setastest()
    def f_default(a):
        pass

    @dec.setastest(True)
    def f_istest(a):
        pass

    @dec.setastest(False)
    def f_isnottest(a):
        pass

    assert_(f_default.__test__)
    assert_(f_istest.__test__)
    assert_(not f_isnottest.__test__)

class DidntSkipException(Exception):
    pass

def test_skip_functions_hardcoded():
    @dec.skipif(True)
    def f1(x):
        raise DidntSkipException

    try:
        f1('a')
    except DidntSkipException:
        raise Exception('Failed to skip')
    except SkipTest:
        pass

    @dec.skipif(False)
    def f2(x):
        raise DidntSkipException

    try:
        f2('a')
    except DidntSkipException:
        pass
    except SkipTest:
        raise Exception('Skipped when not expected to')


def test_skip_functions_callable():
    def skip_tester():
        return skip_flag == 'skip me!'

    @dec.skipif(skip_tester)
    def f1(x):
        raise DidntSkipException

    try:
        skip_flag = 'skip me!'
        f1('a')
    except DidntSkipException:
        raise Exception('Failed to skip')
    except SkipTest:
        pass

    @dec.skipif(skip_tester)
    def f2(x):
        raise DidntSkipException

    try:
        skip_flag = 'five is right out!'
        f2('a')
    except DidntSkipException:
        pass
    except SkipTest:
        raise Exception('Skipped when not expected to')


def test_skip_generators_hardcoded():
    @dec.knownfailureif(True, "This test is known to fail")
    def g1(x):
        for i in range(x):
            yield i

    try:
        for j in g1(10):
            pass
    except KnownFailureException:
        pass
    else:
        raise Exception('Failed to mark as known failure')

    @dec.knownfailureif(False, "This test is NOT known to fail")
    def g2(x):
        for i in range(x):
            yield i
        raise DidntSkipException('FAIL')

    try:
        for j in g2(10):
            pass
    except KnownFailureException:
        raise Exception('Marked incorrectly as known failure')
    except DidntSkipException:
        pass


def test_skip_generators_callable():
    def skip_tester():
        return skip_flag == 'skip me!'

    @dec.knownfailureif(skip_tester, "This test is known to fail")
    def g1(x):
        for i in range(x):
            yield i

    try:
        skip_flag = 'skip me!'
        for j in g1(10):
            pass
    except KnownFailureException:
        pass
    else:
        raise Exception('Failed to mark as known failure')

    @dec.knownfailureif(skip_tester, "This test is NOT known to fail")
    def g2(x):
        for i in range(x):
            yield i
        raise DidntSkipException('FAIL')

    try:
        skip_flag = 'do not skip'
        for j in g2(10):
            pass
    except KnownFailureException:
        raise Exception('Marked incorrectly as known failure')
    except DidntSkipException:
        pass


def test_deprecated():
    @dec.deprecated(True)
    def non_deprecated_func():
        pass

    @dec.deprecated()
    def deprecated_func():
        import warnings
        warnings.warn("TEST: deprecated func", DeprecationWarning)

    @dec.deprecated()
    def deprecated_func2():
        import warnings
        warnings.warn("AHHHH")
        raise ValueError

    @dec.deprecated()
    def deprecated_func3():
        import warnings
        warnings.warn("AHHHH")

    # marked as deprecated, but does not raise DeprecationWarning
    assert_raises(AssertionError, non_deprecated_func)
    # should be silent
    deprecated_func()
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("always")  # do not propagate unrelated warnings
        # fails if deprecated decorator just disables test. See #1453.
        assert_raises(ValueError, deprecated_func2)
        # warning is not a DeprecationWarning
        assert_raises(AssertionError, deprecated_func3)


if __name__ == '__main__':
    run_module_suite()
