# Copyright (c) 2015 Pavel Roskin <proski@gnu.org>
# Copyright (c) 2015 Rene Zhang <rz99@cornell.edu>
# Copyright (c) 2015 Steven Myint <hg@stevenmyint.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for pylint.checkers.exceptions."""

import sys

import pytest

import astroid

from pylint.checkers import exceptions
from pylint.testutils import CheckerTestCase, Message


class TestExceptionsChecker(CheckerTestCase):
    """Tests for pylint.checkers.exceptions."""

    CHECKER_CLASS = exceptions.ExceptionsChecker

    # These tests aren't in the functional test suite,
    # since they will be converted with 2to3 for Python 3
    # and `raise (Error, ...)` will be converted to
    # `raise Error(...)`, so it beats the purpose of the test.

    @pytest.mark.skipif(sys.version_info[0] != 3,
                        reason="The test should emit an error on Python 3.")
    def test_raising_bad_type_python3(self):
        node = astroid.extract_node('raise (ZeroDivisionError, None)  #@')
        message = Message('raising-bad-type', node=node, args='tuple')
        with self.assertAddsMessages(message):
            self.checker.visit_raise(node)

    @pytest.mark.skipif(sys.version_info[0] != 2,
                        reason="The test is valid only on Python 2.")
    def test_raising_bad_type_python2(self):
        nodes = astroid.extract_node('''
        raise (ZeroDivisionError, None)  #@
        from something import something
        raise (something, None) #@

        raise (4, None) #@
        raise () #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(nodes[0])
        with self.assertNoMessages():
            self.checker.visit_raise(nodes[1])

        message = Message('raising-bad-type', node=nodes[2], args='tuple')
        with self.assertAddsMessages(message):
            self.checker.visit_raise(nodes[2])
        message = Message('raising-bad-type', node=nodes[3], args='tuple')
        with self.assertAddsMessages(message):
            self.checker.visit_raise(nodes[3])
