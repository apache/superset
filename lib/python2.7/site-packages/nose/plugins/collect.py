"""
This plugin bypasses the actual execution of tests, and instead just collects
test names. Fixtures are also bypassed, so running nosetests with the 
collection plugin enabled should be very quick.

This plugin is useful in combination with the testid plugin (``--with-id``).
Run both together to get an indexed list of all tests, which will enable you to
run individual tests by index number.

This plugin is also useful for counting tests in a test suite, and making
people watching your demo think all of your tests pass.
"""
from nose.plugins.base import Plugin
from nose.case import Test
import logging
import unittest

log = logging.getLogger(__name__)


class CollectOnly(Plugin):
    """
    Collect and output test names only, don't run any tests.
    """
    name = "collect-only"
    enableOpt = 'collect_only'

    def options(self, parser, env):
        """Register commandline options.
        """
        parser.add_option('--collect-only',
                          action='store_true',
                          dest=self.enableOpt,
                          default=env.get('NOSE_COLLECT_ONLY'),
                          help="Enable collect-only: %s [COLLECT_ONLY]" %
                          (self.help()))

    def prepareTestLoader(self, loader):
        """Install collect-only suite class in TestLoader.
        """
        # Disable context awareness
        log.debug("Preparing test loader")
        loader.suiteClass = TestSuiteFactory(self.conf)

    def prepareTestCase(self, test):
        """Replace actual test with dummy that always passes.
        """
        # Return something that always passes
        log.debug("Preparing test case %s", test)
        if not isinstance(test, Test):
            return
        def run(result):
            # We need to make these plugin calls because there won't be
            # a result proxy, due to using a stripped-down test suite
            self.conf.plugins.startTest(test)
            result.startTest(test)
            self.conf.plugins.addSuccess(test)
            result.addSuccess(test)
            self.conf.plugins.stopTest(test)
            result.stopTest(test)
        return run


class TestSuiteFactory:
    """
    Factory for producing configured test suites.
    """
    def __init__(self, conf):
        self.conf = conf

    def __call__(self, tests=(), **kw):
        return TestSuite(tests, conf=self.conf)


class TestSuite(unittest.TestSuite):
    """
    Basic test suite that bypasses most proxy and plugin calls, but does
    wrap tests in a nose.case.Test so prepareTestCase will be called.
    """
    def __init__(self, tests=(), conf=None):
        self.conf = conf
        # Exec lazy suites: makes discovery depth-first
        if callable(tests):
            tests = tests()
        log.debug("TestSuite(%r)", tests)
        unittest.TestSuite.__init__(self, tests)

    def addTest(self, test):
        log.debug("Add test %s", test)
        if isinstance(test, unittest.TestSuite):
            self._tests.append(test)
        else:
            self._tests.append(Test(test, config=self.conf))

