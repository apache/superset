# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import contextlib
import json
import re
import sys
import os
from os.path import join, dirname, abspath
import tempfile
import textwrap

import six

from pylint.lint import Run
from pylint.reporters import BaseReporter
from pylint.reporters.text import *
from pylint.reporters.json import JSONReporter
import pytest

HERE = abspath(dirname(__file__))



@contextlib.contextmanager
def _patch_streams(out):
    sys.stderr = sys.stdout = out
    try:
        yield
    finally:
        sys.stderr = sys.__stderr__
        sys.stdout = sys.__stdout__


@contextlib.contextmanager
def _configure_lc_ctype(lc_ctype):
    lc_ctype_env = 'LC_CTYPE'
    original_lctype = os.environ.get(lc_ctype_env)
    os.environ[lc_ctype_env] = lc_ctype
    try:
        yield
    finally:
        os.environ.pop(lc_ctype_env)
        if original_lctype:
            os.environ[lc_ctype_env] = original_lctype


class MultiReporter(BaseReporter):
    def __init__(self, reporters):
        self._reporters = reporters
        self.path_strip_prefix = os.getcwd() + os.sep

    def on_set_current_module(self, *args, **kwargs):
        for rep in self._reporters:
            rep.on_set_current_module(*args, **kwargs)

    def handle_message(self, msg):
        for rep in self._reporters:
            rep.handle_message(msg)

    def display_reports(self, layout):
        pass

    @property
    def out(self):
        return self._reporters[0].out

    @property
    def linter(self):
        return self._linter

    @linter.setter
    def linter(self, value):
        self._linter = value
        for rep in self._reporters:
            rep.linter = value


class TestRunTC(object):

    def _runtest(self, args, reporter=None, out=None, code=28):
        if out is None:
            out = six.StringIO()
        pylint_code = self._run_pylint(args, reporter=reporter, out=out)
        if reporter:
            output = reporter.out.getvalue()
        elif hasattr(out, 'getvalue'):
            output = out.getvalue()
        else:
            output = None
        msg = 'expected output status %s, got %s' % (code, pylint_code)
        if output is not None:
            msg = '%s. Below pylint output: \n%s' % (msg, output)
        assert pylint_code == code, msg

    def _run_pylint(self, args, out, reporter=None):
        args = args + ['--persistent=no']
        with _patch_streams(out):
            with pytest.raises(SystemExit) as cm:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    Run(args, reporter=reporter)
            return cm.value.code

    def _test_output(self, args, expected_output):
        out = six.StringIO()
        self._run_pylint(args, out=out)
        actual_output = out.getvalue()
        assert expected_output.strip() in actual_output.strip()

    def test_pkginfo(self):
        """Make pylint check itself."""
        self._runtest(['pylint.__pkginfo__'], reporter=TextReporter(six.StringIO()),
                      code=0)

    def test_all(self):
        """Make pylint check itself."""
        reporters = [
            TextReporter(six.StringIO()),
            ColorizedTextReporter(six.StringIO()),
            JSONReporter(six.StringIO())
        ]
        self._runtest(['pylint/test/functional/arguments.py'],
                      reporter=MultiReporter(reporters), code=1)

    def test_no_ext_file(self):
        self._runtest([join(HERE, 'input', 'noext')], code=0)

    def test_w0704_ignored(self):
        self._runtest([join(HERE, 'input', 'ignore_except_pass_by_default.py')], code=0)

    def test_generate_config_option(self):
        self._runtest(['--generate-rcfile'], code=0)

    def test_generate_config_option_order(self):
        out1 = six.StringIO()
        out2 = six.StringIO()
        self._runtest(['--generate-rcfile'], code=0, out=out1)
        self._runtest(['--generate-rcfile'], code=0, out=out2)
        output1 = out1.getvalue()
        output2 = out2.getvalue()
        assert output1 == output2

    def test_generate_config_disable_symbolic_names(self):
        # Test that --generate-rcfile puts symbolic names in the --disable
        # option.

        out = six.StringIO()
        self._run_pylint(["--generate-rcfile", "--rcfile="], out=out)

        output = out.getvalue()
        # Get rid of the pesky messages that pylint emits if the
        # configuration file is not found.
        master = re.search(r"\[MASTER", output)
        out = six.StringIO(output[master.start():])
        parser = six.moves.configparser.RawConfigParser()
        parser.readfp(out)
        messages = parser.get('MESSAGES CONTROL', 'disable').split(",")
        assert 'suppressed-message' in messages

    def test_generate_rcfile_no_obsolete_methods(self):
        out = six.StringIO()
        self._run_pylint(["--generate-rcfile"], out=out)
        output = out.getvalue()
        assert "profile" not in output

    def test_help_message_option(self):
        self._runtest(['--help-msg', 'W0101'], code=0)

    def test_error_help_message_option(self):
        self._runtest(['--help-msg', 'WX101'], code=0)

    def test_error_missing_arguments(self):
        self._runtest([], code=32)

    def test_no_out_encoding(self):
        """test redirection of stdout with non ascii caracters
        """
        #This test reproduces bug #48066 ; it happens when stdout is redirected
        # through '>' : the sys.stdout.encoding becomes then None, and if the
        # output contains non ascii, pylint will crash
        if sys.version_info < (3, 0):
            strio = tempfile.TemporaryFile()
        else:
            strio = six.StringIO()
        assert strio.encoding is None
        self._runtest([join(HERE, 'regrtest_data/no_stdout_encoding.py'),
                       '--enable=all'],
                      out=strio, code=28)

    def test_parallel_execution(self):
        self._runtest(['-j 2', 'pylint/test/functional/arguments.py',
                       'pylint/test/functional/bad_continuation.py'], code=1)

    def test_parallel_execution_missing_arguments(self):
        self._runtest(['-j 2', 'not_here', 'not_here_too'], code=1)

    def test_py3k_option(self):
        # Test that --py3k flag works.
        rc_code = 2 if six.PY2 else 0
        self._runtest([join(HERE, 'functional', 'unpacked_exceptions.py'),
                       '--py3k'],
                      code=rc_code)

    def test_py3k_jobs_option(self):
        rc_code = 2 if six.PY2 else 0
        self._runtest([join(HERE, 'functional', 'unpacked_exceptions.py'),
                       '--py3k', '-j 2'],
                      code=rc_code)

    @pytest.mark.skipif(sys.version_info[0] > 2, reason="Requires the --py3k flag.")
    def test_py3k_commutative_with_errors_only(self):

        # Test what gets emitted with -E only
        module = join(HERE, 'regrtest_data', 'py3k_error_flag.py')
        expected = textwrap.dedent("""
        ************* Module py3k_error_flag
        Explicit return in __init__
        """)
        self._test_output([module, "-E", "--msg-template='{msg}'"],
                          expected_output=expected)

        # Test what gets emitted with -E --py3k
        expected = textwrap.dedent("""
        ************* Module py3k_error_flag
        Use raise ErrorClass(args) instead of raise ErrorClass, args.
        """)
        self._test_output([module, "-E", "--py3k", "--msg-template='{msg}'"],
                          expected_output=expected)

        # Test what gets emitted with --py3k -E
        self._test_output([module, "--py3k", "-E", "--msg-template='{msg}'"],
                          expected_output=expected)

    def test_abbreviations_are_not_supported(self):
        expected = "no such option: --load-plugin"
        self._test_output([".", "--load-plugin"], expected_output=expected)

    def test_enable_all_works(self):
        module = join(HERE, 'data', 'clientmodule_test.py')
        expected = textwrap.dedent("""
        ************* Module data.clientmodule_test
        W: 10, 8: Unused variable 'local_variable' (unused-variable)
        C: 18, 4: Missing method docstring (missing-docstring)
        C: 22, 0: Missing class docstring (missing-docstring)
        """)
        self._test_output([module, "--disable=all", "--enable=all", "-rn"],
                          expected_output=expected)

    def test_wrong_import_position_when_others_disabled(self):
        expected_output = textwrap.dedent('''
        ************* Module wrong_import_position
        C: 11, 0: Import "import os" should be placed at the top of the module (wrong-import-position)
        ''')
        module1 = join(HERE, 'regrtest_data', 'import_something.py')
        module2 = join(HERE, 'regrtest_data', 'wrong_import_position.py')
        args = [module2, module1,
                "--disable=all", "--enable=wrong-import-position",
                "-rn", "-sn"]
        out = six.StringIO()
        self._run_pylint(args, out=out)
        actual_output = out.getvalue().strip()

        to_remove = "No config file found, using default configuration"
        if to_remove in actual_output:
            actual_output = actual_output[len(to_remove):]
        assert expected_output.strip() == actual_output.strip()

    def test_import_itself_not_accounted_for_relative_imports(self):
        expected = 'Your code has been rated at 10.00/10'
        package = join(HERE, 'regrtest_data', 'dummy')
        self._test_output([package, '--disable=locally-disabled', '-rn'],
                          expected_output=expected)

    def test_reject_empty_indent_strings(self):
        expected = "indent string can't be empty"
        module = join(HERE, 'data', 'clientmodule_test.py')
        self._test_output([module, '--indent-string='],
                          expected_output=expected)

    def test_json_report_when_file_has_syntax_error(self):
        out = six.StringIO()
        module = join(HERE, 'regrtest_data', 'syntax_error.py')
        self._runtest([module], code=2, reporter=JSONReporter(out))
        output = json.loads(out.getvalue())
        assert isinstance(output, list)
        assert len(output) == 1
        assert isinstance(output[0], dict)
        expected = {
            "obj": "",
            "column": 0,
            "line": 1,
            "type": "error",
            "symbol": "syntax-error",
            "module": "syntax_error"
        }
        message = output[0]
        for key, value in expected.items():
            assert key in message
            assert message[key] == value
        assert 'invalid syntax' in message['message'].lower()

    def test_json_report_when_file_is_missing(self):
        out = six.StringIO()
        module = join(HERE, 'regrtest_data', 'totally_missing.py')
        self._runtest([module], code=1, reporter=JSONReporter(out))
        output = json.loads(out.getvalue())
        assert isinstance(output, list)
        assert len(output) == 1
        assert isinstance(output[0], dict)
        expected = {
            "obj": "",
            "column": 0,
            "line": 1,
            "type": "fatal",
            "symbol": "fatal",
            "module": module
        }
        message = output[0]
        for key, value in expected.items():
            assert key in message
            assert message[key] == value
        assert message['message'].startswith("No module named")

    def test_information_category_disabled_by_default(self):
        expected = 'Your code has been rated at 10.00/10'
        path = join(HERE, 'regrtest_data', 'meta.py')
        self._test_output([path], expected_output=expected)

    def test_error_mode_shows_no_score(self):
        expected_output = textwrap.dedent('''
        ************* Module application_crash
        E:  1, 6: Undefined variable 'something_undefined' (undefined-variable)
        ''')
        module = join(HERE, 'regrtest_data', 'application_crash.py')
        self._test_output([module, "-E"], expected_output=expected_output)

    def test_evaluation_score_shown_by_default(self):
        expected_output = 'Your code has been rated at '
        module = join(HERE, 'regrtest_data', 'application_crash.py')
        self._test_output([module], expected_output=expected_output)

    def test_confidence_levels(self):
        expected = 'Your code has been rated at'
        path = join(HERE, 'regrtest_data', 'meta.py')
        self._test_output([path, "--confidence=HIGH,INFERENCE"],
                          expected_output=expected)

    def test_bom_marker(self):
        path = join(HERE, 'regrtest_data', 'meta.py')
        config_path = join(HERE, 'regrtest_data', '.pylintrc')
        expected = 'Your code has been rated at 10.00/10'
        self._test_output([path, "--rcfile=%s" % config_path, "-rn"],
                          expected_output=expected)

    def test_pylintrc_plugin_duplicate_options(self):
        dummy_plugin_path = join(HERE, 'regrtest_data', 'dummy_plugin')
        # Enable --load-plugins=dummy_plugin
        sys.path.append(dummy_plugin_path)
        config_path = join(HERE, 'regrtest_data', 'dummy_plugin.rc')
        expected = (
            ":dummy-message-01 (I9061): *Dummy short desc 01*\n"
            "  Dummy long desc This message belongs to the dummy_plugin checker.\n\n"
            ":dummy-message-02 (I9060): *Dummy short desc 02*\n"
            "  Dummy long desc This message belongs to the dummy_plugin checker.")
        self._test_output(["--rcfile=%s" % config_path,
                           "--help-msg=dummy-message-01,dummy-message-02"],
                          expected_output=expected)
        expected = (
            "[DUMMY_PLUGIN]\n\n# Dummy option 1\ndummy_option_1=dummy value 1\n\n"
            "# Dummy option 2\ndummy_option_2=dummy value 2")
        self._test_output(["--rcfile=%s" % config_path, "--generate-rcfile"],
                          expected_output=expected)
        sys.path.remove(dummy_plugin_path)

    def test_pylintrc_comments_in_values(self):
        path = join(HERE, 'regrtest_data', 'test_pylintrc_comments.py')
        config_path = join(HERE, 'regrtest_data', 'comments_pylintrc')
        expected = textwrap.dedent('''
        ************* Module test_pylintrc_comments
        W:  2, 0: Bad indentation. Found 1 spaces, expected 4 (bad-indentation)
        C:  1, 0: Missing module docstring (missing-docstring)
        C:  1, 0: Missing function docstring (missing-docstring)
        ''')
        self._test_output([path, "--rcfile=%s" % config_path, "-rn"],
                          expected_output=expected)

    def test_no_crash_with_formatting_regex_defaults(self):
        self._runtest(["--ignore-patterns=a"], reporter=TextReporter(six.StringIO()),
                      code=32)

    def test_getdefaultencoding_crashes_with_lc_ctype_utf8(self):
        expected_output = textwrap.dedent('''
        ************* Module application_crash
        E:  1, 6: Undefined variable 'something_undefined' (undefined-variable)
        ''')
        module = join(HERE, 'regrtest_data', 'application_crash.py')
        with _configure_lc_ctype('UTF-8'):
            self._test_output([module, '-E'], expected_output=expected_output)
