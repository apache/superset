# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Checker for deprecated builtins."""
import sys

import astroid
from pylint.checkers import BaseChecker
from pylint.checkers.utils import check_messages
from pylint.interfaces import IAstroidChecker


BAD_FUNCTIONS = ['map', 'filter']
if sys.version_info < (3, 0):
    BAD_FUNCTIONS.append('input')
# Some hints regarding the use of bad builtins.
BUILTIN_HINTS = {
    'map': 'Using a list comprehension can be clearer.',
}
BUILTIN_HINTS['filter'] = BUILTIN_HINTS['map']


class BadBuiltinChecker(BaseChecker):

    __implements__ = (IAstroidChecker, )
    name = 'deprecated_builtins'
    msgs = {'W0141': ('Used builtin function %s',
                      'bad-builtin',
                      'Used when a black listed builtin function is used (see the '
                      'bad-function option). Usual black listed functions are the ones '
                      'like map, or filter , where Python offers now some cleaner '
                      'alternative like list comprehension.'),
           }

    options = (('bad-functions',
                {'default' : BAD_FUNCTIONS,
                 'type' :'csv', 'metavar' : '<builtin function names>',
                 'help' : 'List of builtins function names that should not be '
                          'used, separated by a comma'}
               ),
              )

    @check_messages('bad-builtin')
    def visit_call(self, node):
        if isinstance(node.func, astroid.Name):
            name = node.func.name
            # ignore the name if it's not a builtin (i.e. not defined in the
            # locals nor globals scope)
            if not (name in node.frame() or name in node.root()):
                if name in self.config.bad_functions:
                    hint = BUILTIN_HINTS.get(name)
                    if hint:
                        args = "%r. %s" % (name, hint)
                    else:
                        args = repr(name)
                    self.add_message('bad-builtin', node=node, args=args)


def register(linter):
    """Required method to auto register this checker.

    :param linter: Main interface object for Pylint plugins
    :type linter: Pylint object
    """
    linter.register_checker(BadBuiltinChecker(linter))
