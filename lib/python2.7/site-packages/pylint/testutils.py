# Copyright (c) 2012-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""functional/non regression tests for pylint"""
from __future__ import print_function

import collections
import contextlib
import functools
from glob import glob
import os
from os import linesep, getcwd, sep
from os.path import abspath, basename, dirname, isdir, join, splitext
import sys
import re
import tempfile
import tokenize

import six
from six.moves import StringIO

import astroid
from pylint import checkers
from pylint.utils import PyLintASTWalker
from pylint.reporters import BaseReporter
from pylint.interfaces import IReporter
from pylint.lint import PyLinter



# Utils

SYS_VERS_STR = '%d%d%d' % sys.version_info[:3]
TITLE_UNDERLINES = ['', '=', '-', '.']
PREFIX = abspath(dirname(__file__))
PY3K = sys.version_info[0] == 3

def fix_path():
    sys.path.insert(0, PREFIX)

def get_tests_info(input_dir, msg_dir, prefix, suffix):
    """get python input examples and output messages

    We use following conventions for input files and messages:
    for different inputs:
        test for python  >= x.y    ->  input   =  <name>_pyxy.py
        test for python  <  x.y    ->  input   =  <name>_py_xy.py
    for one input and different messages:
        message for python >=  x.y ->  message =  <name>_pyxy.txt
        lower versions             ->  message with highest num
    """
    result = []
    for fname in glob(join(input_dir, prefix + '*' + suffix)):
        infile = basename(fname)
        fbase = splitext(infile)[0]
        # filter input files :
        pyrestr = fbase.rsplit('_py', 1)[-1] # like _26 or 26
        if pyrestr.isdigit(): # '24', '25'...
            if SYS_VERS_STR < pyrestr:
                continue
        if pyrestr.startswith('_') and  pyrestr[1:].isdigit():
            # skip test for higher python versions
            if SYS_VERS_STR >= pyrestr[1:]:
                continue
        messages = glob(join(msg_dir, fbase + '*.txt'))
        # the last one will be without ext, i.e. for all or upper versions:
        if messages:
            for outfile in sorted(messages, reverse=True):
                py_rest = outfile.rsplit('_py', 1)[-1][:-4]
                if py_rest.isdigit() and SYS_VERS_STR >= py_rest:
                    break
        else:
            # This will provide an error message indicating the missing filename.
            outfile = join(msg_dir, fbase + '.txt')
        result.append((infile, outfile))
    return result


class TestReporter(BaseReporter):
    """reporter storing plain text messages"""

    __implements__ = IReporter

    def __init__(self): # pylint: disable=super-init-not-called

        self.message_ids = {}
        self.reset()
        self.path_strip_prefix = getcwd() + sep

    def reset(self):
        self.out = StringIO()
        self.messages = []

    def handle_message(self, msg):
        """manage message of different type and in the context of path """
        obj = msg.obj
        line = msg.line
        msg_id = msg.msg_id
        msg = msg.msg
        self.message_ids[msg_id] = 1
        if obj:
            obj = ':%s' % obj
        sigle = msg_id[0]
        if PY3K and linesep != '\n':
            # 2to3 writes os.linesep instead of using
            # the previosly used line separators
            msg = msg.replace('\r\n', '\n')
        self.messages.append('%s:%3s%s: %s' % (sigle, line, obj, msg))

    def finalize(self):
        self.messages.sort()
        for msg in self.messages:
            print(msg, file=self.out)
        result = self.out.getvalue()
        self.reset()
        return result

    # pylint: disable=unused-argument
    def on_set_current_module(self, module, filepath):
        pass
    # pylint: enable=unused-argument

    def display_reports(self, layout):
        """ignore layouts"""

    _display = None


class MinimalTestReporter(BaseReporter):

    def handle_message(self, msg):
        self.messages.append(msg)

    def on_set_current_module(self, module, filepath):
        self.messages = []

    _display = None


class Message(collections.namedtuple('Message',
                                     ['msg_id', 'line', 'node', 'args', 'confidence'])):
    def __new__(cls, msg_id, line=None, node=None, args=None, confidence=None):
        return tuple.__new__(cls, (msg_id, line, node, args, confidence))

    def __eq__(self, other):
        if isinstance(other, Message):
            if self.confidence and other.confidence:
                return super(Message, self).__eq__(other)
            return self[:-1] == other[:-1]
        return NotImplemented  # pragma: no cover

    __hash__ = None


class UnittestLinter(object):
    """A fake linter class to capture checker messages."""
    # pylint: disable=unused-argument, no-self-use

    def __init__(self):
        self._messages = []
        self.stats = {}

    def release_messages(self):
        try:
            return self._messages
        finally:
            self._messages = []

    def add_message(self, msg_id, line=None, node=None, args=None, confidence=None):
        self._messages.append(Message(msg_id, line, node, args, confidence))

    def is_message_enabled(self, *unused_args, **unused_kwargs):
        return True

    def add_stats(self, **kwargs):
        for name, value in six.iteritems(kwargs):
            self.stats[name] = value
        return self.stats

    @property
    def options_providers(self):
        return linter.options_providers

def set_config(**kwargs):
    """Decorator for setting config values on a checker."""
    def _wrapper(fun):
        @functools.wraps(fun)
        def _forward(self):
            for key, value in six.iteritems(kwargs):
                setattr(self.checker.config, key, value)
            if isinstance(self, CheckerTestCase):
                # reopen checker in case, it may be interested in configuration change
                self.checker.open()
            fun(self)

        return _forward
    return _wrapper


class CheckerTestCase(object):
    """A base testcase class for unit testing individual checker classes."""
    CHECKER_CLASS = None
    CONFIG = {}

    def setup_method(self):
        self.linter = UnittestLinter()
        self.checker = self.CHECKER_CLASS(self.linter) # pylint: disable=not-callable
        for key, value in six.iteritems(self.CONFIG):
            setattr(self.checker.config, key, value)
        self.checker.open()

    @contextlib.contextmanager
    def assertNoMessages(self):
        """Assert that no messages are added by the given method."""
        with self.assertAddsMessages():
            yield

    @contextlib.contextmanager
    def assertAddsMessages(self, *messages):
        """Assert that exactly the given method adds the given messages.

        The list of messages must exactly match *all* the messages added by the
        method. Additionally, we check to see whether the args in each message can
        actually be substituted into the message string.
        """
        yield
        got = self.linter.release_messages()
        msg = ('Expected messages did not match actual.\n'
               'Expected:\n%s\nGot:\n%s' % ('\n'.join(repr(m) for m in messages),
                                            '\n'.join(repr(m) for m in got)))
        assert list(messages) == got, msg

    def walk(self, node):
        """recursive walk on the given node"""
        walker = PyLintASTWalker(linter)
        walker.add_checker(self.checker)
        walker.walk(node)


# Init
test_reporter = TestReporter()
linter = PyLinter()
linter.set_reporter(test_reporter)
linter.config.persistent = 0
checkers.initialize(linter)

if linesep != '\n':
    LINE_RGX = re.compile(linesep)
    def ulines(string):
        return LINE_RGX.sub('\n', string)
else:
    def ulines(string):
        return string

INFO_TEST_RGX = re.compile(r'^func_i\d\d\d\d$')

def exception_str(self, ex): # pylint: disable=unused-argument
    """function used to replace default __str__ method of exception instances"""
    return 'in %s\n:: %s' % (ex.file, ', '.join(ex.args))

# Test classes

class LintTestUsingModule(object):
    INPUT_DIR = None
    DEFAULT_PACKAGE = 'input'
    package = DEFAULT_PACKAGE
    linter = linter
    module = None
    depends = None
    output = None
    _TEST_TYPE = 'module'

    # def runTest(self):
    #     # This is a hack to make ./test/test_func.py work under pytest.
    #     pass

    def _test_functionality(self):
        tocheck = [self.package+'.'+self.module]
        # pylint: disable=not-an-iterable; can't handle boolean checks for now
        if self.depends:
            tocheck += [self.package+'.%s' % name.replace('.py', '')
                        for name, _ in self.depends]
        self._test(tocheck)

    def _check_result(self, got):
        assert self._get_expected().strip()+'\n' == got.strip()+'\n'

    def _test(self, tocheck):
        if INFO_TEST_RGX.match(self.module):
            self.linter.enable('I')
        else:
            self.linter.disable('I')
        try:
            self.linter.check(tocheck)
        except Exception as ex:
            # need finalization to restore a correct state
            self.linter.reporter.finalize()
            ex.file = tocheck
            print(ex)
            ex.__str__ = exception_str
            raise
        self._check_result(self.linter.reporter.finalize())

    def _has_output(self):
        return not self.module.startswith('func_noerror_')

    def _get_expected(self):
        if self._has_output() and self.output:
            with open(self.output, 'U') as fobj:
                return fobj.read().strip() + '\n'
        else:
            return ''

class LintTestUsingFile(LintTestUsingModule):

    _TEST_TYPE = 'file'

    def _test_functionality(self):
        importable = join(self.INPUT_DIR, self.module)
        # python also prefers packages over simple modules.
        if not isdir(importable):
            importable += '.py'
        tocheck = [importable]
        # pylint: disable=not-an-iterable; can't handle boolean checks for now
        if self.depends:
            tocheck += [join(self.INPUT_DIR, name) for name, _ in self.depends]
        self._test(tocheck)

class LintTestUpdate(LintTestUsingModule):

    _TEST_TYPE = 'update'

    def _check_result(self, got):
        if self._has_output():
            try:
                expected = self._get_expected()
            except IOError:
                expected = ''
            if got != expected:
                with open(self.output, 'w') as fobj:
                    fobj.write(got)


def tokenize_str(code):
    return list(tokenize.generate_tokens(StringIO(code).readline))


@contextlib.contextmanager
def create_tempfile(content=None):
    """Create a new temporary file.

    If *content* parameter is given, then it will be written
    in the temporary file, before passing it back.
    This is a context manager and should be used with a *with* statement.
    """
    # Can't use tempfile.NamedTemporaryFile here
    # because on Windows the file must be closed before writing to it,
    # see http://bugs.python.org/issue14243
    file_handle, tmp = tempfile.mkstemp()
    if content:
        if sys.version_info >= (3, 0):
            # erff
            os.write(file_handle, bytes(content, 'ascii'))
        else:
            os.write(file_handle, content)
    try:
        yield tmp
    finally:
        os.close(file_handle)
        os.remove(tmp)

@contextlib.contextmanager
def create_file_backed_module(code):
    """Create an astroid module for the given code, backed by a real file."""
    with create_tempfile() as temp:
        module = astroid.parse(code)
        module.file = temp
        yield module
