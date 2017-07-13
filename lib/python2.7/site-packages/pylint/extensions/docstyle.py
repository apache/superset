# Copyright (c) 2016 Luis Escobar <lescobar@vauxoo.com>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import linecache

from pylint import checkers
from pylint.interfaces import IAstroidChecker, HIGH
from pylint.checkers.utils import check_messages


class DocStringStyleChecker(checkers.BaseChecker):
    """Checks format of docstrings based on PEP 0257"""

    __implements__ = IAstroidChecker
    name = 'docstyle'

    msgs = {
        'C0198': ('Bad docstring quotes in %s, expected """, given %s',
                  'bad-docstring-quotes',
                  'Used when a docstring does not have triple double quotes.'),
        'C0199': ('First line empty in %s docstring',
                  'docstring-first-line-empty',
                  'Used when a blank line is found at the beginning of a docstring.'),
        }

    @check_messages('docstring-first-line-empty', 'bad-docstring-quotes')
    def visit_module(self, node):
        self._check_docstring('module', node)

    def visit_classdef(self, node):
        self._check_docstring('class', node)

    def visit_functiondef(self, node):
        ftype = 'method' if node.is_method() else 'function'
        self._check_docstring(ftype, node)

    visit_asyncfunctiondef = visit_functiondef

    def _check_docstring(self, node_type, node):
        docstring = node.doc
        if docstring and docstring[0] == '\n':
            self.add_message('docstring-first-line-empty', node=node,
                             args=(node_type,), confidence=HIGH)

        # Use "linecache", instead of node.as_string(), because the latter
        # looses the original form of the docstrings.

        if docstring:
            lineno = node.fromlineno + 1
            line = linecache.getline(node.root().file, lineno).lstrip()
            if line and line.find('"""') == 0:
                return
            if line and '\'\'\'' in line:
                quotes = '\'\'\''
            elif line and line[0] == '"':
                quotes = '"'
            elif line and line[0] == '\'':
                quotes = '\''
            else:
                quotes = False
            if quotes:
                self.add_message('bad-docstring-quotes', node=node,
                                 args=(node_type, quotes), confidence=HIGH)


def register(linter):
    """Required method to auto register this checker.

    :param linter: Main interface object for Pylint plugins
    :type linter: Pylint object
    """
    linter.register_checker(DocStringStyleChecker(linter))
