# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unit tests for the variables checker."""
import sys
import os

import astroid

from pylint.checkers import variables
from pylint.testutils import CheckerTestCase, linter, set_config, Message

class TestVariablesChecker(CheckerTestCase):

    CHECKER_CLASS = variables.VariablesChecker

    def test_bitbucket_issue_78(self):
        """ Issue 78 report a false positive for unused-module """
        module = astroid.parse("""
        from sys import path
        path += ['stuff']
        def func():
            other = 1
            return len(other)
        """)
        with self.assertNoMessages():
            self.walk(module)

    @set_config(ignored_modules=('argparse',))
    def test_no_name_in_module_skipped(self):
        """Make sure that 'from ... import ...' does not emit a
        'no-name-in-module' with a module that is configured
        to be ignored.
        """

        node = astroid.extract_node("""
        from argparse import THIS_does_not_EXIST
        """)
        with self.assertNoMessages():
            self.checker.visit_importfrom(node)

    def test_all_elements_without_parent(self):
        node = astroid.extract_node('__all__ = []')
        node.value.elts.append(astroid.Const('test'))
        root = node.root()
        with self.assertNoMessages():
            self.checker.visit_module(root)
            self.checker.leave_module(root)

    def test_redefined_builtin_ignored(self):
        node = astroid.parse('''
        from future.builtins import open
        ''')
        with self.assertNoMessages():
            self.checker.visit_module(node)

    @set_config(redefining_builtins_modules=('os',))
    def test_redefined_builtin_custom_modules(self):
        node = astroid.parse('''
        from os import open
        ''')
        with self.assertNoMessages():
            self.checker.visit_module(node)

    @set_config(redefining_builtins_modules=('os',))
    def test_redefined_builtin_modname_not_ignored(self):
        node = astroid.parse('''
        from future.builtins import open
        ''')
        with self.assertAddsMessages(
                Message('redefined-builtin', node=node.body[0], args='open')):
            self.checker.visit_module(node)

    @set_config(redefining_builtins_modules=('os',))
    def test_redefined_builtin_in_function(self):
        node = astroid.extract_node('''
        def test():
            from os import open
        ''')
        with self.assertNoMessages():
            self.checker.visit_module(node.root())
            self.checker.visit_functiondef(node)


class TestVariablesCheckerWithTearDown(CheckerTestCase):

    CHECKER_CLASS = variables.VariablesChecker

    def setup_method(self):
        super(TestVariablesCheckerWithTearDown, self).setup_method()
        self._to_consume_backup = self.checker._to_consume
        self.checker._to_consume = []

    def teardown_method(self, method):
        self.checker._to_consume = self._to_consume_backup

    @set_config(callbacks=('callback_', '_callback'))
    def test_custom_callback_string(self):
        """ Test the --calbacks option works. """
        node = astroid.extract_node("""
        def callback_one(abc):
             ''' should not emit unused-argument. '''
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)
            self.checker.leave_functiondef(node)

        node = astroid.extract_node("""
        def two_callback(abc, defg):
             ''' should not emit unused-argument. '''
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)
            self.checker.leave_functiondef(node)

        node = astroid.extract_node("""
        def normal_func(abc):
             ''' should emit unused-argument. '''
        """)
        with self.assertAddsMessages(
                Message('unused-argument', node=node['abc'], args='abc')):
            self.checker.visit_functiondef(node)
            self.checker.leave_functiondef(node)

        node = astroid.extract_node("""
        def cb_func(abc):
             ''' Previous callbacks are overridden. '''
        """)
        with self.assertAddsMessages(
                Message('unused-argument', node=node['abc'], args='abc')):
            self.checker.visit_functiondef(node)
            self.checker.leave_functiondef(node)

    @set_config(redefining_builtins_modules=('os',))
    def test_redefined_builtin_modname_not_ignored(self):
        node = astroid.parse('''
        from future.builtins import open
        ''')
        with self.assertAddsMessages(
                Message('redefined-builtin', node=node.body[0], args='open')):
            self.checker.visit_module(node)

    @set_config(redefining_builtins_modules=('os',))
    def test_redefined_builtin_in_function(self):
        node = astroid.extract_node('''
        def test():
            from os import open
        ''')
        with self.assertNoMessages():
            self.checker.visit_module(node.root())
            self.checker.visit_functiondef(node)

    def test_import_as_underscore(self):
        node = astroid.parse('''
        import math as _
        ''')
        with self.assertNoMessages():
            self.walk(node)


class TestMissingSubmodule(CheckerTestCase):
    CHECKER_CLASS = variables.VariablesChecker

    def test_package_all(self):
        regr_data = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 'regrtest_data')
        sys.path.insert(0, regr_data)
        try:
            linter.check(os.path.join(regr_data, 'package_all'))
            got = linter.reporter.finalize().strip()
            assert got == "E:  3: Undefined variable name 'missing' in __all__"
        finally:
            sys.path.pop(0)
