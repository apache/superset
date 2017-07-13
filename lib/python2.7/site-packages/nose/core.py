"""Implements nose test program and collector.
"""
from __future__ import generators

import logging
import os
import sys
import time
import unittest

from nose.config import Config, all_config_files
from nose.loader import defaultTestLoader
from nose.plugins.manager import PluginManager, DefaultPluginManager, \
     RestrictedPluginManager
from nose.result import TextTestResult
from nose.suite import FinalizingSuiteWrapper
from nose.util import isclass, tolist


log = logging.getLogger('nose.core')
compat_24 = sys.version_info >= (2, 4)

__all__ = ['TestProgram', 'main', 'run', 'run_exit', 'runmodule', 'collector',
           'TextTestRunner']


class TextTestRunner(unittest.TextTestRunner):
    """Test runner that uses nose's TextTestResult to enable errorClasses,
    as well as providing hooks for plugins to override or replace the test
    output stream, results, and the test case itself.
    """
    def __init__(self, stream=sys.stderr, descriptions=1, verbosity=1,
                 config=None):
        if config is None:
            config = Config()
        self.config = config
        unittest.TextTestRunner.__init__(self, stream, descriptions, verbosity)


    def _makeResult(self):
        return TextTestResult(self.stream,
                              self.descriptions,
                              self.verbosity,
                              self.config)

    def run(self, test):
        """Overrides to provide plugin hooks and defer all output to
        the test result class.
        """
        wrapper = self.config.plugins.prepareTest(test)
        if wrapper is not None:
            test = wrapper

        # plugins can decorate or capture the output stream
        wrapped = self.config.plugins.setOutputStream(self.stream)
        if wrapped is not None:
            self.stream = wrapped

        result = self._makeResult()
        start = time.time()
        try:
            test(result)
        except KeyboardInterrupt:
            pass
        stop = time.time()
        result.printErrors()
        result.printSummary(start, stop)
        self.config.plugins.finalize(result)
        return result


class TestProgram(unittest.TestProgram):
    """Collect and run tests, returning success or failure.

    The arguments to TestProgram() are the same as to
    :func:`main()` and :func:`run()`:

    * module: All tests are in this module (default: None)
    * defaultTest: Tests to load (default: '.')
    * argv: Command line arguments (default: None; sys.argv is read)
    * testRunner: Test runner instance (default: None)
    * testLoader: Test loader instance (default: None)
    * env: Environment; ignored if config is provided (default: None;
      os.environ is read)
    * config: :class:`nose.config.Config` instance (default: None)
    * suite: Suite or list of tests to run (default: None). Passing a
      suite or lists of tests will bypass all test discovery and
      loading. *ALSO NOTE* that if you pass a unittest.TestSuite
      instance as the suite, context fixtures at the class, module and
      package level will not be used, and many plugin hooks will not
      be called. If you want normal nose behavior, either pass a list
      of tests, or a fully-configured :class:`nose.suite.ContextSuite`.
    * exit: Exit after running tests and printing report (default: True)
    * plugins: List of plugins to use; ignored if config is provided
      (default: load plugins with DefaultPluginManager)
    * addplugins: List of **extra** plugins to use. Pass a list of plugin
      instances in this argument to make custom plugins available while
      still using the DefaultPluginManager.
    """
    verbosity = 1

    def __init__(self, module=None, defaultTest='.', argv=None,
                 testRunner=None, testLoader=None, env=None, config=None,
                 suite=None, exit=True, plugins=None, addplugins=None):
        if env is None:
            env = os.environ
        if config is None:
            config = self.makeConfig(env, plugins)
        if addplugins:
            config.plugins.addPlugins(extraplugins=addplugins)
        self.config = config
        self.suite = suite
        self.exit = exit
        extra_args = {}
        version = sys.version_info[0:2]
        if version >= (2,7) and version != (3,0):
            extra_args['exit'] = exit
        unittest.TestProgram.__init__(
            self, module=module, defaultTest=defaultTest,
            argv=argv, testRunner=testRunner, testLoader=testLoader,
            **extra_args)

    def getAllConfigFiles(self, env=None):
        env = env or {}
        if env.get('NOSE_IGNORE_CONFIG_FILES', False):
            return []
        else:
            return all_config_files()

    def makeConfig(self, env, plugins=None):
        """Load a Config, pre-filled with user config files if any are
        found.
        """
        cfg_files = self.getAllConfigFiles(env)
        if plugins:
            manager = PluginManager(plugins=plugins)
        else:
            manager = DefaultPluginManager()
        return Config(
            env=env, files=cfg_files, plugins=manager)

    def parseArgs(self, argv):
        """Parse argv and env and configure running environment.
        """
        self.config.configure(argv, doc=self.usage())
        log.debug("configured %s", self.config)

        # quick outs: version, plugins (optparse would have already
        # caught and exited on help)
        if self.config.options.version:
            from nose import __version__
            sys.stdout = sys.__stdout__
            print "%s version %s" % (os.path.basename(sys.argv[0]), __version__)
            sys.exit(0)

        if self.config.options.showPlugins:
            self.showPlugins()
            sys.exit(0)

        if self.testLoader is None:
            self.testLoader = defaultTestLoader(config=self.config)
        elif isclass(self.testLoader):
            self.testLoader = self.testLoader(config=self.config)
        plug_loader = self.config.plugins.prepareTestLoader(self.testLoader)
        if plug_loader is not None:
            self.testLoader = plug_loader
        log.debug("test loader is %s", self.testLoader)

        # FIXME if self.module is a string, add it to self.testNames? not sure

        if self.config.testNames:
            self.testNames = self.config.testNames
        else:
            self.testNames = tolist(self.defaultTest)
        log.debug('defaultTest %s', self.defaultTest)
        log.debug('Test names are %s', self.testNames)
        if self.config.workingDir is not None:
            os.chdir(self.config.workingDir)
        self.createTests()

    def createTests(self):
        """Create the tests to run. If a self.suite
        is set, then that suite will be used. Otherwise, tests will be
        loaded from the given test names (self.testNames) using the
        test loader.
        """
        log.debug("createTests called with %s", self.suite)
        if self.suite is not None:
            # We were given an explicit suite to run. Make sure it's
            # loaded and wrapped correctly.
            self.test = self.testLoader.suiteClass(self.suite)
        else:
            self.test = self.testLoader.loadTestsFromNames(self.testNames)

    def runTests(self):
        """Run Tests. Returns true on success, false on failure, and sets
        self.success to the same value.
        """
        log.debug("runTests called")
        if self.testRunner is None:
            self.testRunner = TextTestRunner(stream=self.config.stream,
                                             verbosity=self.config.verbosity,
                                             config=self.config)
        plug_runner = self.config.plugins.prepareTestRunner(self.testRunner)
        if plug_runner is not None:
            self.testRunner = plug_runner
        result = self.testRunner.run(self.test)
        self.success = result.wasSuccessful()
        if self.exit:
            sys.exit(not self.success)
        return self.success

    def showPlugins(self):
        """Print list of available plugins.
        """
        import textwrap

        class DummyParser:
            def __init__(self):
                self.options = []
            def add_option(self, *arg, **kw):
                self.options.append((arg, kw.pop('help', '')))

        v = self.config.verbosity
        self.config.plugins.sort()
        for p in self.config.plugins:
            print "Plugin %s" % p.name
            if v >= 2:
                print "  score: %s" % p.score
                print '\n'.join(textwrap.wrap(p.help().strip(),
                                              initial_indent='  ',
                                              subsequent_indent='  '))
                if v >= 3:
                    parser = DummyParser()
                    p.addOptions(parser)
                    if len(parser.options):
                        print
                        print "  Options:"
                        for opts, help in parser.options:
                            print '  %s' % (', '.join(opts))
                            if help:
                                print '\n'.join(
                                    textwrap.wrap(help.strip(),
                                                  initial_indent='    ',
                                                  subsequent_indent='    '))
                print

    def usage(cls):
        import nose
        try:
            ld = nose.__loader__
            text = ld.get_data(os.path.join(
                os.path.dirname(__file__), 'usage.txt'))
        except AttributeError:
            f = open(os.path.join(
                os.path.dirname(__file__), 'usage.txt'), 'r')
            try:
                text = f.read()
            finally:
                f.close()
        # Ensure that we return str, not bytes.
        if not isinstance(text, str):
            text = text.decode('utf-8')
        return text
    usage = classmethod(usage)

# backwards compatibility
run_exit = main = TestProgram


def run(*arg, **kw):
    """Collect and run tests, returning success or failure.

    The arguments to `run()` are the same as to `main()`:

    * module: All tests are in this module (default: None)
    * defaultTest: Tests to load (default: '.')
    * argv: Command line arguments (default: None; sys.argv is read)
    * testRunner: Test runner instance (default: None)
    * testLoader: Test loader instance (default: None)
    * env: Environment; ignored if config is provided (default: None;
      os.environ is read)
    * config: :class:`nose.config.Config` instance (default: None)
    * suite: Suite or list of tests to run (default: None). Passing a
      suite or lists of tests will bypass all test discovery and
      loading. *ALSO NOTE* that if you pass a unittest.TestSuite
      instance as the suite, context fixtures at the class, module and
      package level will not be used, and many plugin hooks will not
      be called. If you want normal nose behavior, either pass a list
      of tests, or a fully-configured :class:`nose.suite.ContextSuite`.
    * plugins: List of plugins to use; ignored if config is provided
      (default: load plugins with DefaultPluginManager)
    * addplugins: List of **extra** plugins to use. Pass a list of plugin
      instances in this argument to make custom plugins available while
      still using the DefaultPluginManager.

    With the exception that the ``exit`` argument is always set
    to False.
    """
    kw['exit'] = False
    return TestProgram(*arg, **kw).success


def runmodule(name='__main__', **kw):
    """Collect and run tests in a single module only. Defaults to running
    tests in __main__. Additional arguments to TestProgram may be passed
    as keyword arguments.
    """
    main(defaultTest=name, **kw)


def collector():
    """TestSuite replacement entry point. Use anywhere you might use a
    unittest.TestSuite. The collector will, by default, load options from
    all config files and execute loader.loadTestsFromNames() on the
    configured testNames, or '.' if no testNames are configured.
    """
    # plugins that implement any of these methods are disabled, since
    # we don't control the test runner and won't be able to run them
    # finalize() is also not called, but plugins that use it aren't disabled,
    # because capture needs it.
    setuptools_incompat = ('report', 'prepareTest',
                           'prepareTestLoader', 'prepareTestRunner',
                           'setOutputStream')

    plugins = RestrictedPluginManager(exclude=setuptools_incompat)
    conf = Config(files=all_config_files(),
                  plugins=plugins)
    conf.configure(argv=['collector'])
    loader = defaultTestLoader(conf)

    if conf.testNames:
        suite = loader.loadTestsFromNames(conf.testNames)
    else:
        suite = loader.loadTestsFromNames(('.',))
    return FinalizingSuiteWrapper(suite, plugins.finalize)



if __name__ == '__main__':
    main()
