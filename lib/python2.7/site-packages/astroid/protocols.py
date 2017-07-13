# Copyright (c) 2009-2011, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""this module contains a set of functions to handle python protocols for nodes
where it makes sense.
"""

import collections
import operator as operator_mod
import sys

import six

from astroid import arguments
from astroid import bases
from astroid import context as contextmod
from astroid import exceptions
from astroid import decorators
from astroid import node_classes
from astroid import helpers
from astroid import nodes
from astroid import util

raw_building = util.lazy_import('raw_building')
objects = util.lazy_import('objects')

def _reflected_name(name):
    return "__r" + name[2:]

def _augmented_name(name):
    return "__i" + name[2:]


_CONTEXTLIB_MGR = 'contextlib.contextmanager'
BIN_OP_METHOD = {'+':  '__add__',
                 '-':  '__sub__',
                 '/':  '__div__' if six.PY2 else '__truediv__',
                 '//': '__floordiv__',
                 '*':  '__mul__',
                 '**': '__pow__',
                 '%':  '__mod__',
                 '&':  '__and__',
                 '|':  '__or__',
                 '^':  '__xor__',
                 '<<': '__lshift__',
                 '>>': '__rshift__',
                 '@': '__matmul__'
                }

REFLECTED_BIN_OP_METHOD = {
    key: _reflected_name(value)
    for (key, value) in BIN_OP_METHOD.items()
}
AUGMENTED_OP_METHOD = {
    key + "=": _augmented_name(value)
    for (key, value) in BIN_OP_METHOD.items()
}

UNARY_OP_METHOD = {'+': '__pos__',
                   '-': '__neg__',
                   '~': '__invert__',
                   'not': None, # XXX not '__nonzero__'
                  }
_UNARY_OPERATORS = {
    '+': operator_mod.pos,
    '-': operator_mod.neg,
    '~': operator_mod.invert,
    'not': operator_mod.not_,
}


def _infer_unary_op(obj, op):
    func = _UNARY_OPERATORS[op]
    value = func(obj)
    return nodes.const_factory(value)

nodes.Tuple.infer_unary_op = lambda self, op: _infer_unary_op(tuple(self.elts), op)
nodes.List.infer_unary_op = lambda self, op: _infer_unary_op(self.elts, op)
nodes.Set.infer_unary_op = lambda self, op: _infer_unary_op(set(self.elts), op)
nodes.Const.infer_unary_op = lambda self, op: _infer_unary_op(self.value, op)
nodes.Dict.infer_unary_op = lambda self, op: _infer_unary_op(dict(self.items), op)

# Binary operations

BIN_OP_IMPL = {'+':  lambda a, b: a + b,
               '-':  lambda a, b: a - b,
               '/':  lambda a, b: a / b,
               '//': lambda a, b: a // b,
               '*':  lambda a, b: a * b,
               '**': lambda a, b: a ** b,
               '%':  lambda a, b: a % b,
               '&':  lambda a, b: a & b,
               '|':  lambda a, b: a | b,
               '^':  lambda a, b: a ^ b,
               '<<': lambda a, b: a << b,
               '>>': lambda a, b: a >> b,
              }
if sys.version_info >= (3, 5):
    # MatMult is available since Python 3.5+.
    BIN_OP_IMPL['@'] = operator_mod.matmul

for _KEY, _IMPL in list(BIN_OP_IMPL.items()):
    BIN_OP_IMPL[_KEY + '='] = _IMPL


@decorators.yes_if_nothing_inferred
def const_infer_binary_op(self, opnode, operator, other, context, _):
    not_implemented = nodes.Const(NotImplemented)
    if isinstance(other, nodes.Const):
        try:
            impl = BIN_OP_IMPL[operator]
            try:
                yield nodes.const_factory(impl(self.value, other.value))
            except TypeError:
                # ArithmeticError is not enough: float >> float is a TypeError
                yield not_implemented
            except Exception: # pylint: disable=broad-except
                yield util.Uninferable
        except TypeError:
            yield not_implemented
    elif isinstance(self.value, six.string_types) and operator == '%':
        # TODO(cpopa): implement string interpolation later on.
        yield util.Uninferable
    else:
        yield not_implemented

nodes.Const.infer_binary_op = const_infer_binary_op


def _multiply_seq_by_int(self, opnode, other, context):
    node = self.__class__(parent=opnode)
    elts = []
    for elt in self.elts:
        infered = helpers.safe_infer(elt, context)
        if infered is None:
            infered = util.Uninferable
        elts.append(infered)
    node.elts = elts * other.value
    return node


def _filter_uninferable_nodes(elts, context):
    for elt in elts:
        if elt is util.Uninferable:
            yield nodes.Unknown()
        else:
            for inferred in elt.infer(context):
                if inferred is not util.Uninferable:
                    yield inferred
                else:
                    yield nodes.Unknown()


@decorators.yes_if_nothing_inferred
def tl_infer_binary_op(self, opnode, operator, other, context, method):
    not_implemented = nodes.Const(NotImplemented)
    if isinstance(other, self.__class__) and operator == '+':
        node = self.__class__(parent=opnode)
        elts = list(_filter_uninferable_nodes(self.elts, context))
        elts += list(_filter_uninferable_nodes(other.elts, context))
        node.elts = elts
        yield node
    elif isinstance(other, nodes.Const) and operator == '*':
        if not isinstance(other.value, int):
            yield not_implemented
            return
        yield _multiply_seq_by_int(self, opnode, other, context)
    elif isinstance(other, bases.Instance) and operator == '*':
        # Verify if the instance supports __index__.
        as_index = helpers.class_instance_as_index(other)
        if not as_index:
            yield util.Uninferable
        else:
            yield _multiply_seq_by_int(self, opnode, as_index, context)
    else:
        yield not_implemented

nodes.Tuple.infer_binary_op = tl_infer_binary_op
nodes.List.infer_binary_op = tl_infer_binary_op


@decorators.yes_if_nothing_inferred
def instance_class_infer_binary_op(self, opnode, operator, other, context, method):
    return method.infer_call_result(self, context)

bases.Instance.infer_binary_op = instance_class_infer_binary_op
nodes.ClassDef.infer_binary_op = instance_class_infer_binary_op


# assignment ##################################################################

"""the assigned_stmts method is responsible to return the assigned statement
(e.g. not inferred) according to the assignment type.

The `asspath` argument is used to record the lhs path of the original node.
For instance if we want assigned statements for 'c' in 'a, (b,c)', asspath
will be [1, 1] once arrived to the Assign node.

The `context` argument is the current inference context which should be given
to any intermediary inference necessary.
"""

def _resolve_looppart(parts, asspath, context):
    """recursive function to resolve multiple assignments on loops"""
    asspath = asspath[:]
    index = asspath.pop(0)
    for part in parts:
        if part is util.Uninferable:
            continue
        # XXX handle __iter__ and log potentially detected errors
        if not hasattr(part, 'itered'):
            continue
        try:
            itered = part.itered()
        except TypeError:
            continue # XXX log error
        for stmt in itered:
            index_node = nodes.Const(index)
            try:
                assigned = stmt.getitem(index_node, context)
            except (AttributeError,
                    exceptions.AstroidTypeError,
                    exceptions.AstroidIndexError):
                continue
            if not asspath:
                # we achieved to resolved the assignment path,
                # don't infer the last part
                yield assigned
            elif assigned is util.Uninferable:
                break
            else:
                # we are not yet on the last part of the path
                # search on each possibly inferred value
                try:
                    for inferred in _resolve_looppart(assigned.infer(context),
                                                      asspath, context):
                        yield inferred
                except exceptions.InferenceError:
                    break

@decorators.raise_if_nothing_inferred
def for_assigned_stmts(self, node=None, context=None, asspath=None):
    if isinstance(self, nodes.AsyncFor) or getattr(self, 'is_async', False):
        # Skip inferring of async code for now
        raise StopIteration(dict(node=self, unknown=node,
                                 assign_path=asspath, context=context))
    if asspath is None:
        for lst in self.iter.infer(context):
            if isinstance(lst, (nodes.Tuple, nodes.List)):
                for item in lst.elts:
                    yield item
    else:
        for inferred in _resolve_looppart(self.iter.infer(context),
                                          asspath, context):
            yield inferred
    # Explicit StopIteration to return error information, see comment
    # in raise_if_nothing_inferred.
    raise StopIteration(dict(node=self, unknown=node,
                             assign_path=asspath, context=context))

nodes.For.assigned_stmts = for_assigned_stmts
nodes.Comprehension.assigned_stmts = for_assigned_stmts


def sequence_assigned_stmts(self, node=None, context=None, asspath=None):
    if asspath is None:
        asspath = []
    try:
        index = self.elts.index(node)
    except ValueError:
        util.reraise(exceptions.InferenceError(
            'Tried to retrieve a node {node!r} which does not exist',
            node=self, assign_path=asspath, context=context))

    asspath.insert(0, index)
    return self.parent.assigned_stmts(node=self, context=context, asspath=asspath)

nodes.Tuple.assigned_stmts = sequence_assigned_stmts
nodes.List.assigned_stmts = sequence_assigned_stmts


def assend_assigned_stmts(self, node=None, context=None, asspath=None):
    return self.parent.assigned_stmts(node=self, context=context)
nodes.AssignName.assigned_stmts = assend_assigned_stmts
nodes.AssignAttr.assigned_stmts = assend_assigned_stmts


def _arguments_infer_argname(self, name, context):
    # arguments information may be missing, in which case we can't do anything
    # more
    if not (self.args or self.vararg or self.kwarg):
        yield util.Uninferable
        return
    # first argument of instance/class method
    if self.args and getattr(self.args[0], 'name', None) == name:
        functype = self.parent.type
        cls = self.parent.parent.scope()
        is_metaclass = isinstance(cls, nodes.ClassDef) and cls.type == 'metaclass'
        # If this is a metaclass, then the first argument will always
        # be the class, not an instance.
        if is_metaclass or functype == 'classmethod':
            yield cls
            return
        if functype == 'method':
            yield bases.Instance(self.parent.parent.frame())
            return

    if context and context.callcontext:
        call_site = arguments.CallSite(context.callcontext)
        for value in call_site.infer_argument(self.parent, name, context):
            yield value
        return

    # TODO: just provide the type here, no need to have an empty Dict.
    if name == self.vararg:
        vararg = nodes.const_factory(())
        vararg.parent = self
        yield vararg
        return
    if name == self.kwarg:
        kwarg = nodes.const_factory({})
        kwarg.parent = self
        yield kwarg
        return
    # if there is a default value, yield it. And then yield Uninferable to reflect
    # we can't guess given argument value
    try:
        context = contextmod.copy_context(context)
        for inferred in self.default_value(name).infer(context):
            yield inferred
        yield util.Uninferable
    except exceptions.NoDefault:
        yield util.Uninferable


def arguments_assigned_stmts(self, node=None, context=None, asspath=None):
    if context.callcontext:
        # reset call context/name
        callcontext = context.callcontext
        context = contextmod.copy_context(context)
        context.callcontext = None
        args = arguments.CallSite(callcontext)
        return args.infer_argument(self.parent, node.name, context)
    return _arguments_infer_argname(self, node.name, context)

nodes.Arguments.assigned_stmts = arguments_assigned_stmts


@decorators.raise_if_nothing_inferred
def assign_assigned_stmts(self, node=None, context=None, asspath=None):
    if not asspath:
        yield self.value
        return
    for inferred in _resolve_asspart(self.value.infer(context), asspath, context):
        yield inferred
    # Explicit StopIteration to return error information, see comment
    # in raise_if_nothing_inferred.
    raise StopIteration(dict(node=self, unknown=node,
                             assign_path=asspath, context=context))


def assign_annassigned_stmts(self, node=None, context=None, asspath=None):
    for inferred in assign_assigned_stmts(self, node, context, asspath):
        if inferred is None:
            yield util.Uninferable
        else:
            yield inferred

nodes.Assign.assigned_stmts = assign_assigned_stmts
nodes.AnnAssign.assigned_stmts = assign_annassigned_stmts
nodes.AugAssign.assigned_stmts = assign_assigned_stmts


def _resolve_asspart(parts, asspath, context):
    """recursive function to resolve multiple assignments"""
    asspath = asspath[:]
    index = asspath.pop(0)
    for part in parts:
        if hasattr(part, 'getitem'):
            index_node = nodes.Const(index)
            try:
                assigned = part.getitem(index_node, context)
            # XXX raise a specific exception to avoid potential hiding of
            # unexpected exception ?
            except (exceptions.AstroidTypeError, exceptions.AstroidIndexError):
                return
            if not asspath:
                # we achieved to resolved the assignment path, don't infer the
                # last part
                yield assigned
            elif assigned is util.Uninferable:
                return
            else:
                # we are not yet on the last part of the path search on each
                # possibly inferred value
                try:
                    for inferred in _resolve_asspart(assigned.infer(context),
                                                     asspath, context):
                        yield inferred
                except exceptions.InferenceError:
                    return


@decorators.raise_if_nothing_inferred
def excepthandler_assigned_stmts(self, node=None, context=None, asspath=None):
    for assigned in node_classes.unpack_infer(self.type):
        if isinstance(assigned, nodes.ClassDef):
            assigned = objects.ExceptionInstance(assigned)

        yield assigned
    # Explicit StopIteration to return error information, see comment
    # in raise_if_nothing_inferred.
    raise StopIteration(dict(node=self, unknown=node,
                             assign_path=asspath, context=context))


nodes.ExceptHandler.assigned_stmts = excepthandler_assigned_stmts


def _infer_context_manager(self, mgr, context):
    try:
        inferred = next(mgr.infer(context=context))
    except exceptions.InferenceError:
        return
    if isinstance(inferred, bases.Generator):
        # Check if it is decorated with contextlib.contextmanager.
        func = inferred.parent
        if not func.decorators:
            return
        for decorator_node in func.decorators.nodes:
            decorator = next(decorator_node.infer(context))
            if isinstance(decorator, nodes.FunctionDef):
                if decorator.qname() == _CONTEXTLIB_MGR:
                    break
        else:
            # It doesn't interest us.
            return

        # Get the first yield point. If it has multiple yields,
        # then a RuntimeError will be raised.
        # TODO(cpopa): Handle flows.
        yield_point = next(func.nodes_of_class(nodes.Yield), None)
        if yield_point:
            if not yield_point.value:
                # TODO(cpopa): an empty yield. Should be wrapped to Const.
                const = nodes.Const(None)
                const.parent = yield_point
                const.lineno = yield_point.lineno
                yield const
            else:
                for inferred in yield_point.value.infer(context=context):
                    yield inferred
    elif isinstance(inferred, bases.Instance):
        try:
            enter = next(inferred.igetattr('__enter__', context=context))
        except (exceptions.InferenceError, exceptions.AttributeInferenceError):
            return
        if not isinstance(enter, bases.BoundMethod):
            return
        if not context.callcontext:
            context.callcontext = contextmod.CallContext(args=[inferred])
        for result in enter.infer_call_result(self, context):
            yield result


@decorators.raise_if_nothing_inferred
def with_assigned_stmts(self, node=None, context=None, asspath=None):
    """Infer names and other nodes from a *with* statement.

    This enables only inference for name binding in a *with* statement.
    For instance, in the following code, inferring `func` will return
    the `ContextManager` class, not whatever ``__enter__`` returns.
    We are doing this intentionally, because we consider that the context
    manager result is whatever __enter__ returns and what it is binded
    using the ``as`` keyword.

        class ContextManager(object):
            def __enter__(self):
                return 42
        with ContextManager() as f:
            pass
        # ContextManager().infer() will return ContextManager
        # f.infer() will return 42.

    Arguments:
        self: nodes.With
        node: The target of the assignment, `as (a, b)` in `with foo as (a, b)`.
        context: TODO
        asspath: TODO
    """
    mgr = next(mgr for (mgr, vars) in self.items if vars == node)
    if asspath is None:
        for result in _infer_context_manager(self, mgr, context):
            yield result
    else:
        for result in _infer_context_manager(self, mgr, context):
            # Walk the asspath and get the item at the final index.
            obj = result
            for index in asspath:
                if not hasattr(obj, 'elts'):
                    raise exceptions.InferenceError(
                        'Wrong type ({targets!r}) for {node!r} assignment',
                        node=self, targets=node, assign_path=asspath,
                        context=context)
                try:
                    obj = obj.elts[index]
                except IndexError:
                    util.reraise(exceptions.InferenceError(
                        'Tried to infer a nonexistent target with index {index} '
                        'in {node!r}.', node=self, targets=node,
                        assign_path=asspath, context=context))
                except TypeError:
                    util.reraise(exceptions.InferenceError(
                        'Tried to unpack an non-iterable value '
                        'in {node!r}.', node=self, targets=node,
                        assign_path=asspath, context=context))
            yield obj
    # Explicit StopIteration to return error information, see comment
    # in raise_if_nothing_inferred.
    raise StopIteration(dict(node=self, unknown=node,
                             assign_path=asspath, context=context))

nodes.With.assigned_stmts = with_assigned_stmts


@decorators.yes_if_nothing_inferred
def starred_assigned_stmts(self, node=None, context=None, asspath=None):
    """
    Arguments:
        self: nodes.Starred
        node: TODO
        context: TODO
        asspath: TODO
    """
    stmt = self.statement()
    if not isinstance(stmt, (nodes.Assign, nodes.For)):
        raise exceptions.InferenceError('Statement {stmt!r} enclosing {node!r} '
                                        'must be an Assign or For node.',
                                        node=self, stmt=stmt, unknown=node,
                                        context=context)

    if isinstance(stmt, nodes.Assign):
        value = stmt.value
        lhs = stmt.targets[0]

        if sum(1 for node in lhs.nodes_of_class(nodes.Starred)) > 1:
            raise exceptions.InferenceError('Too many starred arguments in the '
                                            ' assignment targets {lhs!r}.',
                                            node=self, targets=lhs,
                                            unknown=node, context=context)

        if context is None:
            context = contextmod.InferenceContext()
        try:
            rhs = next(value.infer(context))
        except exceptions.InferenceError:
            yield util.Uninferable
            return
        if rhs is util.Uninferable or not hasattr(rhs, 'elts'):
            # Not interested in inferred values without elts.
            yield util.Uninferable
            return

        elts = collections.deque(rhs.elts[:])
        if len(lhs.elts) > len(rhs.elts):
            raise exceptions.InferenceError('More targets, {targets!r}, than '
                                            'values to unpack, {values!r}.',
                                            node=self, targets=lhs,
                                            values=rhs, unknown=node,
                                            context=context)

        # Unpack iteratively the values from the rhs of the assignment,
        # until the find the starred node. What will remain will
        # be the list of values which the Starred node will represent
        # This is done in two steps, from left to right to remove
        # anything before the starred node and from right to left
        # to remove anything after the starred node.

        for index, left_node in enumerate(lhs.elts):
            if not isinstance(left_node, nodes.Starred):
                elts.popleft()
                continue
            lhs_elts = collections.deque(reversed(lhs.elts[index:]))
            for right_node in lhs_elts:
                if not isinstance(right_node, nodes.Starred):
                    elts.pop()
                    continue
                # We're done
                packed = nodes.List()
                packed.elts = elts
                packed.parent = self
                yield packed
                break

nodes.Starred.assigned_stmts = starred_assigned_stmts
