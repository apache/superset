# Copyright (c) 2016 Alexander Todorov <atodorov@MrSenko.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.emptystring
"""

import os
import os.path as osp
import unittest

from pylint import checkers
from pylint.extensions.comparetozero import CompareToZeroChecker
from pylint.lint import PyLinter
from pylint.reporters import BaseReporter


class CompareToZeroTestReporter(BaseReporter):

    def handle_message(self, msg):
        self.messages.append(msg)

    def on_set_current_module(self, module, filepath):
        self.messages = []


class CompareToZeroUsedTC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._linter = PyLinter()
        cls._linter.set_reporter(CompareToZeroTestReporter())
        checkers.initialize(cls._linter)
        cls._linter.register_checker(CompareToZeroChecker(cls._linter))
        cls._linter.disable('I')

    def test_comparetozero_message(self):
        elif_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                             'compare_to_zero.py')
        self._linter.check([elif_test])
        msgs = self._linter.reporter.messages
        self.assertEqual(len(msgs), 6)
        for msg in msgs:
            self.assertEqual(msg.symbol, 'compare-to-zero')
            self.assertEqual(msg.msg, 'Avoid comparisons to zero')
        self.assertEqual(msgs[0].line, 6)
        self.assertEqual(msgs[1].line, 9)
        self.assertEqual(msgs[2].line, 12)
        self.assertEqual(msgs[3].line, 15)
        self.assertEqual(msgs[4].line, 18)
        self.assertEqual(msgs[5].line, 24)


if __name__ == '__main__':
    unittest.main()
