# Copyright (c) 2006-2007, 2009-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2012-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Radu Ciorba <radu@devrandom.ro>
# Copyright (c) 2015 Dmitry Pribysh <dmand@yandex.ru>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

# pylint: disable=W0611
"""some functions that may be useful for various checkers
"""
import collections
import functools
try:
    from functools import singledispatch as singledispatch
except ImportError:
    # pylint: disable=import-error
    from singledispatch import singledispatch as singledispatch
try:
    from functools import lru_cache
except ImportError:
    from backports.functools_lru_cache import lru_cache
import itertools
import re
import sys
import string
import warnings

import six
from six.moves import map, builtins # pylint: disable=redefined-builtin

import astroid
from astroid import bases as _bases
from astroid import scoped_nodes


BUILTINS_NAME = builtins.__name__
COMP_NODE_TYPES = (astroid.ListComp, astroid.SetComp,
                   astroid.DictComp, astroid.GeneratorExp)
PY3K = sys.version_info[0] == 3

if not PY3K:
    EXCEPTIONS_MODULE = "exceptions"
else:
    EXCEPTIONS_MODULE = "builtins"
ABC_METHODS = set(('abc.abstractproperty', 'abc.abstractmethod',
                   'abc.abstractclassmethod', 'abc.abstractstaticmethod'))
ITER_METHOD = '__iter__'
NEXT_METHOD = 'next' if six.PY2 else '__next__'
GETITEM_METHOD = '__getitem__'
SETITEM_METHOD = '__setitem__'
DELITEM_METHOD = '__delitem__'
CONTAINS_METHOD = '__contains__'
KEYS_METHOD = 'keys'

# Dictionary which maps the number of expected parameters a
# special method can have to a set of special methods.
# The following keys are used to denote the parameters restrictions:
#
# * None: variable number of parameters
# * number: exactly that number of parameters
# * tuple: this are the odd ones. Basically it means that the function
#          can work with any number of arguments from that tuple,
#          although it's best to implement it in order to accept
#          all of them.
_SPECIAL_METHODS_PARAMS = {
    None: ('__new__', '__init__', '__call__'),

    0: ('__del__', '__repr__', '__str__', '__bytes__', '__hash__', '__bool__',
        '__dir__', '__len__', '__length_hint__', '__iter__', '__reversed__',
        '__neg__', '__pos__', '__abs__', '__invert__', '__complex__', '__int__',
        '__float__', '__neg__', '__pos__', '__abs__', '__complex__', '__int__',
        '__float__', '__index__', '__enter__', '__aenter__', '__getnewargs_ex__',
        '__getnewargs__', '__getstate__', '__reduce__', '__copy__',
        '__unicode__', '__nonzero__', '__await__', '__aiter__', '__anext__',
        '__fspath__'),

    1: ('__format__', '__lt__', '__le__', '__eq__', '__ne__', '__gt__',
        '__ge__', '__getattr__', '__getattribute__', '__delattr__',
        '__delete__', '__instancecheck__', '__subclasscheck__',
        '__getitem__', '__missing__', '__delitem__', '__contains__',
        '__add__', '__sub__', '__mul__', '__truediv__', '__floordiv__',
        '__mod__', '__divmod__', '__lshift__', '__rshift__', '__and__',
        '__xor__', '__or__', '__radd__', '__rsub__', '__rmul__', '__rtruediv__',
        '__rmod__', '__rdivmod__', '__rpow__', '__rlshift__', '__rrshift__',
        '__rand__', '__rxor__', '__ror__', '__iadd__', '__isub__', '__imul__',
        '__itruediv__', '__ifloordiv__', '__imod__', '__ilshift__',
        '__irshift__', '__iand__', '__ixor__', '__ior__', '__ipow__',
        '__setstate__', '__reduce_ex__', '__deepcopy__', '__cmp__',
        '__matmul__', '__rmatmul__', '__div__'),

    2: ('__setattr__', '__get__', '__set__', '__setitem__'),

    3: ('__exit__', '__aexit__'),

    (0, 1): ('__round__', ),
}

SPECIAL_METHODS_PARAMS = {
    name: params
    for params, methods in _SPECIAL_METHODS_PARAMS.items()
    for name in methods
}
PYMETHODS = set(SPECIAL_METHODS_PARAMS)


class NoSuchArgumentError(Exception):
    pass

def is_inside_except(node):
    """Returns true if node is inside the name of an except handler."""
    current = node
    while current and not isinstance(current.parent, astroid.ExceptHandler):
        current = current.parent

    return current and current is current.parent.name


def get_all_elements(node):
    """Recursively returns all atoms in nested lists and tuples."""
    if isinstance(node, (astroid.Tuple, astroid.List)):
        for child in node.elts:
            for e in get_all_elements(child):
                yield e
    else:
        yield node


def clobber_in_except(node):
    """Checks if an assignment node in an except handler clobbers an existing
    variable.

    Returns (True, args for W0623) if assignment clobbers an existing variable,
    (False, None) otherwise.
    """
    if isinstance(node, astroid.AssignAttr):
        return (True, (node.attrname, 'object %r' % (node.expr.as_string(),)))
    elif isinstance(node, astroid.AssignName):
        name = node.name
        if is_builtin(name):
            return (True, (name, 'builtins'))
        else:
            stmts = node.lookup(name)[1]
            if (stmts and not isinstance(stmts[0].assign_type(),
                                         (astroid.Assign, astroid.AugAssign,
                                          astroid.ExceptHandler))):
                return (True, (name, 'outer scope (line %s)' % stmts[0].fromlineno))
    return (False, None)


def is_super(node):
    """return True if the node is referencing the "super" builtin function
    """
    if getattr(node, 'name', None) == 'super' and \
           node.root().name == BUILTINS_NAME:
        return True
    return False

def is_error(node):
    """return true if the function does nothing but raising an exception"""
    for child_node in node.get_children():
        if isinstance(child_node, astroid.Raise):
            return True
        return False

def is_raising(body):
    """return true if the given statement node raise an exception"""
    for node in body:
        if isinstance(node, astroid.Raise):
            return True
    return False

builtins = builtins.__dict__.copy()
SPECIAL_BUILTINS = ('__builtins__',) # '__path__', '__file__')

def is_builtin_object(node):
    """Returns True if the given node is an object from the __builtin__ module."""
    return node and node.root().name == BUILTINS_NAME

def is_builtin(name):
    """return true if <name> could be considered as a builtin defined by python
    """
    return name in builtins or name in SPECIAL_BUILTINS

def is_defined_before(var_node):
    """return True if the variable node is defined by a parent node (list,
    set, dict, or generator comprehension, lambda) or in a previous sibling
    node on the same line (statement_defining ; statement_using)
    """
    varname = var_node.name
    _node = var_node.parent
    while _node:
        if isinstance(_node, COMP_NODE_TYPES):
            for ass_node in _node.nodes_of_class(astroid.AssignName):
                if ass_node.name == varname:
                    return True
        elif isinstance(_node, astroid.For):
            for ass_node in _node.target.nodes_of_class(astroid.AssignName):
                if ass_node.name == varname:
                    return True
        elif isinstance(_node, astroid.With):
            for expr, ids in _node.items:
                if expr.parent_of(var_node):
                    break
                if (ids and
                        isinstance(ids, astroid.AssignName) and
                        ids.name == varname):
                    return True
        elif isinstance(_node, (astroid.Lambda, astroid.FunctionDef)):
            if _node.args.is_argument(varname):
                # If the name is found inside a default value
                # of a function, then let the search continue
                # in the parent's tree.
                if _node.args.parent_of(var_node):
                    try:
                        _node.args.default_value(varname)
                        _node = _node.parent
                        continue
                    except astroid.NoDefault:
                        pass
                return True
            if getattr(_node, 'name', None) == varname:
                return True
            break
        elif isinstance(_node, astroid.ExceptHandler):
            if isinstance(_node.name, astroid.AssignName):
                ass_node = _node.name
                if ass_node.name == varname:
                    return True
        _node = _node.parent
    # possibly multiple statements on the same line using semi colon separator
    stmt = var_node.statement()
    _node = stmt.previous_sibling()
    lineno = stmt.fromlineno
    while _node and _node.fromlineno == lineno:
        for ass_node in _node.nodes_of_class(astroid.AssignName):
            if ass_node.name == varname:
                return True
        for imp_node in _node.nodes_of_class((astroid.ImportFrom, astroid.Import)):
            if varname in [name[1] or name[0] for name in imp_node.names]:
                return True
        _node = _node.previous_sibling()
    return False

def is_func_default(node):
    """return true if the given Name node is used in function default argument's
    value
    """
    parent = node.scope()
    if isinstance(parent, astroid.FunctionDef):
        for default_node in parent.args.defaults:
            for default_name_node in default_node.nodes_of_class(astroid.Name):
                if default_name_node is node:
                    return True
    return False

def is_func_decorator(node):
    """return true if the name is used in function decorator"""
    parent = node.parent
    while parent is not None:
        if isinstance(parent, astroid.Decorators):
            return True
        if (parent.is_statement or
                isinstance(parent, (astroid.Lambda,
                                    scoped_nodes.ComprehensionScope,
                                    scoped_nodes.ListComp))):
            break
        parent = parent.parent
    return False

def is_ancestor_name(frame, node):
    """return True if `frame` is a astroid.Class node with `node` in the
    subtree of its bases attribute
    """
    try:
        bases = frame.bases
    except AttributeError:
        return False
    for base in bases:
        if node in base.nodes_of_class(astroid.Name):
            return True
    return False

def assign_parent(node):
    """return the higher parent which is not an AssName, Tuple or List node
    """
    while node and isinstance(node, (astroid.AssignName,
                                     astroid.Tuple,
                                     astroid.List)):
        node = node.parent
    return node


def overrides_a_method(class_node, name):
    """return True if <name> is a method overridden from an ancestor"""
    for ancestor in class_node.ancestors():
        if name in ancestor and isinstance(ancestor[name], astroid.FunctionDef):
            return True
    return False

def check_messages(*messages):
    """decorator to store messages that are handled by a checker method"""

    def store_messages(func):
        func.checks_msgs = messages
        return func
    return store_messages

class IncompleteFormatString(Exception):
    """A format string ended in the middle of a format specifier."""
    pass

class UnsupportedFormatCharacter(Exception):
    """A format character in a format string is not one of the supported
    format characters."""
    def __init__(self, index):
        Exception.__init__(self, index)
        self.index = index

def parse_format_string(format_string):
    """Parses a format string, returning a tuple of (keys, num_args), where keys
    is the set of mapping keys in the format string, and num_args is the number
    of arguments required by the format string.  Raises
    IncompleteFormatString or UnsupportedFormatCharacter if a
    parse error occurs."""
    keys = set()
    num_args = 0
    def next_char(i):
        i += 1
        if i == len(format_string):
            raise IncompleteFormatString
        return (i, format_string[i])
    i = 0
    while i < len(format_string):
        char = format_string[i]
        if char == '%':
            i, char = next_char(i)
            # Parse the mapping key (optional).
            key = None
            if char == '(':
                depth = 1
                i, char = next_char(i)
                key_start = i
                while depth != 0:
                    if char == '(':
                        depth += 1
                    elif char == ')':
                        depth -= 1
                    i, char = next_char(i)
                key_end = i - 1
                key = format_string[key_start:key_end]

            # Parse the conversion flags (optional).
            while char in '#0- +':
                i, char = next_char(i)
            # Parse the minimum field width (optional).
            if char == '*':
                num_args += 1
                i, char = next_char(i)
            else:
                while char in string.digits:
                    i, char = next_char(i)
            # Parse the precision (optional).
            if char == '.':
                i, char = next_char(i)
                if char == '*':
                    num_args += 1
                    i, char = next_char(i)
                else:
                    while char in string.digits:
                        i, char = next_char(i)
            # Parse the length modifier (optional).
            if char in 'hlL':
                i, char = next_char(i)
            # Parse the conversion type (mandatory).
            if PY3K:
                flags = 'diouxXeEfFgGcrs%a'
            else:
                flags = 'diouxXeEfFgGcrs%'
            if char not in flags:
                raise UnsupportedFormatCharacter(i)
            if key:
                keys.add(key)
            elif char != '%':
                num_args += 1
        i += 1
    return keys, num_args


def is_attr_protected(attrname):
    """return True if attribute name is protected (start with _ and some other
    details), False otherwise.
    """
    return attrname[0] == '_' and attrname != '_' and not (
        attrname.startswith('__') and attrname.endswith('__'))

def node_frame_class(node):
    """return klass node for a method node (or a staticmethod or a
    classmethod), return null otherwise
    """
    klass = node.frame()

    while klass is not None and not isinstance(klass, astroid.ClassDef):
        if klass.parent is None:
            klass = None
        else:
            klass = klass.parent.frame()

    return klass


def is_attr_private(attrname):
    """Check that attribute name is private (at least two leading underscores,
    at most one trailing underscore)
    """
    regex = re.compile('^_{2,}.*[^_]+_?$')
    return regex.match(attrname)

def get_argument_from_call(callfunc_node, position=None, keyword=None):
    """Returns the specified argument from a function call.

    :param astroid.Call callfunc_node: Node representing a function call to check.
    :param int position: position of the argument.
    :param str keyword: the keyword of the argument.

    :returns: The node representing the argument, None if the argument is not found.
    :rtype: astroid.Name
    :raises ValueError: if both position and keyword are None.
    :raises NoSuchArgumentError: if no argument at the provided position or with
    the provided keyword.
    """
    if position is None and keyword is None:
        raise ValueError('Must specify at least one of: position or keyword.')
    if position is not None:
        try:
            return callfunc_node.args[position]
        except IndexError:
            pass
    if keyword and callfunc_node.keywords:
        for arg in callfunc_node.keywords:
            if arg.arg == keyword:
                return arg.value

    raise NoSuchArgumentError

def inherit_from_std_ex(node):
    """
    Return true if the given class node is subclass of
    exceptions.Exception.
    """
    if node.name in ('Exception', 'BaseException') \
            and node.root().name == EXCEPTIONS_MODULE:
        return True
    return any(inherit_from_std_ex(parent)
               for parent in node.ancestors(recurs=True))

def error_of_type(handler, error_type):
    """
    Check if the given exception handler catches
    the given error_type.

    The *handler* parameter is a node, representing an ExceptHandler node.
    The *error_type* can be an exception, such as AttributeError,
    the name of an exception, or it can be a tuple of errors.
    The function will return True if the handler catches any of the
    given errors.
    """
    def stringify_error(error):
        if not isinstance(error, six.string_types):
            return error.__name__
        return error

    if not isinstance(error_type, tuple):
        error_type = (error_type, )
    expected_errors = {stringify_error(error) for error in error_type}
    if not handler.type:
        # bare except. While this indeed catches anything, if the desired errors
        # aren't specified directly, then we just ignore it.
        return False
    return handler.catch(expected_errors)


def decorated_with_property(node):
    """ Detect if the given function node is decorated with a property. """
    if not node.decorators:
        return False
    for decorator in node.decorators.nodes:
        if not isinstance(decorator, astroid.Name):
            continue
        try:
            if _is_property_decorator(decorator):
                return True
        except astroid.InferenceError:
            pass
    return False


def _is_property_decorator(decorator):
    for infered in decorator.infer():
        if isinstance(infered, astroid.ClassDef):
            if infered.root().name == BUILTINS_NAME and infered.name == 'property':
                return True
            for ancestor in infered.ancestors():
                if ancestor.name == 'property' and ancestor.root().name == BUILTINS_NAME:
                    return True


def decorated_with(func, qnames):
    """Determine if the `func` node has a decorator with the qualified name `qname`."""
    decorators = func.decorators.nodes if func.decorators else []
    for decorator_node in decorators:
        try:
            if any(i is not None and i.qname() in qnames for i in decorator_node.infer()):
                return True
        except astroid.InferenceError:
            continue
    return False


@lru_cache(maxsize=1024)
def unimplemented_abstract_methods(node, is_abstract_cb=None):
    """
    Get the unimplemented abstract methods for the given *node*.

    A method can be considered abstract if the callback *is_abstract_cb*
    returns a ``True`` value. The check defaults to verifying that
    a method is decorated with abstract methods.
    The function will work only for new-style classes. For old-style
    classes, it will simply return an empty dictionary.
    For the rest of them, it will return a dictionary of abstract method
    names and their inferred objects.
    """
    if is_abstract_cb is None:
        is_abstract_cb = functools.partial(
            decorated_with, qnames=ABC_METHODS)
    visited = {}
    try:
        mro = reversed(node.mro())
    except NotImplementedError:
        # Old style class, it will not have a mro.
        return {}
    except astroid.ResolveError:
        # Probably inconsistent hierarchy, don'try
        # to figure this out here.
        return {}
    for ancestor in mro:
        for obj in ancestor.values():
            infered = obj
            if isinstance(obj, astroid.AssignName):
                infered = safe_infer(obj)
                if not infered:
                    # Might be an abstract function,
                    # but since we don't have enough information
                    # in order to take this decision, we're taking
                    # the *safe* decision instead.
                    if obj.name in visited:
                        del visited[obj.name]
                    continue
                if not isinstance(infered, astroid.FunctionDef):
                    if obj.name in visited:
                        del visited[obj.name]
            if isinstance(infered, astroid.FunctionDef):
                # It's critical to use the original name,
                # since after inferring, an object can be something
                # else than expected, as in the case of the
                # following assignment.
                #
                # class A:
                #     def keys(self): pass
                #     __iter__ = keys
                abstract = is_abstract_cb(infered)
                if abstract:
                    visited[obj.name] = infered
                elif not abstract and obj.name in visited:
                    del visited[obj.name]
    return visited


def _import_node_context(node):
    current = node
    ignores = (astroid.ExceptHandler, astroid.TryExcept)
    while current and not isinstance(current.parent, ignores):
        current = current.parent

    if current and isinstance(current.parent, ignores):
        return current.parent
    return None


def is_from_fallback_block(node):
    """Check if the given node is from a fallback import block."""
    context = _import_node_context(node)
    if not context:
        return False

    if isinstance(context, astroid.ExceptHandler):
        other_body = context.parent.body
        handlers = context.parent.handlers
    else:
        other_body = itertools.chain.from_iterable(
            handler.body for handler in context.handlers)
        handlers = context.handlers

    has_fallback_imports = any(isinstance(import_node, (astroid.ImportFrom, astroid.Import))
                               for import_node in other_body)
    ignores_import_error = _except_handlers_ignores_exception(handlers, ImportError)
    return ignores_import_error or has_fallback_imports


def _except_handlers_ignores_exception(handlers, exception):
    func = functools.partial(error_of_type,
                             error_type=(exception, ))
    return any(map(func, handlers))


def node_ignores_exception(node, exception):
    """Check if the node is in a TryExcept which handles the given exception."""
    current = node
    ignores = (astroid.ExceptHandler, astroid.TryExcept)
    while current and not isinstance(current.parent, ignores):
        current = current.parent

    if current and isinstance(current.parent, astroid.TryExcept):
        return _except_handlers_ignores_exception(current.parent.handlers, exception)
    return False


def class_is_abstract(node):
    """return true if the given class node should be considered as an abstract
    class
    """
    for method in node.methods():
        if method.parent.frame() is node:
            if method.is_abstract(pass_is_abstract=False):
                return True
    return False


def _supports_protocol_method(value, attr):
    try:
        attributes = value.getattr(attr)
    except astroid.NotFoundError:
        return False

    first = attributes[0]
    if isinstance(first, astroid.AssignName):
        if isinstance(first.parent.value, astroid.Const):
            return False
    return True


def is_comprehension(node):
    comprehensions = (astroid.ListComp,
                      astroid.SetComp,
                      astroid.DictComp,
                      astroid.GeneratorExp)
    return isinstance(node, comprehensions)


def _supports_mapping_protocol(value):
    return (
        _supports_protocol_method(value, GETITEM_METHOD)
        and _supports_protocol_method(value, KEYS_METHOD)
    )


def _supports_membership_test_protocol(value):
    return _supports_protocol_method(value, CONTAINS_METHOD)


def _supports_iteration_protocol(value):
    return (
        _supports_protocol_method(value, ITER_METHOD)
        or _supports_protocol_method(value, GETITEM_METHOD)
    )


def _supports_getitem_protocol(value):
    return _supports_protocol_method(value, GETITEM_METHOD)


def _supports_setitem_protocol(value):
    return _supports_protocol_method(value, SETITEM_METHOD)


def _supports_delitem_protocol(value):
    return _supports_protocol_method(value, DELITEM_METHOD)


def _is_abstract_class_name(name):
    lname = name.lower()
    is_mixin = lname.endswith('mixin')
    is_abstract = lname.startswith('abstract')
    is_base = lname.startswith('base') or lname.endswith('base')
    return is_mixin or is_abstract or is_base


def is_inside_abstract_class(node):
    while node is not None:
        if isinstance(node, astroid.ClassDef):
            if class_is_abstract(node):
                return True
            name = getattr(node, 'name', None)
            if name is not None and _is_abstract_class_name(name):
                return True
        node = node.parent
    return False


def _supports_protocol(value, protocol_callback):
    if isinstance(value, astroid.ClassDef):
        if not has_known_bases(value):
            return True
        # classobj can only be iterable if it has an iterable metaclass
        meta = value.metaclass()
        if meta is not None:
            if protocol_callback(meta):
                return True
    if isinstance(value, astroid.BaseInstance):
        if not has_known_bases(value):
            return True
        if protocol_callback(value):
            return True

    # TODO: this is not needed in astroid 2.0, where we can
    # check the type using a virtual base class instead.
    if (isinstance(value, _bases.Proxy)
            and isinstance(value._proxied, astroid.BaseInstance)
            and has_known_bases(value._proxied)):
        value = value._proxied
        return protocol_callback(value)

    return False


def is_iterable(value):
    return _supports_protocol(value, _supports_iteration_protocol)


def is_mapping(value):
    return _supports_protocol(value, _supports_mapping_protocol)


def supports_membership_test(value):
    supported = _supports_protocol(value, _supports_membership_test_protocol)
    return supported or is_iterable(value)


def supports_getitem(value):
    return _supports_protocol(value, _supports_getitem_protocol)


def supports_setitem(value):
    return _supports_protocol(value, _supports_setitem_protocol)


def supports_delitem(value):
    return _supports_protocol(value, _supports_delitem_protocol)


# TODO(cpopa): deprecate these or leave them as aliases?
@lru_cache(maxsize=1024)
def safe_infer(node, context=None):
    """Return the inferred value for the given node.

    Return None if inference failed or if there is some ambiguity (more than
    one node has been inferred).
    """
    try:
        inferit = node.infer(context=context)
        value = next(inferit)
    except astroid.InferenceError:
        return
    try:
        next(inferit)
        return # None if there is ambiguity on the inferred node
    except astroid.InferenceError:
        return # there is some kind of ambiguity
    except StopIteration:
        return value


def has_known_bases(klass, context=None):
    """Return true if all base classes of a class could be inferred."""
    try:
        return klass._all_bases_known
    except AttributeError:
        pass
    for base in klass.bases:
        result = safe_infer(base, context=context)
        # TODO: check for A->B->A->B pattern in class structure too?
        if (not isinstance(result, astroid.ClassDef) or
                result is klass or
                not has_known_bases(result, context=context)):
            klass._all_bases_known = False
            return False
    klass._all_bases_known = True
    return True


def is_none(node):
    return (node is None or
            (isinstance(node, astroid.Const) and node.value is None) or
            (isinstance(node, astroid.Name)  and node.name == 'None')
           )


def node_type(node):
    """Return the inferred type for `node`

    If there is more than one possible type, or if inferred type is YES or None,
    return None
    """
    # check there is only one possible type for the assign node. Else we
    # don't handle it for now
    types = set()
    try:
        for var_type in node.infer():
            if var_type == astroid.YES or is_none(var_type):
                continue
            types.add(var_type)
            if len(types) > 1:
                return
    except astroid.InferenceError:
        return
    return types.pop() if types else None


def is_registered_in_singledispatch_function(node):
    """Check if the given function node is a singledispatch function."""

    singledispatch_qnames = (
        'functools.singledispatch',
        'singledispatch.singledispatch'
    )

    if not isinstance(node, astroid.FunctionDef):
        return False

    decorators = node.decorators.nodes if node.decorators else []
    for decorator in decorators:
        # func.register are function calls
        if not isinstance(decorator, astroid.Call):
            continue

        func = decorator.func
        if not isinstance(func, astroid.Attribute) or func.attrname != 'register':
            continue

        try:
            func_def = next(func.expr.infer())
        except astroid.InferenceError:
            continue

        if isinstance(func_def, astroid.FunctionDef):
            return decorated_with(func_def, singledispatch_qnames)

    return False
