"""
Testing Plugins
===============

The plugin interface is well-tested enough to safely unit test your
use of its hooks with some level of confidence. However, there is also
a mixin for unittest.TestCase called PluginTester that's designed to
test plugins in their native runtime environment.

Here's a simple example with a do-nothing plugin and a composed suite.

    >>> import unittest
    >>> from nose.plugins import Plugin, PluginTester
    >>> class FooPlugin(Plugin):
    ...     pass
    >>> class TestPluginFoo(PluginTester, unittest.TestCase):
    ...     activate = '--with-foo'
    ...     plugins = [FooPlugin()]
    ...     def test_foo(self):
    ...         for line in self.output:
    ...             # i.e. check for patterns
    ...             pass
    ...
    ...         # or check for a line containing ...
    ...         assert "ValueError" in self.output
    ...     def makeSuite(self):
    ...         class TC(unittest.TestCase):
    ...             def runTest(self):
    ...                 raise ValueError("I hate foo")
    ...         return [TC('runTest')]
    ...
    >>> res = unittest.TestResult()
    >>> case = TestPluginFoo('test_foo')
    >>> _ = case(res)
    >>> res.errors
    []
    >>> res.failures
    []
    >>> res.wasSuccessful()
    True
    >>> res.testsRun
    1

And here is a more complex example of testing a plugin that has extra
arguments and reads environment variables.

    >>> import unittest, os
    >>> from nose.plugins import Plugin, PluginTester
    >>> class FancyOutputter(Plugin):
    ...     name = "fancy"
    ...     def configure(self, options, conf):
    ...         Plugin.configure(self, options, conf)
    ...         if not self.enabled:
    ...             return
    ...         self.fanciness = 1
    ...         if options.more_fancy:
    ...             self.fanciness = 2
    ...         if 'EVEN_FANCIER' in self.env:
    ...             self.fanciness = 3
    ...
    ...     def options(self, parser, env=os.environ):
    ...         self.env = env
    ...         parser.add_option('--more-fancy', action='store_true')
    ...         Plugin.options(self, parser, env=env)
    ...
    ...     def report(self, stream):
    ...         stream.write("FANCY " * self.fanciness)
    ...
    >>> class TestFancyOutputter(PluginTester, unittest.TestCase):
    ...     activate = '--with-fancy' # enables the plugin
    ...     plugins = [FancyOutputter()]
    ...     args = ['--more-fancy']
    ...     env = {'EVEN_FANCIER': '1'}
    ...
    ...     def test_fancy_output(self):
    ...         assert "FANCY FANCY FANCY" in self.output, (
    ...                                         "got: %s" % self.output)
    ...     def makeSuite(self):
    ...         class TC(unittest.TestCase):
    ...             def runTest(self):
    ...                 raise ValueError("I hate fancy stuff")
    ...         return [TC('runTest')]
    ...
    >>> res = unittest.TestResult()
    >>> case = TestFancyOutputter('test_fancy_output')
    >>> _ = case(res)
    >>> res.errors
    []
    >>> res.failures
    []
    >>> res.wasSuccessful()
    True
    >>> res.testsRun
    1

"""

import re
import sys
from warnings import warn

try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

__all__ = ['PluginTester', 'run']

from os import getpid
class MultiProcessFile(object):
    """
    helper for testing multiprocessing

    multiprocessing poses a problem for doctests, since the strategy
    of replacing sys.stdout/stderr with file-like objects then
    inspecting the results won't work: the child processes will
    write to the objects, but the data will not be reflected
    in the parent doctest-ing process.

    The solution is to create file-like objects which will interact with
    multiprocessing in a more desirable way.

    All processes can write to this object, but only the creator can read.
    This allows the testing system to see a unified picture of I/O.
    """
    def __init__(self):
        # per advice at:
        #    http://docs.python.org/library/multiprocessing.html#all-platforms
        self.__master = getpid()
        self.__queue = Manager().Queue()
        self.__buffer = StringIO()
        self.softspace = 0

    def buffer(self):
        if getpid() != self.__master:
            return

        from Queue import Empty
        from collections import defaultdict
        cache = defaultdict(str)
        while True:
            try:
                pid, data = self.__queue.get_nowait()
            except Empty:
                break
            if pid == ():
                #show parent output after children
                #this is what users see, usually
                pid = ( 1e100, ) # googol!
            cache[pid] += data
        for pid in sorted(cache):
            #self.__buffer.write( '%s wrote: %r\n' % (pid, cache[pid]) ) #DEBUG
            self.__buffer.write( cache[pid] )
    def write(self, data):
        # note that these pids are in the form of current_process()._identity
        # rather than OS pids
        from multiprocessing import current_process
        pid = current_process()._identity
        self.__queue.put((pid, data))
    def __iter__(self):
        "getattr doesn't work for iter()"
        self.buffer()
        return self.__buffer
    def seek(self, offset, whence=0):
        self.buffer()
        return self.__buffer.seek(offset, whence)
    def getvalue(self):
        self.buffer()
        return self.__buffer.getvalue()
    def __getattr__(self, attr):
        return getattr(self.__buffer, attr)

try:
    from multiprocessing import Manager
    Buffer = MultiProcessFile
except ImportError:
    Buffer = StringIO

class PluginTester(object):
    """A mixin for testing nose plugins in their runtime environment.

    Subclass this and mix in unittest.TestCase to run integration/functional
    tests on your plugin.  When setUp() is called, the stub test suite is
    executed with your plugin so that during an actual test you can inspect the
    artifacts of how your plugin interacted with the stub test suite.

    - activate

      - the argument to send nosetests to activate the plugin

    - suitepath

      - if set, this is the path of the suite to test. Otherwise, you
        will need to use the hook, makeSuite()

    - plugins

      - the list of plugins to make available during the run. Note
        that this does not mean these plugins will be *enabled* during
        the run -- only the plugins enabled by the activate argument
        or other settings in argv or env will be enabled.

    - args

      - a list of arguments to add to the nosetests command, in addition to
        the activate argument

    - env

      - optional dict of environment variables to send nosetests

    """
    activate = None
    suitepath = None
    args = None
    env = {}
    argv = None
    plugins = []
    ignoreFiles = None

    def makeSuite(self):
        """returns a suite object of tests to run (unittest.TestSuite())

        If self.suitepath is None, this must be implemented. The returned suite
        object will be executed with all plugins activated.  It may return
        None.

        Here is an example of a basic suite object you can return ::

            >>> import unittest
            >>> class SomeTest(unittest.TestCase):
            ...     def runTest(self):
            ...         raise ValueError("Now do something, plugin!")
            ...
            >>> unittest.TestSuite([SomeTest()]) # doctest: +ELLIPSIS
            <unittest...TestSuite tests=[<...SomeTest testMethod=runTest>]>

        """
        raise NotImplementedError

    def _execPlugin(self):
        """execute the plugin on the internal test suite.
        """
        from nose.config import Config
        from nose.core import TestProgram
        from nose.plugins.manager import PluginManager

        suite = None
        stream = Buffer()
        conf = Config(env=self.env,
                      stream=stream,
                      plugins=PluginManager(plugins=self.plugins))
        if self.ignoreFiles is not None:
            conf.ignoreFiles = self.ignoreFiles
        if not self.suitepath:
            suite = self.makeSuite()

        self.nose = TestProgram(argv=self.argv, config=conf, suite=suite,
                                exit=False)
        self.output = AccessDecorator(stream)

    def setUp(self):
        """runs nosetests with the specified test suite, all plugins
        activated.
        """
        self.argv = ['nosetests', self.activate]
        if self.args:
            self.argv.extend(self.args)
        if self.suitepath:
            self.argv.append(self.suitepath)

        self._execPlugin()


class AccessDecorator(object):
    stream = None
    _buf = None
    def __init__(self, stream):
        self.stream = stream
        stream.seek(0)
        self._buf = stream.read()
        stream.seek(0)
    def __contains__(self, val):
        return val in self._buf
    def __iter__(self):
        return iter(self.stream)
    def __str__(self):
        return self._buf


def blankline_separated_blocks(text):
    "a bunch of === characters is also considered a blank line"
    block = []
    for line in text.splitlines(True):
        block.append(line)
        line = line.strip()
        if not line or line.startswith('===') and not line.strip('='):
            yield "".join(block)
            block = []
    if block:
        yield "".join(block)


def remove_stack_traces(out):
    # this regexp taken from Python 2.5's doctest
    traceback_re = re.compile(r"""
        # Grab the traceback header.  Different versions of Python have
        # said different things on the first traceback line.
        ^(?P<hdr> Traceback\ \(
            (?: most\ recent\ call\ last
            |   innermost\ last
            ) \) :
        )
        \s* $                   # toss trailing whitespace on the header.
        (?P<stack> .*?)         # don't blink: absorb stuff until...
        ^(?=\w)                 #     a line *starts* with alphanum.
        .*?(?P<exception> \w+ ) # exception name
        (?P<msg> [:\n] .*)      # the rest
        """, re.VERBOSE | re.MULTILINE | re.DOTALL)
    blocks = []
    for block in blankline_separated_blocks(out):
        blocks.append(traceback_re.sub(r"\g<hdr>\n...\n\g<exception>\g<msg>", block))
    return "".join(blocks)


def simplify_warnings(out):
    warn_re = re.compile(r"""
        # Cut the file and line no, up to the warning name
        ^.*:\d+:\s
        (?P<category>\w+): \s+        # warning category
        (?P<detail>.+) $ \n?          # warning message
        ^ .* $                        # stack frame
        """, re.VERBOSE | re.MULTILINE)
    return warn_re.sub(r"\g<category>: \g<detail>", out)


def remove_timings(out):
    return re.sub(
        r"Ran (\d+ tests?) in [0-9.]+s", r"Ran \1 in ...s", out)


def munge_nose_output_for_doctest(out):
    """Modify nose output to make it easy to use in doctests."""
    out = remove_stack_traces(out)
    out = simplify_warnings(out)
    out = remove_timings(out)
    return out.strip()


def run(*arg, **kw):
    """
    Specialized version of nose.run for use inside of doctests that
    test test runs.

    This version of run() prints the result output to stdout.  Before
    printing, the output is processed by replacing the timing
    information with an ellipsis (...), removing traceback stacks, and
    removing trailing whitespace.

    Use this version of run wherever you are writing a doctest that
    tests nose (or unittest) test result output.

    Note: do not use doctest: +ELLIPSIS when testing nose output,
    since ellipses ("test_foo ... ok") in your expected test runner
    output may match multiple lines of output, causing spurious test
    passes!
    """
    from nose import run
    from nose.config import Config
    from nose.plugins.manager import PluginManager

    buffer = Buffer()
    if 'config' not in kw:
        plugins = kw.pop('plugins', [])
        if isinstance(plugins, list):
            plugins = PluginManager(plugins=plugins)
        env = kw.pop('env', {})
        kw['config'] = Config(env=env, plugins=plugins)
    if 'argv' not in kw:
        kw['argv'] = ['nosetests', '-v']
    kw['config'].stream = buffer

    # Set up buffering so that all output goes to our buffer,
    # or warn user if deprecated behavior is active. If this is not
    # done, prints and warnings will either be out of place or
    # disappear.
    stderr = sys.stderr
    stdout = sys.stdout
    if kw.pop('buffer_all', False):
        sys.stdout = sys.stderr = buffer
        restore = True
    else:
        restore = False
        warn("The behavior of nose.plugins.plugintest.run() will change in "
             "the next release of nose. The current behavior does not "
             "correctly account for output to stdout and stderr. To enable "
             "correct behavior, use run_buffered() instead, or pass "
             "the keyword argument buffer_all=True to run().",
             DeprecationWarning, stacklevel=2)
    try:
        run(*arg, **kw)
    finally:
        if restore:
            sys.stderr = stderr
            sys.stdout = stdout
    out = buffer.getvalue()
    print munge_nose_output_for_doctest(out)


def run_buffered(*arg, **kw):
    kw['buffer_all'] = True
    run(*arg, **kw)

if __name__ == '__main__':
    import doctest
    doctest.testmod()
