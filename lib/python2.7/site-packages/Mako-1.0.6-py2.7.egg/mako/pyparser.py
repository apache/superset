# mako/pyparser.py
# Copyright (C) 2006-2016 the Mako authors and contributors <see AUTHORS file>
#
# This module is part of Mako and is released under
# the MIT License: http://www.opensource.org/licenses/mit-license.php

"""Handles parsing of Python code.

Parsing to AST is done via _ast on Python > 2.5, otherwise the compiler
module is used.
"""

from mako import exceptions, util, compat
from mako.compat import arg_stringname
import operator

if compat.py3k:
    # words that cannot be assigned to (notably
    # smaller than the total keys in __builtins__)
    reserved = set(['True', 'False', 'None', 'print'])

    # the "id" attribute on a function node
    arg_id = operator.attrgetter('arg')
else:
    # words that cannot be assigned to (notably
    # smaller than the total keys in __builtins__)
    reserved = set(['True', 'False', 'None'])

    # the "id" attribute on a function node
    arg_id = operator.attrgetter('id')

import _ast
util.restore__ast(_ast)
from mako import _ast_util


def parse(code, mode='exec', **exception_kwargs):
    """Parse an expression into AST"""

    try:
        return _ast_util.parse(code, '<unknown>', mode)
    except Exception:
        raise exceptions.SyntaxException(
            "(%s) %s (%r)" % (
                compat.exception_as().__class__.__name__,
                compat.exception_as(),
                code[0:50]
            ), **exception_kwargs)


class FindIdentifiers(_ast_util.NodeVisitor):

    def __init__(self, listener, **exception_kwargs):
        self.in_function = False
        self.in_assign_targets = False
        self.local_ident_stack = set()
        self.listener = listener
        self.exception_kwargs = exception_kwargs

    def _add_declared(self, name):
        if not self.in_function:
            self.listener.declared_identifiers.add(name)
        else:
            self.local_ident_stack.add(name)

    def visit_ClassDef(self, node):
        self._add_declared(node.name)

    def visit_Assign(self, node):

        # flip around the visiting of Assign so the expression gets
        # evaluated first, in the case of a clause like "x=x+5" (x
        # is undeclared)

        self.visit(node.value)
        in_a = self.in_assign_targets
        self.in_assign_targets = True
        for n in node.targets:
            self.visit(n)
        self.in_assign_targets = in_a

    if compat.py3k:

        # ExceptHandler is in Python 2, but this block only works in
        # Python 3 (and is required there)

        def visit_ExceptHandler(self, node):
            if node.name is not None:
                self._add_declared(node.name)
            if node.type is not None:
                self.visit(node.type)
            for statement in node.body:
                self.visit(statement)

    def visit_Lambda(self, node, *args):
        self._visit_function(node, True)

    def visit_FunctionDef(self, node):
        self._add_declared(node.name)
        self._visit_function(node, False)

    def _expand_tuples(self, args):
        for arg in args:
            if isinstance(arg, _ast.Tuple):
                for n in arg.elts:
                    yield n
            else:
                yield arg

    def _visit_function(self, node, islambda):

        # push function state onto stack.  dont log any more
        # identifiers as "declared" until outside of the function,
        # but keep logging identifiers as "undeclared". track
        # argument names in each function header so they arent
        # counted as "undeclared"

        inf = self.in_function
        self.in_function = True

        local_ident_stack = self.local_ident_stack
        self.local_ident_stack = local_ident_stack.union([
            arg_id(arg) for arg in self._expand_tuples(node.args.args)
        ])
        if islambda:
            self.visit(node.body)
        else:
            for n in node.body:
                self.visit(n)
        self.in_function = inf
        self.local_ident_stack = local_ident_stack

    def visit_For(self, node):

        # flip around visit

        self.visit(node.iter)
        self.visit(node.target)
        for statement in node.body:
            self.visit(statement)
        for statement in node.orelse:
            self.visit(statement)

    def visit_Name(self, node):
        if isinstance(node.ctx, _ast.Store):
            # this is eqiuvalent to visit_AssName in
            # compiler
            self._add_declared(node.id)
        elif node.id not in reserved and node.id \
            not in self.listener.declared_identifiers and node.id \
                not in self.local_ident_stack:
            self.listener.undeclared_identifiers.add(node.id)

    def visit_Import(self, node):
        for name in node.names:
            if name.asname is not None:
                self._add_declared(name.asname)
            else:
                self._add_declared(name.name.split('.')[0])

    def visit_ImportFrom(self, node):
        for name in node.names:
            if name.asname is not None:
                self._add_declared(name.asname)
            else:
                if name.name == '*':
                    raise exceptions.CompileException(
                        "'import *' is not supported, since all identifier "
                        "names must be explicitly declared.  Please use the "
                        "form 'from <modulename> import <name1>, <name2>, "
                        "...' instead.", **self.exception_kwargs)
                self._add_declared(name.name)


class FindTuple(_ast_util.NodeVisitor):

    def __init__(self, listener, code_factory, **exception_kwargs):
        self.listener = listener
        self.exception_kwargs = exception_kwargs
        self.code_factory = code_factory

    def visit_Tuple(self, node):
        for n in node.elts:
            p = self.code_factory(n, **self.exception_kwargs)
            self.listener.codeargs.append(p)
            self.listener.args.append(ExpressionGenerator(n).value())
            self.listener.declared_identifiers = \
                self.listener.declared_identifiers.union(
                    p.declared_identifiers)
            self.listener.undeclared_identifiers = \
                self.listener.undeclared_identifiers.union(
                    p.undeclared_identifiers)


class ParseFunc(_ast_util.NodeVisitor):

    def __init__(self, listener, **exception_kwargs):
        self.listener = listener
        self.exception_kwargs = exception_kwargs

    def visit_FunctionDef(self, node):
        self.listener.funcname = node.name

        argnames = [arg_id(arg) for arg in node.args.args]
        if node.args.vararg:
            argnames.append(arg_stringname(node.args.vararg))

        if compat.py2k:
            # kw-only args don't exist in Python 2
            kwargnames = []
        else:
            kwargnames = [arg_id(arg) for arg in node.args.kwonlyargs]
        if node.args.kwarg:
            kwargnames.append(arg_stringname(node.args.kwarg))
        self.listener.argnames = argnames
        self.listener.defaults = node.args.defaults  # ast
        self.listener.kwargnames = kwargnames
        if compat.py2k:
            self.listener.kwdefaults = []
        else:
            self.listener.kwdefaults = node.args.kw_defaults
        self.listener.varargs = node.args.vararg
        self.listener.kwargs = node.args.kwarg


class ExpressionGenerator(object):

    def __init__(self, astnode):
        self.generator = _ast_util.SourceGenerator(' ' * 4)
        self.generator.visit(astnode)

    def value(self):
        return ''.join(self.generator.result)
