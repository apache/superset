# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Implementations of unittest features from the future."""

# Use unittest2 if it's available, otherwise unittest.  This gives us
# back-ported features for 2.6.
try:
    import unittest2 as unittest
except ImportError:
    import unittest


def unittest_has(method):
    """Does `unittest.TestCase` have `method` defined?"""
    return hasattr(unittest.TestCase, method)


class TestCase(unittest.TestCase):
    """Just like unittest.TestCase, but with assert methods added.

    Designed to be compatible with 3.1 unittest.  Methods are only defined if
    `unittest` doesn't have them.

    """
    # pylint: disable=missing-docstring

    # Many Pythons have this method defined.  But PyPy3 has a bug with it
    # somehow (https://bitbucket.org/pypy/pypy/issues/2092), so always use our
    # own implementation that works everywhere, at least for the ways we're
    # calling it.
    def assertCountEqual(self, s1, s2):
        """Assert these have the same elements, regardless of order."""
        self.assertEqual(sorted(s1), sorted(s2))

    if not unittest_has('assertRaisesRegex'):
        def assertRaisesRegex(self, *args, **kwargs):
            return self.assertRaisesRegexp(*args, **kwargs)

    if not unittest_has('assertRegex'):
        def assertRegex(self, *args, **kwargs):
            return self.assertRegexpMatches(*args, **kwargs)
