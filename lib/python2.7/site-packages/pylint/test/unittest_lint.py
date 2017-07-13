# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2011-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

from contextlib import contextmanager
import sys
import os
import re
import tempfile
from shutil import rmtree
from os import getcwd, chdir
from os.path import join, basename, dirname, isdir, abspath, sep

import six
from six.moves import reload_module

from pylint import config, lint
from pylint.lint import PyLinter, Run, preprocess_options, ArgumentPreprocessingError
from pylint.utils import MSG_STATE_SCOPE_CONFIG, MSG_STATE_SCOPE_MODULE, MSG_STATE_CONFIDENCE, \
    MessagesStore, MessageDefinition, FileState, tokenize_module
from pylint.exceptions import InvalidMessageError, UnknownMessageError
import pylint.testutils as testutils
from pylint.reporters import text
from pylint import checkers
from pylint.checkers.utils import check_messages
from pylint import interfaces
import pytest

if os.name == 'java':
    if os._name == 'nt':
        HOME = 'USERPROFILE'
    else:
        HOME = 'HOME'
else:
    if sys.platform == 'win32':
        HOME = 'USERPROFILE'
    else:
        HOME = 'HOME'

try:
    PYPY_VERSION_INFO = sys.pypy_version_info
except AttributeError:
    PYPY_VERSION_INFO = None


@contextmanager
def fake_home():
    folder = tempfile.mkdtemp('fake-home')
    old_home = os.environ.get(HOME)
    try:
        os.environ[HOME] = folder
        yield
    finally:
        os.environ.pop('PYLINTRC', '')
        if old_home is None:
            del os.environ[HOME]
        else:
            os.environ[HOME] = old_home
        rmtree(folder, ignore_errors=True)


def remove(file):
    try:
        os.remove(file)
    except OSError:
        pass

HERE = abspath(dirname(__file__))
INPUTDIR = join(HERE, 'input')


@contextmanager
def tempdir():
    """Create a temp directory and change the current location to it.

    This is supposed to be used with a *with* statement.
    """
    tmp = tempfile.mkdtemp()

    # Get real path of tempfile, otherwise test fail on mac os x
    current_dir = getcwd()
    chdir(tmp)
    abs_tmp = abspath('.')

    try:
        yield abs_tmp
    finally:
        chdir(current_dir)
        rmtree(abs_tmp)


def create_files(paths, chroot='.'):
    """Creates directories and files found in <path>.

    :param paths: list of relative paths to files or directories
    :param chroot: the root directory in which paths will be created

    >>> from os.path import isdir, isfile
    >>> isdir('/tmp/a')
    False
    >>> create_files(['a/b/foo.py', 'a/b/c/', 'a/b/c/d/e.py'], '/tmp')
    >>> isdir('/tmp/a')
    True
    >>> isdir('/tmp/a/b/c')
    True
    >>> isfile('/tmp/a/b/c/d/e.py')
    True
    >>> isfile('/tmp/a/b/foo.py')
    True
    """
    dirs, files = set(), set()
    for path in paths:
        path = join(chroot, path)
        filename = basename(path)
        # path is a directory path
        if filename == '':
            dirs.add(path)
        # path is a filename path
        else:
            dirs.add(dirname(path))
            files.add(path)
    for dirpath in dirs:
        if not isdir(dirpath):
            os.makedirs(dirpath)
    for filepath in files:
        open(filepath, 'w').close()


@pytest.fixture
def fake_path():
    orig = list(sys.path)
    fake = [1, 2, 3]
    sys.path[:] = fake
    yield fake
    sys.path[:] = orig


def test_no_args(fake_path):
    with lint.fix_import_path([]):
        assert sys.path == ["."] + fake_path
    assert sys.path == fake_path


@pytest.mark.parametrize("case", [
    ['a/b/'],
    ['a/b'],
    ['a/b/__init__.py'],
    ['a/'],
    ['a'],
])
def test_one_arg(fake_path, case):
    with tempdir() as chroot:
        create_files(['a/b/__init__.py'])
        expected = [join(chroot, 'a')] + ["."] + fake_path

        assert sys.path == fake_path
        with lint.fix_import_path(case):
            assert sys.path == expected
        assert sys.path == fake_path


@pytest.mark.parametrize("case", [
    ['a/b', 'a/c'],
    ['a/c/', 'a/b/'],
    ['a/b/__init__.py', 'a/c/__init__.py'],
    ['a', 'a/c/__init__.py'],
])
def test_two_similar_args(fake_path, case):
    with tempdir() as chroot:
        create_files(['a/b/__init__.py', 'a/c/__init__.py'])
        expected = [join(chroot, 'a')] + ["."] + fake_path

        assert sys.path == fake_path
        with lint.fix_import_path(case):
            assert sys.path == expected
        assert sys.path == fake_path


@pytest.mark.parametrize("case", [
    ['a/b/c/__init__.py', 'a/d/__init__.py', 'a/e/f.py'],
    ['a/b/c', 'a', 'a/e'],
    ['a/b/c', 'a', 'a/b/c', 'a/e', 'a'],
])
def test_more_args(fake_path, case):
    with tempdir() as chroot:
        create_files(['a/b/c/__init__.py', 'a/d/__init__.py', 'a/e/f.py'])
        expected = [
            join(chroot, suffix)
            for suffix in [sep.join(('a', 'b')), 'a', sep.join(('a', 'e'))]
        ] + ["."] + fake_path

        assert sys.path == fake_path
        with lint.fix_import_path(case):
            assert sys.path == expected
        assert sys.path == fake_path


@pytest.fixture(scope='module')
def disable(disable):
    return ['I']


@pytest.fixture(scope='module')
def reporter(reporter):
    return testutils.TestReporter


@pytest.fixture
def init_linter(linter):
    linter.open()
    linter.set_current_module('toto')
    linter.file_state = FileState('toto')
    return linter


def test_pylint_visit_method_taken_in_account(linter):
    class CustomChecker(checkers.BaseChecker):
        __implements__ = interfaces.IAstroidChecker
        name = 'custom'
        msgs = {'W9999': ('', 'custom', '')}

        @check_messages('custom')
        def visit_class(self, _):
            pass

    linter.register_checker(CustomChecker(linter))
    linter.open()
    out = six.moves.StringIO()
    linter.set_reporter(text.TextReporter(out))
    linter.check('abc')


def test_enable_message(init_linter):
    linter = init_linter
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('W0102')
    linter.disable('W0101', scope='package')
    linter.disable('W0102', scope='module', line=1)
    assert not linter.is_message_enabled('W0101')
    assert not linter.is_message_enabled('W0102', 1)
    linter.set_current_module('tutu')
    assert not linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('W0102')
    linter.enable('W0101', scope='package')
    linter.enable('W0102', scope='module', line=1)
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('W0102', 1)


def test_enable_message_category(init_linter):
    linter = init_linter
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('C0202')
    linter.disable('W', scope='package')
    linter.disable('C', scope='module', line=1)
    assert not linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('C0202')
    assert not linter.is_message_enabled('C0202', line=1)
    linter.set_current_module('tutu')
    assert not linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('C0202')
    linter.enable('W', scope='package')
    linter.enable('C', scope='module', line=1)
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('C0202')
    assert linter.is_message_enabled('C0202', line=1)


def test_message_state_scope(init_linter):
    class FakeConfig(object):
        confidence = ['HIGH']

    linter = init_linter
    linter.disable('C0202')
    assert MSG_STATE_SCOPE_CONFIG == linter.get_message_state_scope('C0202')
    linter.disable('W0101', scope='module', line=3)
    assert MSG_STATE_SCOPE_CONFIG == linter.get_message_state_scope('C0202')
    assert MSG_STATE_SCOPE_MODULE == linter.get_message_state_scope('W0101', 3)
    linter.enable('W0102', scope='module', line=3)
    assert MSG_STATE_SCOPE_MODULE == linter.get_message_state_scope('W0102', 3)
    linter.config = FakeConfig()
    assert MSG_STATE_CONFIDENCE == \
        linter.get_message_state_scope('this-is-bad',
                                       confidence=interfaces.INFERENCE)


def test_enable_message_block(init_linter):
    linter = init_linter
    linter.open()
    filepath = join(INPUTDIR, 'func_block_disable_msg.py')
    linter.set_current_module('func_block_disable_msg')
    astroid = linter.get_ast(filepath, 'func_block_disable_msg')
    linter.process_tokens(tokenize_module(astroid))
    fs = linter.file_state
    fs.collect_block_lines(linter.msgs_store, astroid)
    # global (module level)
    assert linter.is_message_enabled('W0613')
    assert linter.is_message_enabled('E1101')
    # meth1
    assert linter.is_message_enabled('W0613', 13)
    # meth2
    assert not linter.is_message_enabled('W0613', 18)
    # meth3
    assert not linter.is_message_enabled('E1101', 24)
    assert linter.is_message_enabled('E1101', 26)
    # meth4
    assert not linter.is_message_enabled('E1101', 32)
    assert linter.is_message_enabled('E1101', 36)
    # meth5
    assert not linter.is_message_enabled('E1101', 42)
    assert not linter.is_message_enabled('E1101', 43)
    assert linter.is_message_enabled('E1101', 46)
    assert not linter.is_message_enabled('E1101', 49)
    assert not linter.is_message_enabled('E1101', 51)
    # meth6
    assert not linter.is_message_enabled('E1101', 57)
    assert linter.is_message_enabled('E1101', 61)
    assert not linter.is_message_enabled('E1101', 64)
    assert not linter.is_message_enabled('E1101', 66)

    assert linter.is_message_enabled('E0602', 57)
    assert linter.is_message_enabled('E0602', 61)
    assert not linter.is_message_enabled('E0602', 62)
    assert linter.is_message_enabled('E0602', 64)
    assert linter.is_message_enabled('E0602', 66)
    # meth7
    assert not linter.is_message_enabled('E1101', 70)
    assert linter.is_message_enabled('E1101', 72)
    assert linter.is_message_enabled('E1101', 75)
    assert linter.is_message_enabled('E1101', 77)

    fs = linter.file_state
    assert 17 == fs._suppression_mapping['W0613', 18]
    assert 30 == fs._suppression_mapping['E1101', 33]
    assert ('E1101', 46) not in fs._suppression_mapping
    assert 1 == fs._suppression_mapping['C0302', 18]
    assert 1 == fs._suppression_mapping['C0302', 50]
    # This is tricky. While the disable in line 106 is disabling
    # both 108 and 110, this is usually not what the user wanted.
    # Therefore, we report the closest previous disable comment.
    assert 106 == fs._suppression_mapping['E1101', 108]
    assert 109 == fs._suppression_mapping['E1101', 110]


def test_enable_by_symbol(init_linter):
    """messages can be controlled by symbolic names.

    The state is consistent across symbols and numbers.
    """
    linter = init_linter
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('unreachable')
    assert linter.is_message_enabled('W0102')
    assert linter.is_message_enabled('dangerous-default-value')
    linter.disable('unreachable', scope='package')
    linter.disable('dangerous-default-value', scope='module', line=1)
    assert not linter.is_message_enabled('W0101')
    assert not linter.is_message_enabled('unreachable')
    assert not linter.is_message_enabled('W0102', 1)
    assert not linter.is_message_enabled('dangerous-default-value', 1)
    linter.set_current_module('tutu')
    assert not linter.is_message_enabled('W0101')
    assert not linter.is_message_enabled('unreachable')
    assert linter.is_message_enabled('W0102')
    assert linter.is_message_enabled('dangerous-default-value')
    linter.enable('unreachable', scope='package')
    linter.enable('dangerous-default-value', scope='module', line=1)
    assert linter.is_message_enabled('W0101')
    assert linter.is_message_enabled('unreachable')
    assert linter.is_message_enabled('W0102', 1)
    assert linter.is_message_enabled('dangerous-default-value', 1)


def test_enable_report(linter):
    assert linter.report_is_enabled('RP0001')
    linter.disable('RP0001')
    assert not linter.report_is_enabled('RP0001')
    linter.enable('RP0001')
    assert linter.report_is_enabled('RP0001')


def test_report_output_format_aliased(linter):
    text.register(linter)
    linter.set_option('output-format', 'text')
    assert linter.reporter.__class__.__name__ == 'TextReporter'


def test_set_option_1(linter):
    linter.set_option('disable', 'C0111,W0234')
    assert not linter.is_message_enabled('C0111')
    assert not linter.is_message_enabled('W0234')
    assert linter.is_message_enabled('W0113')
    assert not linter.is_message_enabled('missing-docstring')
    assert not linter.is_message_enabled('non-iterator-returned')


def test_set_option_2(linter):
    linter.set_option('disable', ('C0111', 'W0234'))
    assert not linter.is_message_enabled('C0111')
    assert not linter.is_message_enabled('W0234')
    assert linter.is_message_enabled('W0113')
    assert not linter.is_message_enabled('missing-docstring')
    assert not linter.is_message_enabled('non-iterator-returned')


def test_enable_checkers(linter):
    linter.disable('design')
    assert not ('design' in [c.name for c in linter.prepare_checkers()])
    linter.enable('design')
    assert 'design' in [c.name for c in linter.prepare_checkers()]


def test_errors_only(linter):
    linter.error_mode()
    checkers = linter.prepare_checkers()
    checker_names = set(c.name for c in checkers)
    should_not = set(('design', 'format', 'metrics',
                      'miscellaneous', 'similarities'))
    assert set() == should_not & checker_names


def test_disable_similar(linter):
    linter.set_option('disable', 'RP0801')
    linter.set_option('disable', 'R0801')
    assert not ('similarities' in [c.name for c in linter.prepare_checkers()])


def test_disable_alot(linter):
    """check that we disabled a lot of checkers"""
    linter.set_option('reports', False)
    linter.set_option('disable', 'R,C,W')
    checker_names = [c.name for c in linter.prepare_checkers()]
    for cname in ('design', 'metrics', 'similarities'):
        assert not (cname in checker_names), cname


def test_addmessage(linter):
    linter.set_reporter(testutils.TestReporter())
    linter.open()
    linter.set_current_module('0123')
    linter.add_message('C0301', line=1, args=(1, 2))
    linter.add_message('line-too-long', line=2, args=(3, 4))
    assert ['C:  1: Line too long (1/2)', 'C:  2: Line too long (3/4)'] == \
        linter.reporter.messages


def test_addmessage_invalid(linter):
    linter.set_reporter(testutils.TestReporter())
    linter.open()
    linter.set_current_module('0123')

    with pytest.raises(InvalidMessageError) as cm:
        linter.add_message('line-too-long', args=(1, 2))
    assert str(cm.value) == "Message C0301 must provide line, got None"

    with pytest.raises(InvalidMessageError) as cm:
        linter.add_message('line-too-long', line=2, node='fake_node', args=(1, 2))
    assert str(cm.value) == "Message C0301 must only provide line, got line=2, node=fake_node"

    with pytest.raises(InvalidMessageError) as cm:
        linter.add_message('C0321')
    assert str(cm.value) == "Message C0321 must provide Node, got None"


def test_init_hooks_called_before_load_plugins():
    with pytest.raises(RuntimeError):
        Run(['--load-plugins', 'unexistant', '--init-hook', 'raise RuntimeError'])
    with pytest.raises(RuntimeError):
        Run(['--init-hook', 'raise RuntimeError', '--load-plugins', 'unexistant'])


def test_analyze_explicit_script(linter):
    linter.set_reporter(testutils.TestReporter())
    linter.check(os.path.join(os.path.dirname(__file__), 'data', 'ascript'))
    assert ['C:  2: Line too long (175/100)'] == linter.reporter.messages


def test_python3_checker_disabled(linter):
    checker_names = [c.name for c in linter.prepare_checkers()]
    assert 'python3' not in checker_names

    linter.set_option('enable', 'python3')
    checker_names = [c.name for c in linter.prepare_checkers()]
    assert 'python3' in checker_names


def test_full_documentation(linter):
    out = six.StringIO()
    linter.print_full_documentation(out)
    output = out.getvalue()
    # A few spot checks only
    for re_str in [
        # autogenerated text
        "^Pylint global options and switches$",
        "Verbatim name of the checker is ``python3``",
        # messages
        "^:old-octal-literal \\(E1608\\):",
        # options
        "^:dummy-variables-rgx:",
    ]:
        regexp = re.compile(re_str, re.MULTILINE)
        assert re.search(regexp, output)


@pytest.fixture
def pop_pylintrc():
    os.environ.pop('PYLINTRC', None)


@pytest.mark.usefixture("pop_pylintrc")
def test_pylint_home():
    uhome = os.path.expanduser('~')
    if uhome == '~':
        expected = '.pylint.d'
    else:
        expected = os.path.join(uhome, '.pylint.d')
    assert config.PYLINT_HOME == expected

    try:
        pylintd = join(tempfile.gettempdir(), '.pylint.d')
        os.environ['PYLINTHOME'] = pylintd
        try:
            reload_module(config)
            assert config.PYLINT_HOME == pylintd
        finally:
            try:
                os.remove(pylintd)
            except:
                pass
    finally:
        del os.environ['PYLINTHOME']


@pytest.mark.skipif(PYPY_VERSION_INFO,
                    reason="TOX runs this test from within the repo and finds "
                    "the project's pylintrc.")
@pytest.mark.usefixture("pop_pylintrc")
def test_pylintrc():
    with fake_home():
        current_dir = getcwd()
        chdir(os.path.dirname(os.path.abspath(sys.executable)))
        try:
            assert config.find_pylintrc() is None
            os.environ['PYLINTRC'] = join(tempfile.gettempdir(),
                                          '.pylintrc')
            assert config.find_pylintrc() is None
            os.environ['PYLINTRC'] = '.'
            assert config.find_pylintrc() is None
        finally:
            chdir(current_dir)
            reload_module(config)


@pytest.mark.usefixture("pop_pylintrc")
def test_pylintrc_parentdir():
    with tempdir() as chroot:

        create_files(['a/pylintrc', 'a/b/__init__.py', 'a/b/pylintrc',
                      'a/b/c/__init__.py', 'a/b/c/d/__init__.py',
                      'a/b/c/d/e/.pylintrc'])
        with fake_home():
            assert config.find_pylintrc() is None
        results = {'a'       : join(chroot, 'a', 'pylintrc'),
                   'a/b'     : join(chroot, 'a', 'b', 'pylintrc'),
                   'a/b/c'   : join(chroot, 'a', 'b', 'pylintrc'),
                   'a/b/c/d' : join(chroot, 'a', 'b', 'pylintrc'),
                   'a/b/c/d/e' : join(chroot, 'a', 'b', 'c', 'd', 'e', '.pylintrc'),
                   }
        for basedir, expected in results.items():
            os.chdir(join(chroot, basedir))
            assert config.find_pylintrc() == expected


@pytest.mark.usefixture("pop_pylintrc")
def test_pylintrc_parentdir_no_package():
    with tempdir() as chroot:
        with fake_home():
            create_files(['a/pylintrc', 'a/b/pylintrc', 'a/b/c/d/__init__.py'])
            assert config.find_pylintrc() is None
            results = {'a'       : join(chroot, 'a', 'pylintrc'),
                       'a/b'     : join(chroot, 'a', 'b', 'pylintrc'),
                       'a/b/c'   : None,
                       'a/b/c/d' : None,
                       }
            for basedir, expected in results.items():
                os.chdir(join(chroot, basedir))
                assert config.find_pylintrc() == expected


class TestPreprocessOptions(object):
    def _callback(self, name, value):
        self.args.append((name, value))

    def test_value_equal(self):
        self.args = []
        preprocess_options(['--foo', '--bar=baz', '--qu=ux'],
                           {'foo': (self._callback, False),
                            'qu': (self._callback, True)})
        assert [('foo', None), ('qu', 'ux')] == self.args

    def test_value_space(self):
        self.args = []
        preprocess_options(['--qu', 'ux'],
                           {'qu': (self._callback, True)})
        assert [('qu', 'ux')] == self.args

    def test_error_missing_expected_value(self):
        with pytest.raises(ArgumentPreprocessingError):
            preprocess_options(['--foo', '--bar', '--qu=ux'],
                               {'bar': (None, True)})
        with pytest.raises(ArgumentPreprocessingError):
            preprocess_options(['--foo', '--bar'],
                               {'bar': (None, True)})

    def test_error_unexpected_value(self):
        with pytest.raises(ArgumentPreprocessingError):
            preprocess_options(['--foo', '--bar=spam', '--qu=ux'],
                               {'bar': (None, False)})


@pytest.fixture
def store():
    store = MessagesStore()

    class Checker(object):
        name = 'achecker'
        msgs = {
            'W1234': ('message', 'msg-symbol', 'msg description.',
                      {'old_names': [('W0001', 'old-symbol')]}),
            'E1234': ('Duplicate keyword argument %r in %s call',
                      'duplicate-keyword-arg',
                      'Used when a function call passes the same keyword argument multiple times.',
                      {'maxversion': (2, 6)}),
            }
    store.register_messages(Checker())
    return store


class TestMessagesStore(object):
    def _compare_messages(self, desc, msg, checkerref=False):
        assert desc == msg.format_help(checkerref=checkerref)

    def test_check_message_id(self, store):
        assert isinstance(store.check_message_id('W1234'), MessageDefinition)
        with pytest.raises(UnknownMessageError):
            store.check_message_id('YB12')

    def test_message_help(self, store):
        msg = store.check_message_id('W1234')
        self._compare_messages(
            ''':msg-symbol (W1234): *message*
  msg description. This message belongs to the achecker checker.''',
            msg, checkerref=True)
        self._compare_messages(
            ''':msg-symbol (W1234): *message*
  msg description.''',
            msg, checkerref=False)

    def test_message_help_minmax(self, store):
        # build the message manually to be python version independent
        msg = store.check_message_id('E1234')
        self._compare_messages(
            ''':duplicate-keyword-arg (E1234): *Duplicate keyword argument %r in %s call*
  Used when a function call passes the same keyword argument multiple times.
  This message belongs to the achecker checker. It can't be emitted when using
  Python >= 2.6.''',
            msg, checkerref=True)
        self._compare_messages(
            ''':duplicate-keyword-arg (E1234): *Duplicate keyword argument %r in %s call*
  Used when a function call passes the same keyword argument multiple times.
  This message can't be emitted when using Python >= 2.6.''',
            msg, checkerref=False)

    def test_list_messages(self, store):
        sys.stdout = six.StringIO()
        try:
            store.list_messages()
            output = sys.stdout.getvalue()
        finally:
            sys.stdout = sys.__stdout__
        # cursory examination of the output: we're mostly testing it completes
        assert ':msg-symbol (W1234): *message*' in output

    def test_add_renamed_message(self, store):
        store.add_renamed_message('W1234', 'old-bad-name', 'msg-symbol')
        assert 'msg-symbol' == store.check_message_id('W1234').symbol
        assert 'msg-symbol' == store.check_message_id('old-bad-name').symbol

    def test_add_renamed_message_invalid(self, store):
        # conflicting message ID
        with pytest.raises(InvalidMessageError) as cm:
            store.add_renamed_message(
                'W1234', 'old-msg-symbol', 'duplicate-keyword-arg')
        assert str(cm.value) == "Message id 'W1234' is already defined"
        # conflicting message symbol
        with pytest.raises(InvalidMessageError) as cm:
            store.add_renamed_message(
                'W1337', 'msg-symbol', 'duplicate-keyword-arg')
        assert str(cm.value) == "Message symbol 'msg-symbol' is already defined"

    def test_renamed_message_register(self, store):
        assert 'msg-symbol' == store.check_message_id('W0001').symbol
        assert 'msg-symbol' == store.check_message_id('old-symbol').symbol


def test_custom_should_analyze_file():
    '''Check that we can write custom should_analyze_file that work
    even for arguments.
    '''

    class CustomPyLinter(PyLinter):
        def should_analyze_file(self, modname, path, is_argument=False):
            if os.path.basename(path) == 'wrong.py':
                return False

            return super(CustomPyLinter, self).should_analyze_file(
                modname, path, is_argument=is_argument)

    package_dir = os.path.join(HERE, 'regrtest_data', 'bad_package')
    wrong_file = os.path.join(package_dir, 'wrong.py')
    reporter = testutils.TestReporter()
    linter = CustomPyLinter()
    linter.config.persistent = 0
    linter.open()
    linter.set_reporter(reporter)

    try:
        sys.path.append(os.path.dirname(package_dir))
        linter.check([package_dir, wrong_file])
    finally:
        sys.path.pop()

    messages = reporter.messages
    assert len(messages) == 1
    assert 'invalid syntax' in messages[0]
