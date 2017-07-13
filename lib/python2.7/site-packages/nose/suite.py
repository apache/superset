"""
Test Suites
-----------

Provides a LazySuite, which is a suite whose test list is a generator
function, and ContextSuite,which can run fixtures (setup/teardown
functions or methods) for the context that contains its tests.

"""
from __future__ import generators

import logging
import sys
import unittest
from nose.case import Test
from nose.config import Config
from nose.proxy import ResultProxyFactory
from nose.util import isclass, resolve_name, try_run

if sys.platform == 'cli':
    if sys.version_info[:2] < (2, 6):
        import clr
        clr.AddReference("IronPython")
        from IronPython.Runtime.Exceptions import StringException
    else:
        class StringException(Exception):
            pass

log = logging.getLogger(__name__)
#log.setLevel(logging.DEBUG)

# Singleton for default value -- see ContextSuite.__init__ below
_def = object()


def _strclass(cls):
    return "%s.%s" % (cls.__module__, cls.__name__)

class MixedContextError(Exception):
    """Error raised when a context suite sees tests from more than
    one context.
    """
    pass


class LazySuite(unittest.TestSuite):
    """A suite that may use a generator as its list of tests
    """
    def __init__(self, tests=()):
        """Initialize the suite. tests may be an iterable or a generator
        """
        super(LazySuite, self).__init__()
        self._set_tests(tests)

    def __iter__(self):
        return iter(self._tests)

    def __repr__(self):
        return "<%s tests=generator (%s)>" % (
            _strclass(self.__class__), id(self))

    def __hash__(self):
        return object.__hash__(self)

    __str__ = __repr__

    def addTest(self, test):
        self._precache.append(test)

    # added to bypass run changes in 2.7's unittest
    def run(self, result):
        for test in self._tests:
            if result.shouldStop:
                break
            test(result)
        return result

    def __nonzero__(self):
        log.debug("tests in %s?", id(self))
        if self._precache:
            return True
        if self.test_generator is None:
            return False
        try:
            test = self.test_generator.next()
            if test is not None:
                self._precache.append(test)
                return True
        except StopIteration:
            pass
        return False

    def _get_tests(self):
        log.debug("precache is %s", self._precache)
        for test in self._precache:
            yield test
        if self.test_generator is None:
            return
        for test in self.test_generator:
            yield test

    def _set_tests(self, tests):
        self._precache = []
        is_suite = isinstance(tests, unittest.TestSuite)
        if callable(tests) and not is_suite:
            self.test_generator = tests()
        elif is_suite:
            # Suites need special treatment: they must be called like
            # tests for their setup/teardown to run (if any)
            self.addTests([tests])
            self.test_generator = None
        else:
            self.addTests(tests)
            self.test_generator = None

    _tests = property(_get_tests, _set_tests, None,
                      "Access the tests in this suite. Access is through a "
                      "generator, so iteration may not be repeatable.")


class ContextSuite(LazySuite):
    """A suite with context.

    A ContextSuite executes fixtures (setup and teardown functions or
    methods) for the context containing its tests.

    The context may be explicitly passed. If it is not, a context (or
    nested set of contexts) will be constructed by examining the tests
    in the suite.
    """
    failureException = unittest.TestCase.failureException
    was_setup = False
    was_torndown = False
    classSetup = ('setup_class', 'setup_all', 'setupClass', 'setupAll',
                     'setUpClass', 'setUpAll')
    classTeardown = ('teardown_class', 'teardown_all', 'teardownClass',
                     'teardownAll', 'tearDownClass', 'tearDownAll')
    moduleSetup = ('setup_module', 'setupModule', 'setUpModule', 'setup',
                   'setUp')
    moduleTeardown = ('teardown_module', 'teardownModule', 'tearDownModule',
                      'teardown', 'tearDown')
    packageSetup = ('setup_package', 'setupPackage', 'setUpPackage')
    packageTeardown = ('teardown_package', 'teardownPackage',
                       'tearDownPackage')

    def __init__(self, tests=(), context=None, factory=None,
                 config=None, resultProxy=None, can_split=True):
        log.debug("Context suite for %s (%s) (%s)", tests, context, id(self))
        self.context = context
        self.factory = factory
        if config is None:
            config = Config()
        self.config = config
        self.resultProxy = resultProxy
        self.has_run = False
        self.can_split = can_split
        self.error_context = None
        super(ContextSuite, self).__init__(tests)

    def __repr__(self):
        return "<%s context=%s>" % (
            _strclass(self.__class__),
            getattr(self.context, '__name__', self.context))
    __str__ = __repr__

    def id(self):
        if self.error_context:
            return '%s:%s' % (repr(self), self.error_context)
        else:
            return repr(self)

    def __hash__(self):
        return object.__hash__(self)

    # 2.3 compat -- force 2.4 call sequence
    def __call__(self, *arg, **kw):
        return self.run(*arg, **kw)

    def exc_info(self):
        """Hook for replacing error tuple output
        """
        return sys.exc_info()

    def _exc_info(self):
        """Bottleneck to fix up IronPython string exceptions
        """
        e = self.exc_info()
        if sys.platform == 'cli':
            if isinstance(e[0], StringException):
                # IronPython throws these StringExceptions, but
                # traceback checks type(etype) == str. Make a real
                # string here.
                e = (str(e[0]), e[1], e[2])

        return e

    def run(self, result):
        """Run tests in suite inside of suite fixtures.
        """
        # proxy the result for myself
        log.debug("suite %s (%s) run called, tests: %s", id(self), self, self._tests)
        #import pdb
        #pdb.set_trace()
        if self.resultProxy:
            result, orig = self.resultProxy(result, self), result
        else:
            result, orig = result, result
        try:
            self.setUp()
        except KeyboardInterrupt:
            raise
        except:
            self.error_context = 'setup'
            result.addError(self, self._exc_info())
            return
        try:
            for test in self._tests:
                if result.shouldStop:
                    log.debug("stopping")
                    break
                # each nose.case.Test will create its own result proxy
                # so the cases need the original result, to avoid proxy
                # chains
                test(orig)
        finally:
            self.has_run = True
            try:
                self.tearDown()
            except KeyboardInterrupt:
                raise
            except:
                self.error_context = 'teardown'
                result.addError(self, self._exc_info())

    def hasFixtures(self, ctx_callback=None):
        context = self.context
        if context is None:
            return False
        if self.implementsAnyFixture(context, ctx_callback=ctx_callback):
            return True
        # My context doesn't have any, but its ancestors might
        factory = self.factory
        if factory:
            ancestors = factory.context.get(self, [])
            for ancestor in ancestors:
                if self.implementsAnyFixture(
                    ancestor, ctx_callback=ctx_callback):
                    return True
        return False

    def implementsAnyFixture(self, context, ctx_callback):
        if isclass(context):
            names = self.classSetup + self.classTeardown
        else:
            names = self.moduleSetup + self.moduleTeardown
            if hasattr(context, '__path__'):
                names += self.packageSetup + self.packageTeardown
        # If my context has any fixture attribute, I have fixtures
        fixt = False
        for m in names:
            if hasattr(context, m):
                fixt = True
                break
        if ctx_callback is None:
            return fixt
        return ctx_callback(context, fixt)

    def setUp(self):
        log.debug("suite %s setUp called, tests: %s", id(self), self._tests)
        if not self:
            # I have no tests
            log.debug("suite %s has no tests", id(self))
            return
        if self.was_setup:
            log.debug("suite %s already set up", id(self))
            return
        context = self.context
        if context is None:
            return
        # before running my own context's setup, I need to
        # ask the factory if my context's contexts' setups have been run
        factory = self.factory
        if factory:
            # get a copy, since we'll be destroying it as we go
            ancestors = factory.context.get(self, [])[:]
            while ancestors:
                ancestor = ancestors.pop()
                log.debug("ancestor %s may need setup", ancestor)
                if ancestor in factory.was_setup:
                    continue
                log.debug("ancestor %s does need setup", ancestor)
                self.setupContext(ancestor)
            if not context in factory.was_setup:
                self.setupContext(context)
        else:
            self.setupContext(context)
        self.was_setup = True
        log.debug("completed suite setup")

    def setupContext(self, context):
        self.config.plugins.startContext(context)
        log.debug("%s setup context %s", self, context)
        if self.factory:
            if context in self.factory.was_setup:
                return
            # note that I ran the setup for this context, so that I'll run
            # the teardown in my teardown
            self.factory.was_setup[context] = self
        if isclass(context):
            names = self.classSetup
        else:
            names = self.moduleSetup
            if hasattr(context, '__path__'):
                names = self.packageSetup + names
        try_run(context, names)

    def shortDescription(self):
        if self.context is None:
            return "test suite"
        return "test suite for %s" % self.context

    def tearDown(self):
        log.debug('context teardown')
        if not self.was_setup or self.was_torndown:
            log.debug(
                "No reason to teardown (was_setup? %s was_torndown? %s)"
                % (self.was_setup, self.was_torndown))
            return
        self.was_torndown = True
        context = self.context
        if context is None:
            log.debug("No context to tear down")
            return

        # for each ancestor... if the ancestor was setup
        # and I did the setup, I can do teardown
        factory = self.factory
        if factory:
            ancestors = factory.context.get(self, []) + [context]
            for ancestor in ancestors:
                log.debug('ancestor %s may need teardown', ancestor)
                if not ancestor in factory.was_setup:
                    log.debug('ancestor %s was not setup', ancestor)
                    continue
                if ancestor in factory.was_torndown:
                    log.debug('ancestor %s already torn down', ancestor)
                    continue
                setup = factory.was_setup[ancestor]
                log.debug("%s setup ancestor %s", setup, ancestor)
                if setup is self:
                    self.teardownContext(ancestor)
        else:
            self.teardownContext(context)

    def teardownContext(self, context):
        log.debug("%s teardown context %s", self, context)
        if self.factory:
            if context in self.factory.was_torndown:
                return
            self.factory.was_torndown[context] = self
        if isclass(context):
            names = self.classTeardown
        else:
            names = self.moduleTeardown
            if hasattr(context, '__path__'):
                names = self.packageTeardown + names
        try_run(context, names)
        self.config.plugins.stopContext(context)

    # FIXME the wrapping has to move to the factory?
    def _get_wrapped_tests(self):
        for test in self._get_tests():
            if isinstance(test, Test) or isinstance(test, unittest.TestSuite):
                yield test
            else:
                yield Test(test,
                           config=self.config,
                           resultProxy=self.resultProxy)

    _tests = property(_get_wrapped_tests, LazySuite._set_tests, None,
                      "Access the tests in this suite. Tests are returned "
                      "inside of a context wrapper.")


class ContextSuiteFactory(object):
    """Factory for ContextSuites. Called with a collection of tests,
    the factory decides on a hierarchy of contexts by introspecting
    the collection or the tests themselves to find the objects
    containing the test objects. It always returns one suite, but that
    suite may consist of a hierarchy of nested suites.
    """
    suiteClass = ContextSuite
    def __init__(self, config=None, suiteClass=None, resultProxy=_def):
        if config is None:
            config = Config()
        self.config = config
        if suiteClass is not None:
            self.suiteClass = suiteClass
        # Using a singleton to represent default instead of None allows
        # passing resultProxy=None to turn proxying off.
        if resultProxy is _def:
            resultProxy = ResultProxyFactory(config=config)
        self.resultProxy = resultProxy
        self.suites = {}
        self.context = {}
        self.was_setup = {}
        self.was_torndown = {}

    def __call__(self, tests, **kw):
        """Return ``ContextSuite`` for tests. ``tests`` may either
        be a callable (in which case the resulting ContextSuite will
        have no parent context and be evaluated lazily) or an
        iterable. In that case the tests will wrapped in
        nose.case.Test, be examined and the context of each found and a
        suite of suites returned, organized into a stack with the
        outermost suites belonging to the outermost contexts.
        """
        log.debug("Create suite for %s", tests)
        context = kw.pop('context', getattr(tests, 'context', None))
        log.debug("tests %s context %s", tests, context)
        if context is None:
            tests = self.wrapTests(tests)
            try:
                context = self.findContext(tests)
            except MixedContextError:
                return self.makeSuite(self.mixedSuites(tests), None, **kw)
        return self.makeSuite(tests, context, **kw)

    def ancestry(self, context):
        """Return the ancestry of the context (that is, all of the
        packages and modules containing the context), in order of
        descent with the outermost ancestor last.
        This method is a generator.
        """
        log.debug("get ancestry %s", context)
        if context is None:
            return
        # Methods include reference to module they are defined in, we
        # don't want that, instead want the module the class is in now
        # (classes are re-ancestored elsewhere).
        if hasattr(context, 'im_class'):
            context = context.im_class
        elif hasattr(context, '__self__'):
            context = context.__self__.__class__
        if hasattr(context, '__module__'):
            ancestors = context.__module__.split('.')
        elif hasattr(context, '__name__'):
            ancestors = context.__name__.split('.')[:-1]
        else:
            raise TypeError("%s has no ancestors?" % context)
        while ancestors:
            log.debug(" %s ancestors %s", context, ancestors)
            yield resolve_name('.'.join(ancestors))
            ancestors.pop()

    def findContext(self, tests):
        if callable(tests) or isinstance(tests, unittest.TestSuite):
            return None
        context = None
        for test in tests:
            # Don't look at suites for contexts, only tests
            ctx = getattr(test, 'context', None)
            if ctx is None:
                continue
            if context is None:
                context = ctx
            elif context != ctx:
                raise MixedContextError(
                    "Tests with different contexts in same suite! %s != %s"
                    % (context, ctx))
        return context

    def makeSuite(self, tests, context, **kw):
        suite = self.suiteClass(
            tests, context=context, config=self.config, factory=self,
            resultProxy=self.resultProxy, **kw)
        if context is not None:
            self.suites.setdefault(context, []).append(suite)
            self.context.setdefault(suite, []).append(context)
            log.debug("suite %s has context %s", suite,
                      getattr(context, '__name__', None))
            for ancestor in self.ancestry(context):
                self.suites.setdefault(ancestor, []).append(suite)
                self.context[suite].append(ancestor)
                log.debug("suite %s has ancestor %s", suite, ancestor.__name__)
        return suite

    def mixedSuites(self, tests):
        """The complex case where there are tests that don't all share
        the same context. Groups tests into suites with common ancestors,
        according to the following (essentially tail-recursive) procedure:

        Starting with the context of the first test, if it is not
        None, look for tests in the remaining tests that share that
        ancestor. If any are found, group into a suite with that
        ancestor as the context, and replace the current suite with
        that suite. Continue this process for each ancestor of the
        first test, until all ancestors have been processed. At this
        point if any tests remain, recurse with those tests as the
        input, returning a list of the common suite (which may be the
        suite or test we started with, if no common tests were found)
        plus the results of recursion.
        """
        if not tests:
            return []
        head = tests.pop(0)
        if not tests:
            return [head] # short circuit when none are left to combine
        suite = head # the common ancestry suite, so far
        tail = tests[:]
        context = getattr(head, 'context', None)
        if context is not None:
            ancestors = [context] + [a for a in self.ancestry(context)]
            for ancestor in ancestors:
                common = [suite] # tests with ancestor in common, so far
                remain = [] # tests that remain to be processed
                for test in tail:
                    found_common = False
                    test_ctx = getattr(test, 'context', None)
                    if test_ctx is None:
                        remain.append(test)
                        continue
                    if test_ctx is ancestor:
                        common.append(test)
                        continue
                    for test_ancestor in self.ancestry(test_ctx):
                        if test_ancestor is ancestor:
                            common.append(test)
                            found_common = True
                            break
                    if not found_common:
                        remain.append(test)
                if common:
                    suite = self.makeSuite(common, ancestor)
                tail = self.mixedSuites(remain)
        return [suite] + tail

    def wrapTests(self, tests):
        log.debug("wrap %s", tests)
        if callable(tests) or isinstance(tests, unittest.TestSuite):
            log.debug("I won't wrap")
            return tests
        wrapped = []
        for test in tests:
            log.debug("wrapping %s", test)
            if isinstance(test, Test) or isinstance(test, unittest.TestSuite):
                wrapped.append(test)
            elif isinstance(test, ContextList):
                wrapped.append(self.makeSuite(test, context=test.context))
            else:
                wrapped.append(
                    Test(test, config=self.config, resultProxy=self.resultProxy)
                    )
        return wrapped


class ContextList(object):
    """Not quite a suite -- a group of tests in a context. This is used
    to hint the ContextSuiteFactory about what context the tests
    belong to, in cases where it may be ambiguous or missing.
    """
    def __init__(self, tests, context=None):
        self.tests = tests
        self.context = context

    def __iter__(self):
        return iter(self.tests)


class FinalizingSuiteWrapper(unittest.TestSuite):
    """Wraps suite and calls final function after suite has
    executed. Used to call final functions in cases (like running in
    the standard test runner) where test running is not under nose's
    control.
    """
    def __init__(self, suite, finalize):
        super(FinalizingSuiteWrapper, self).__init__()
        self.suite = suite
        self.finalize = finalize

    def __call__(self, *arg, **kw):
        return self.run(*arg, **kw)

    # 2.7 compat
    def __iter__(self):
        return iter(self.suite)

    def run(self, *arg, **kw):
        try:
            return self.suite(*arg, **kw)
        finally:
            self.finalize(*arg, **kw)


# backwards compat -- sort of
class TestDir:
    def __init__(*arg, **kw):
        raise NotImplementedError(
            "TestDir is not usable with nose 0.10. The class is present "
            "in nose.suite for backwards compatibility purposes but it "
            "may not be used.")


class TestModule:
    def __init__(*arg, **kw):
        raise NotImplementedError(
            "TestModule is not usable with nose 0.10. The class is present "
            "in nose.suite for backwards compatibility purposes but it "
            "may not be used.")
