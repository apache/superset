# -*- coding: utf-8 -*-

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Looks for overlapping exceptions."""

import astroid

from pylint import interfaces
from pylint import checkers
from pylint.checkers import utils

from pylint.checkers.exceptions import _annotated_unpack_infer


class OverlappingExceptionsChecker(checkers.BaseChecker):
    """Checks for two or more exceptions in the same exception handler
    clause that are identical or parts of the same inheritance hierarchy
    (i.e. overlapping)."""

    __implements__ = interfaces.IAstroidChecker

    name = 'overlap-except'
    msgs = {'W0714': ('Overlapping exceptions (%s)',
                      'overlapping-except',
                      'Used when exceptions in handler overlap or are identical')}
    priority = -2
    options = ()

    @utils.check_messages('overlapping-except')
    def visit_tryexcept(self, node):
        """check for empty except"""
        for handler in node.handlers:
            if handler.type is None:
                continue
            if isinstance(handler.type, astroid.BoolOp):
                continue
            try:
                excs = list(_annotated_unpack_infer(handler.type))
            except astroid.InferenceError:
                continue

            handled_in_clause = []
            for part, exc in excs:
                if exc is astroid.YES:
                    continue
                if (isinstance(exc, astroid.Instance) and
                        utils.inherit_from_std_ex(exc)):
                    # pylint: disable=protected-access
                    exc = exc._proxied

                if not isinstance(exc, astroid.ClassDef):
                    continue

                exc_ancestors = [anc for anc in exc.ancestors()
                                 if isinstance(anc, astroid.ClassDef)]

                for prev_part, prev_exc in handled_in_clause:
                    prev_exc_ancestors = [anc for anc in prev_exc.ancestors()
                                          if isinstance(anc, astroid.ClassDef)]
                    if exc == prev_exc:
                        self.add_message('overlapping-except',
                                         node=handler.type,
                                         args='%s and %s are the same' %
                                         (prev_part.as_string(),
                                          part.as_string()))
                    elif (prev_exc in exc_ancestors or
                          exc in prev_exc_ancestors):
                        ancestor = part if exc in prev_exc_ancestors else prev_part
                        descendant = part if prev_exc in exc_ancestors else prev_part
                        self.add_message('overlapping-except',
                                         node=handler.type,
                                         args='%s is an ancestor class of %s' %
                                         (ancestor.as_string(), descendant.as_string()))
                handled_in_clause += [(part, exc)]


def register(linter):
    """Required method to auto register this checker."""
    linter.register_checker(OverlappingExceptionsChecker(linter))
