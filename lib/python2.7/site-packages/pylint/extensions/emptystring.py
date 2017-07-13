# -*- coding: utf-8 -*-
# Copyright (c) 2016 Alexander Todorov <atodorov@MrSenko.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Looks for  comparisons to empty string."""

import itertools

import astroid

from pylint import interfaces
from pylint import checkers
from pylint.checkers import utils


def _is_constant_empty_str(node):
    return isinstance(node, astroid.Const) and node.value == ''


class CompareToEmptyStringChecker(checkers.BaseChecker):
    """Checks for comparisons to empty string.
    Most of the times you should use the fact that empty strings are false.
    An exception to this rule is when an empty string value is allowed in the program
    and has a different meaning than None!
    """

    __implements__ = (interfaces.IAstroidChecker,)

    # configuration section name
    name = 'compare-to-empty-string'
    msgs = {'C1901': ('Avoid comparisons to empty string',
                      'compare-to-empty-string',
                      'Used when Pylint detects comparison to an empty string constant.'),
           }

    priority = -2
    options = ()

    @utils.check_messages('compare-to-empty-string')
    def visit_compare(self, node):
        _operators = ['!=', '==', 'is not', 'is']
        # note: astroid.Compare has the left most operand in node.left
        # while the rest are a list of tuples in node.ops
        # the format of the tuple is ('compare operator sign', node)
        # here we squash everything into `ops` to make it easier for processing later
        ops = [('', node.left)]
        ops.extend(node.ops)
        ops = list(itertools.chain(*ops))

        for ops_idx in range(len(ops) - 2):
            op_1 = ops[ops_idx]
            op_2 = ops[ops_idx + 1]
            op_3 = ops[ops_idx + 2]
            error_detected = False

            # x ?? ""
            if _is_constant_empty_str(op_1) and op_2 in _operators:
                error_detected = True
            # '' ?? X
            elif op_2 in _operators and _is_constant_empty_str(op_3):
                error_detected = True

            if error_detected:
                self.add_message('compare-to-empty-string', node=node)


def register(linter):
    """Required method to auto register this checker."""
    linter.register_checker(CompareToEmptyStringChecker(linter))
