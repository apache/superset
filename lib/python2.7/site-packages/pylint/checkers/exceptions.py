# Copyright (c) 2006-2011, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2011, 2013-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Steven Myint <hg@stevenmyint.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Checks for various exception related errors."""

import inspect
import sys

import six
from six.moves import builtins

import astroid
from pylint import checkers
from pylint.checkers import utils
from pylint import interfaces


def _builtin_exceptions():
    def predicate(obj):
        return isinstance(obj, type) and issubclass(obj, BaseException)

    members = inspect.getmembers(six.moves.builtins, predicate)
    return {exc.__name__ for (_, exc) in members}


def _annotated_unpack_infer(stmt, context=None):
    """
    Recursively generate nodes inferred by the given statement.
    If the inferred value is a list or a tuple, recurse on the elements.
    Returns an iterator which yields tuples in the format
    ('original node', 'infered node').
    """
    if isinstance(stmt, (astroid.List, astroid.Tuple)):
        for elt in stmt.elts:
            inferred = utils.safe_infer(elt)
            if inferred and inferred is not astroid.YES:
                yield elt, inferred
        return
    for infered in stmt.infer(context):
        if infered is astroid.YES:
            continue
        yield stmt, infered


PY3K = sys.version_info >= (3, 0)
OVERGENERAL_EXCEPTIONS = ('Exception',)
BUILTINS_NAME = builtins.__name__

MSGS = {
    'E0701': ('Bad except clauses order (%s)',
              'bad-except-order',
              'Used when except clauses are not in the correct order (from the '
              'more specific to the more generic). If you don\'t fix the order, '
              'some exceptions may not be caught by the most specific handler.'),
    'E0702': ('Raising %s while only classes or instances are allowed',
              'raising-bad-type',
              'Used when something which is neither a class, an instance or a \
              string is raised (i.e. a `TypeError` will be raised).'),
    'E0703': ('Exception context set to something which is not an '
              'exception, nor None',
              'bad-exception-context',
              'Used when using the syntax "raise ... from ...", '
              'where the exception context is not an exception, '
              'nor None.',
              {'minversion': (3, 0)}),
    'E0704': ('The raise statement is not inside an except clause',
              'misplaced-bare-raise',
              'Used when a bare raise is not used inside an except clause. '
              'This generates an error, since there are no active exceptions '
              'to be reraised. An exception to this rule is represented by '
              'a bare raise inside a finally clause, which might work, as long '
              'as an exception is raised inside the try block, but it is '
              'nevertheless a code smell that must not be relied upon.'),
    'E0710': ('Raising a new style class which doesn\'t inherit from BaseException',
              'raising-non-exception',
              'Used when a new style class which doesn\'t inherit from \
               BaseException is raised.'),
    'E0711': ('NotImplemented raised - should raise NotImplementedError',
              'notimplemented-raised',
              'Used when NotImplemented is raised instead of \
              NotImplementedError'),
    'E0712': ('Catching an exception which doesn\'t inherit from Exception: %s',
              'catching-non-exception',
              'Used when a class which doesn\'t inherit from \
               Exception is used as an exception in an except clause.'),
    'W0702': ('No exception type(s) specified',
              'bare-except',
              'Used when an except clause doesn\'t specify exceptions type to \
              catch.'),
    'W0703': ('Catching too general exception %s',
              'broad-except',
              'Used when an except catches a too general exception, \
              possibly burying unrelated errors.'),
    'W0705': ('Catching previously caught exception type %s',
              'duplicate-except',
              'Used when an except catches a type that was already caught by '
              'a previous handler.'),
    'W0710': ('Exception doesn\'t inherit from standard "Exception" class',
              'nonstandard-exception',
              'Used when a custom exception class is raised but doesn\'t \
              inherit from the builtin "Exception" class.',
              {'maxversion': (3, 0)}),
    'W0711': ('Exception to catch is the result of a binary "%s" operation',
              'binary-op-exception',
              'Used when the exception to catch is of the form \
              "except A or B:".  If intending to catch multiple, \
              rewrite as "except (A, B):"'),
    }


class BaseVisitor(object):
    """Base class for visitors defined in this module."""

    def __init__(self, checker, node):
        self._checker = checker
        self._node = node

    def visit(self, node):
        name = node.__class__.__name__.lower()
        dispatch_meth = getattr(self, 'visit_' + name, None)
        if dispatch_meth:
            dispatch_meth(node)
        else:
            self.visit_default(node)

    def visit_default(self, node): # pylint: disable=unused-argument
        """Default implementation for all the nodes."""


class ExceptionRaiseRefVisitor(BaseVisitor):
    """Visit references (anything that is not an AST leaf)."""

    def visit_name(self, name):
        if name.name == 'NotImplemented':
            self._checker.add_message(
                'notimplemented-raised',
                node=self._node)

    def visit_call(self, call):
        if isinstance(call.func, astroid.Name):
            self.visit_name(call.func)


class ExceptionRaiseLeafVisitor(BaseVisitor):
    """Visitor for handling leaf kinds of a raise value."""

    def visit_const(self, const):
        if not isinstance(const.value, str):
            # raising-string will be emitted from python3 porting checker.
            self._checker.add_message('raising-bad-type', node=self._node,
                                      args=const.value.__class__.__name__)

    def visit_instance(self, instance):
        # pylint: disable=protected-access
        cls = instance._proxied
        self.visit_classdef(cls)

    # Exception instances have a particular class type
    visit_exceptioninstance = visit_instance

    def visit_classdef(self, cls):
        if (not utils.inherit_from_std_ex(cls) and
                utils.has_known_bases(cls)):
            if cls.newstyle:
                self._checker.add_message('raising-non-exception', node=self._node)
            else:
                self._checker.add_message('nonstandard-exception', node=self._node)

    def visit_tuple(self, tuple_node):
        if PY3K or not tuple_node.elts:
            self._checker.add_message('raising-bad-type',
                                      node=self._node,
                                      args='tuple')
            return

        # On Python 2, using the following is not an error:
        #    raise (ZeroDivisionError, None)
        #    raise (ZeroDivisionError, )
        # What's left to do is to check that the first
        # argument is indeed an exception. Verifying the other arguments
        # is not the scope of this check.
        first = tuple_node.elts[0]
        inferred = utils.safe_infer(first)
        if not inferred or inferred is astroid.Uninferable:
            return

        if (isinstance(inferred, astroid.Instance)
                and inferred.__class__.__name__ != 'Instance'):
            # TODO: explain why
            self.visit_default(tuple_node)
        else:
            self.visit(inferred)

    def visit_default(self, node):
        name = getattr(node, 'name', node.__class__.__name__)
        self._checker.add_message('raising-bad-type',
                                  node=self._node,
                                  args=name)


class ExceptionsChecker(checkers.BaseChecker):
    """Exception related checks."""

    __implements__ = interfaces.IAstroidChecker

    name = 'exceptions'
    msgs = MSGS
    priority = -4
    options = (('overgeneral-exceptions',
                {'default' : OVERGENERAL_EXCEPTIONS,
                 'type' : 'csv', 'metavar' : '<comma-separated class names>',
                 'help' : 'Exceptions that will emit a warning '
                          'when being caught. Defaults to "%s"' % (
                              ', '.join(OVERGENERAL_EXCEPTIONS),)}
               ),
              )

    def open(self):
        self._builtin_exceptions = _builtin_exceptions()
        super(ExceptionsChecker, self).open()

    @utils.check_messages('nonstandard-exception', 'misplaced-bare-raise',
                          'raising-bad-type', 'raising-non-exception',
                          'notimplemented-raised', 'bad-exception-context')
    def visit_raise(self, node):
        if node.exc is None:
            self._check_misplaced_bare_raise(node)
            return

        if PY3K and node.cause:
            self._check_bad_exception_context(node)

        expr = node.exc
        try:
            inferred_value = next(expr.infer())
        except astroid.InferenceError:
            inferred_value = None

        ExceptionRaiseRefVisitor(self, node).visit(expr)

        if inferred_value:
            ExceptionRaiseLeafVisitor(self, node).visit(inferred_value)

    def _check_misplaced_bare_raise(self, node):
        # Filter out if it's present in __exit__.
        scope = node.scope()
        if (isinstance(scope, astroid.FunctionDef)
                and scope.is_method()
                and scope.name == '__exit__'):
            return

        current = node
        # Stop when a new scope is generated or when the raise
        # statement is found inside a TryFinally.
        ignores = (astroid.ExceptHandler, astroid.FunctionDef, astroid.TryFinally)
        while current and not isinstance(current.parent, ignores):
            current = current.parent

        expected = (astroid.ExceptHandler,)
        if not current or not isinstance(current.parent, expected):
            self.add_message('misplaced-bare-raise', node=node)

    def _check_bad_exception_context(self, node):
        """Verify that the exception context is properly set.

        An exception context can be only `None` or an exception.
        """
        cause = utils.safe_infer(node.cause)
        if cause in (astroid.YES, None):
            return

        if isinstance(cause, astroid.Const):
            if cause.value is not None:
                self.add_message('bad-exception-context',
                                 node=node)
        elif (not isinstance(cause, astroid.ClassDef) and
              not utils.inherit_from_std_ex(cause)):
            self.add_message('bad-exception-context',
                             node=node)

    def _check_catching_non_exception(self, handler, exc, part):
        if isinstance(exc, astroid.Tuple):
            # Check if it is a tuple of exceptions.
            inferred = [utils.safe_infer(elt) for elt in exc.elts]
            if any(node is astroid.YES for node in inferred):
                # Don't emit if we don't know every component.
                return
            if all(node and utils.inherit_from_std_ex(node)
                   for node in inferred):
                return

        if not isinstance(exc, astroid.ClassDef):
            # Don't emit the warning if the infered stmt
            # is None, but the exception handler is something else,
            # maybe it was redefined.
            if (isinstance(exc, astroid.Const) and
                    exc.value is None):
                if ((isinstance(handler.type, astroid.Const) and
                     handler.type.value is None) or
                        handler.type.parent_of(exc)):
                    # If the exception handler catches None or
                    # the exception component, which is None, is
                    # defined by the entire exception handler, then
                    # emit a warning.
                    self.add_message('catching-non-exception',
                                     node=handler.type,
                                     args=(part.as_string(), ))
            else:
                self.add_message('catching-non-exception',
                                 node=handler.type,
                                 args=(part.as_string(), ))
            return

        if (not utils.inherit_from_std_ex(exc) and
                exc.name not in self._builtin_exceptions):
            if utils.has_known_bases(exc):
                self.add_message('catching-non-exception',
                                 node=handler.type,
                                 args=(exc.name, ))

    @utils.check_messages('bare-except', 'broad-except',
                          'binary-op-exception', 'bad-except-order',
                          'catching-non-exception', 'duplicate-except')
    def visit_tryexcept(self, node):
        """check for empty except"""
        exceptions_classes = []
        nb_handlers = len(node.handlers)
        for index, handler in enumerate(node.handlers):
            if handler.type is None:
                if not utils.is_raising(handler.body):
                    self.add_message('bare-except', node=handler)
                # check if a "except:" is followed by some other
                # except
                if index < (nb_handlers - 1):
                    msg = 'empty except clause should always appear last'
                    self.add_message('bad-except-order', node=node, args=msg)

            elif isinstance(handler.type, astroid.BoolOp):
                self.add_message('binary-op-exception',
                                 node=handler, args=handler.type.op)
            else:
                try:
                    excs = list(_annotated_unpack_infer(handler.type))
                except astroid.InferenceError:
                    continue

                for part, exc in excs:
                    if exc is astroid.YES:
                        continue
                    if (isinstance(exc, astroid.Instance)
                            and utils.inherit_from_std_ex(exc)):
                        # pylint: disable=protected-access
                        exc = exc._proxied

                    self._check_catching_non_exception(handler, exc, part)

                    if not isinstance(exc, astroid.ClassDef):
                        continue

                    exc_ancestors = [anc for anc in exc.ancestors()
                                     if isinstance(anc, astroid.ClassDef)]

                    for previous_exc in exceptions_classes:
                        if previous_exc in exc_ancestors:
                            msg = '%s is an ancestor class of %s' % (
                                previous_exc.name, exc.name)
                            self.add_message('bad-except-order',
                                             node=handler.type, args=msg)
                    if (exc.name in self.config.overgeneral_exceptions
                            and exc.root().name == utils.EXCEPTIONS_MODULE
                            and not utils.is_raising(handler.body)):
                        self.add_message('broad-except',
                                         args=exc.name, node=handler.type)

                    if exc in exceptions_classes:
                        self.add_message('duplicate-except',
                                         args=exc.name, node=handler.type)

                exceptions_classes += [exc for _, exc in excs]


def register(linter):
    """required method to auto register this checker"""
    linter.register_checker(ExceptionsChecker(linter))
