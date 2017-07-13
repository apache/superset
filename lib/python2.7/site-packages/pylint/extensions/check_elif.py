# Copyright (c) 2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import astroid
from pylint.checkers import BaseTokenChecker
from pylint.checkers.utils import check_messages
from pylint.interfaces import ITokenChecker, IAstroidChecker


class ElseifUsedChecker(BaseTokenChecker):
    """Checks for use of "else if" when a "elif" could be used
    """

    __implements__ = (ITokenChecker, IAstroidChecker)
    name = 'else_if_used'
    msgs = {'R5501': ('Consider using "elif" instead of "else if"',
                      'else-if-used',
                      'Used when an else statement is immediately followed by '
                      'an if statement and does not contain statements that '
                      'would be unrelated to it.'),
           }

    def __init__(self, linter=None):
        BaseTokenChecker.__init__(self, linter)
        self._init()

    def _init(self):
        self._elifs = []
        self._if_counter = 0

    def process_tokens(self, tokens):
        # Process tokens and look for 'if' or 'elif'
        for _, token, _, _, _ in tokens:
            if token == 'elif':
                self._elifs.append(True)
            elif token == 'if':
                self._elifs.append(False)

    def leave_module(self, _):
        self._init()

    def visit_ifexp(self, _):
        self._if_counter += 1

    def visit_comprehension(self, node):
        self._if_counter += len(node.ifs)

    @check_messages('else-if-used')
    def visit_if(self, node):
        if isinstance(node.parent, astroid.If):
            orelse = node.parent.orelse
            # current if node must directly follow a "else"
            if orelse and orelse == [node]:
                if not self._elifs[self._if_counter]:
                    self.add_message('else-if-used', node=node)
        self._if_counter += 1


def register(linter):
    """Required method to auto register this checker.

    :param linter: Main interface object for Pylint plugins
    :type linter: Pylint object
    """
    linter.register_checker(ElseifUsedChecker(linter))
