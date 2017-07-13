from __future__ import absolute_import
import unittest
import doctest
import sys


class NoExtensionTestSuite(unittest.TestSuite):
    def run(self, result):
        import simplejson
        simplejson._toggle_speedups(False)
        result = unittest.TestSuite.run(self, result)
        simplejson._toggle_speedups(True)
        return result


class TestMissingSpeedups(unittest.TestCase):
    def runTest(self):
        if hasattr(sys, 'pypy_translation_info'):
            "PyPy doesn't need speedups! :)"
        elif hasattr(self, 'skipTest'):
            self.skipTest('_speedups.so is missing!')


def additional_tests(suite=None):
    import simplejson
    import simplejson.encoder
    import simplejson.decoder
    if suite is None:
        suite = unittest.TestSuite()
    for mod in (simplejson, simplejson.encoder, simplejson.decoder):
        suite.addTest(doctest.DocTestSuite(mod))
    suite.addTest(doctest.DocFileSuite('../../index.rst'))
    return suite


def all_tests_suite():
    def get_suite():
        return additional_tests(
            unittest.TestLoader().loadTestsFromNames([
                'simplejson.tests.test_bitsize_int_as_string',
                'simplejson.tests.test_bigint_as_string',
                'simplejson.tests.test_check_circular',
                'simplejson.tests.test_decode',
                'simplejson.tests.test_default',
                'simplejson.tests.test_dump',
                'simplejson.tests.test_encode_basestring_ascii',
                'simplejson.tests.test_encode_for_html',
                'simplejson.tests.test_errors',
                'simplejson.tests.test_fail',
                'simplejson.tests.test_float',
                'simplejson.tests.test_indent',
                'simplejson.tests.test_iterable',
                'simplejson.tests.test_pass1',
                'simplejson.tests.test_pass2',
                'simplejson.tests.test_pass3',
                'simplejson.tests.test_recursion',
                'simplejson.tests.test_scanstring',
                'simplejson.tests.test_separators',
                'simplejson.tests.test_speedups',
                'simplejson.tests.test_str_subclass',
                'simplejson.tests.test_unicode',
                'simplejson.tests.test_decimal',
                'simplejson.tests.test_tuple',
                'simplejson.tests.test_namedtuple',
                'simplejson.tests.test_tool',
                'simplejson.tests.test_for_json',
                'simplejson.tests.test_subclass',
                'simplejson.tests.test_raw_json',
            ]))
    suite = get_suite()
    import simplejson
    if simplejson._import_c_make_encoder() is None:
        suite.addTest(TestMissingSpeedups())
    else:
        suite = unittest.TestSuite([
            suite,
            NoExtensionTestSuite([get_suite()]),
        ])
    return suite


def main():
    runner = unittest.TextTestRunner(verbosity=1 + sys.argv.count('-v'))
    suite = all_tests_suite()
    raise SystemExit(not runner.run(suite).wasSuccessful())


if __name__ == '__main__':
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    main()
