# -*- coding: utf-8 -*-
# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014, 2016 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Holger Peters <email@holger-peters.de>
# Copyright (c) 2014 David Shea <dshea@redhat.com>
# Copyright (c) 2015 Radu Ciorba <radu@devrandom.ro>
# Copyright (c) 2015 Rene Zhang <rz99@cornell.edu>
# Copyright (c) 2015 Dmitry Pribysh <dmand@yandex.ru>
# Copyright (c) 2016 Jakub Wilk <jwilk@jwilk.net>
# Copyright (c) 2016 Jürgen Hermann <jh@web.de>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""try to find more bugs in the code using astroid inference capabilities
"""

import collections
import fnmatch
import heapq
import itertools
import operator
import re
import shlex
import sys

import six

import astroid
import astroid.context
import astroid.arguments
import astroid.nodes
from astroid import exceptions
from astroid.interpreter import dunder_lookup
from astroid import objects
from astroid import bases

from pylint.interfaces import IAstroidChecker, INFERENCE
from pylint.checkers import BaseChecker
from pylint.checkers.utils import (
    is_super, check_messages, decorated_with_property,
    decorated_with, node_ignores_exception,
    is_iterable, is_mapping, supports_membership_test,
    is_comprehension, is_inside_abstract_class,
    supports_getitem,
    supports_setitem,
    supports_delitem,
    safe_infer,
    has_known_bases,
    is_builtin_object,
    singledispatch)


BUILTINS = six.moves.builtins.__name__
STR_FORMAT = "%s.str.format" % BUILTINS


def _unflatten(iterable):
    for index, elem in enumerate(iterable):
        if (isinstance(elem, collections.Sequence) and
                not isinstance(elem, six.string_types)):
            for single_elem in _unflatten(elem):
                yield single_elem
        elif elem and not index:
            # We're interested only in the first element.
            yield elem


def _is_owner_ignored(owner, name, ignored_classes, ignored_modules):
    """Check if the given owner should be ignored

    This will verify if the owner's module is in *ignored_modules*
    or the owner's module fully qualified name is in *ignored_modules*
    or if the *ignored_modules* contains a pattern which catches
    the fully qualified name of the module.

    Also, similar checks are done for the owner itself, if its name
    matches any name from the *ignored_classes* or if its qualified
    name can be found in *ignored_classes*.
    """
    ignored_modules = set(ignored_modules)
    module_name = owner.root().name
    module_qname = owner.root().qname()
    if any(module_name in ignored_modules or
           module_qname in ignored_modules or
           fnmatch.fnmatch(module_qname, ignore) for ignore in ignored_modules):
        return True

    ignored_classes = set(ignored_classes)
    if hasattr(owner, 'qname'):
        qname = owner.qname()
    else:
        qname = ''
    return any(name == ignore or qname == ignore for ignore in ignored_classes)


@singledispatch
def _node_names(node):
    # TODO: maybe we need an ABC for checking if an object is a scoped node
    # or not?
    if not hasattr(node, 'locals'):
        return []
    return node.locals.keys()


@_node_names.register(astroid.ClassDef)
@_node_names.register(astroid.Instance)
def _(node):
    values = itertools.chain(node.instance_attrs.keys(), node.locals.keys())

    try:
        mro = node.mro()[1:]
    except (NotImplementedError, TypeError):
        mro = node.ancestors()

    other_values = [value for cls in mro for value in _node_names(cls)]
    return itertools.chain(values, other_values)


def _string_distance(seq1, seq2):
    seq2_length = len(seq2)

    row = list(range(1, seq2_length + 1)) + [0]
    for seq1_index, seq1_char in enumerate(seq1):
        last_row = row
        row = [0] * seq2_length + [seq1_index + 1]

        for seq2_index, seq2_char in enumerate(seq2):
            row[seq2_index] = min(
                last_row[seq2_index] + 1,
                row[seq2_index - 1] + 1,
                last_row[seq2_index - 1] + (seq1_char != seq2_char)

            )

    return row[seq2_length - 1]


def _similar_names(owner, attrname, distance_threshold, max_choices):
    """Given an owner and a name, try to find similar names

    The similar names are searched given a distance metric and only
    a given number of choices will be returned.
    """
    possible_names = []
    names = _node_names(owner)

    for name in names:
        if name == attrname:
            continue

        distance = _string_distance(attrname, name)
        if distance <= distance_threshold:
            possible_names.append((name, distance))

    # Now get back the values with a minimum, up to the given
    # limit or choices.
    picked = [name for (name, _) in
              heapq.nsmallest(max_choices, possible_names,
                              key=operator.itemgetter(1))]
    return sorted(picked)


def _missing_member_hint(owner, attrname, distance_threshold, max_choices):
    names = _similar_names(owner, attrname, distance_threshold, max_choices)
    if not names:
        # No similar name.
        return ""

    names = list(map(repr, names))
    if len(names) == 1:
        names = ", ".join(names)
    else:
        names = "one of {} or {}".format(", ".join(names[:-1]), names[-1])

    return "; maybe {}?".format(names)


MSGS = {
    'E1101': ('%s %r has no %r member%s',
              'no-member',
              'Used when a variable is accessed for an unexistent member.',
              {'old_names': [('E1103', 'maybe-no-member')]}),
    'E1102': ('%s is not callable',
              'not-callable',
              'Used when an object being called has been inferred to a non \
              callable object'),
    'E1111': ('Assigning to function call which doesn\'t return',
              'assignment-from-no-return',
              'Used when an assignment is done on a function call but the \
              inferred function doesn\'t return anything.'),
    'E1120': ('No value for argument %s in %s call',
              'no-value-for-parameter',
              'Used when a function call passes too few arguments.'),
    'E1121': ('Too many positional arguments for %s call',
              'too-many-function-args',
              'Used when a function call passes too many positional \
              arguments.'),
    'E1123': ('Unexpected keyword argument %r in %s call',
              'unexpected-keyword-arg',
              'Used when a function call passes a keyword argument that \
              doesn\'t correspond to one of the function\'s parameter names.'),
    'E1124': ('Argument %r passed by position and keyword in %s call',
              'redundant-keyword-arg',
              'Used when a function call would result in assigning multiple \
              values to a function parameter, one value from a positional \
              argument and one from a keyword argument.'),
    'E1125': ('Missing mandatory keyword argument %r in %s call',
              'missing-kwoa',
              ('Used when a function call does not pass a mandatory'
               ' keyword-only argument.'),
              {'minversion': (3, 0)}),
    'E1126': ('Sequence index is not an int, slice, or instance with __index__',
              'invalid-sequence-index',
              'Used when a sequence type is indexed with an invalid type. '
              'Valid types are ints, slices, and objects with an __index__ '
              'method.'),
    'E1127': ('Slice index is not an int, None, or instance with __index__',
              'invalid-slice-index',
              'Used when a slice index is not an integer, None, or an object \
               with an __index__ method.'),
    'E1128': ('Assigning to function call which only returns None',
              'assignment-from-none',
              'Used when an assignment is done on a function call but the '
              'inferred function returns nothing but None.',
              {'old_names': [('W1111', 'assignment-from-none')]}),
    'E1129': ("Context manager '%s' doesn't implement __enter__ and __exit__.",
              'not-context-manager',
              'Used when an instance in a with statement doesn\'t implement '
              'the context manager protocol(__enter__/__exit__).'),
    'E1130': ('%s',
              'invalid-unary-operand-type',
              'Emitted when a unary operand is used on an object which does not '
              'support this type of operation'),
    'E1131': ('%s',
              'unsupported-binary-operation',
              'Emitted when a binary arithmetic operation between two '
              'operands is not supported.'),
    'E1132': ('Got multiple values for keyword argument %r in function call',
              'repeated-keyword',
              'Emitted when a function call got multiple values for a keyword.'),
    'E1135': ("Value '%s' doesn't support membership test",
              'unsupported-membership-test',
              'Emitted when an instance in membership test expression doesn\'t '
              'implement membership protocol (__contains__/__iter__/__getitem__)'),
    'E1136': ("Value '%s' is unsubscriptable",
              'unsubscriptable-object',
              "Emitted when a subscripted value doesn't support subscription"
              "(i.e. doesn't define __getitem__ method)"),
    'E1137': ("%r does not support item assignment",
              'unsupported-assignment-operation',
              "Emitted when an object does not support item assignment "
              "(i.e. doesn't define __setitem__ method)"),
    'E1138': ("%r does not support item deletion",
              'unsupported-delete-operation',
              "Emitted when an object does not support item deletion "
              "(i.e. doesn't define __delitem__ method)"),
    'E1139': ('Invalid metaclass %r used',
              'invalid-metaclass',
              'Emitted whenever we can detect that a class is using, '
              'as a metaclass, something which might be invalid for using as '
              'a metaclass.'),
    }

# builtin sequence types in Python 2 and 3.
SEQUENCE_TYPES = set(['str', 'unicode', 'list', 'tuple', 'bytearray',
                      'xrange', 'range', 'bytes', 'memoryview'])


def _emit_no_member(node, owner, owner_name, ignored_mixins):
    """Try to see if no-member should be emitted for the given owner.

    The following cases are ignored:

        * the owner is a function and it has decorators.
        * the owner is an instance and it has __getattr__, __getattribute__ implemented
        * the module is explicitly ignored from no-member checks
        * the owner is a class and the name can be found in its metaclass.
        * The access node is protected by an except handler, which handles
          AttributeError, Exception or bare except.
    """
    if node_ignores_exception(node, AttributeError):
        return False
    # skip None anyway
    if isinstance(owner, astroid.Const) and owner.value is None:
        return False
    if is_super(owner) or getattr(owner, 'type', None) == 'metaclass':
        return False
    if ignored_mixins and owner_name[-5:].lower() == 'mixin':
        return False
    if isinstance(owner, astroid.FunctionDef) and owner.decorators:
        return False
    if isinstance(owner, (astroid.Instance, astroid.ClassDef)):
        if owner.has_dynamic_getattr() or not has_known_bases(owner):
            return False
    if isinstance(owner, objects.Super):
        # Verify if we are dealing with an invalid Super object.
        # If it is invalid, then there's no point in checking that
        # it has the required attribute. Also, don't fail if the
        # MRO is invalid.
        try:
            owner.super_mro()
        except (exceptions.MroError, exceptions.SuperError):
            return False
        if not all(map(has_known_bases, owner.type.mro())):
            return False
    return True


def _determine_callable(callable_obj):
    # Ordering is important, since BoundMethod is a subclass of UnboundMethod,
    # and Function inherits Lambda.
    if isinstance(callable_obj, astroid.BoundMethod):
        # Bound methods have an extra implicit 'self' argument.
        return callable_obj, 1, callable_obj.type
    elif isinstance(callable_obj, astroid.UnboundMethod):
        return callable_obj, 0, 'unbound method'
    elif isinstance(callable_obj, astroid.FunctionDef):
        return callable_obj, 0, callable_obj.type
    elif isinstance(callable_obj, astroid.Lambda):
        return callable_obj, 0, 'lambda'
    elif isinstance(callable_obj, astroid.ClassDef):
        # Class instantiation, lookup __new__ instead.
        # If we only find object.__new__, we can safely check __init__
        # instead. If __new__ belongs to builtins, then we look
        # again for __init__ in the locals, since we won't have
        # argument information for the builtin __new__ function.
        try:
            # Use the last definition of __new__.
            new = callable_obj.local_attr('__new__')[-1]
        except exceptions.NotFoundError:
            new = None

        from_object = new and new.parent.scope().name == 'object'
        from_builtins = new and new.root().name in sys.builtin_module_names

        if not new or from_object or from_builtins:
            try:
                # Use the last definition of __init__.
                callable_obj = callable_obj.local_attr('__init__')[-1]
            except exceptions.NotFoundError:
                # do nothing, covered by no-init.
                raise ValueError
        else:
            callable_obj = new

        if not isinstance(callable_obj, astroid.FunctionDef):
            raise ValueError
        # both have an extra implicit 'cls'/'self' argument.
        return callable_obj, 1, 'constructor'
    else:
        raise ValueError


def _has_parent_of_type(node, node_type, statement):
    """Check if the given node has a parent of the given type."""
    parent = node.parent
    while not isinstance(parent, node_type) and statement.parent_of(parent):
        parent = parent.parent
    return isinstance(parent, node_type)


def _is_name_used_as_variadic(name, variadics):
    """Check if the given name is used as a variadic argument."""
    return any(variadic.value == name or variadic.value.parent_of(name)
               for variadic in variadics)


def _no_context_variadic_keywords(node):
    statement = node.statement()
    scope = node.scope()
    variadics = ()

    if not isinstance(scope, astroid.FunctionDef):
        return False

    if isinstance(statement, astroid.Expr) and isinstance(statement.value, astroid.Call):
        call = statement.value
        variadics = call.keywords or ()

    return _no_context_variadic(node, scope.args.kwarg, astroid.Keyword, variadics)


def _no_context_variadic_positional(node):
    statement = node.statement()
    scope = node.scope()
    variadics = ()

    if not isinstance(scope, astroid.FunctionDef):
        return False

    if isinstance(statement, astroid.Expr) and isinstance(statement.value, astroid.Call):
        call = statement.value
        variadics = call.starargs

    return _no_context_variadic(node, scope.args.vararg, astroid.Starred, variadics)


def _no_context_variadic(node, variadic_name, variadic_type, variadics):
    """Verify if the given call node has variadic nodes without context

    This is a workaround for handling cases of nested call functions
    which don't have the specific call context at hand.
    Variadic arguments (variable positional arguments and variable
    keyword arguments) are inferred, inherently wrong, by astroid
    as a Tuple, respectively a Dict with empty elements.
    This can lead pylint to believe that a function call receives
    too few arguments.
    """
    statement = node.statement()
    for name in statement.nodes_of_class(astroid.Name):
        if name.name != variadic_name:
            continue

        inferred = safe_infer(name)
        if isinstance(inferred, (astroid.List, astroid.Tuple)):
            length = len(inferred.elts)
        elif isinstance(inferred, astroid.Dict):
            length = len(inferred.items)
        else:
            continue

        inferred_statement = inferred.statement()
        if not length and isinstance(inferred_statement, astroid.FunctionDef):
            is_in_starred_context = _has_parent_of_type(node, variadic_type, statement)
            used_as_starred_argument = _is_name_used_as_variadic(name, variadics)
            if is_in_starred_context or used_as_starred_argument:
                return True
    return False


def _is_invalid_metaclass(metaclass):
    try:
        mro = metaclass.mro()
    except NotImplementedError:
        # Cannot have a metaclass which is not a newstyle class.
        return True
    else:
        if not any(is_builtin_object(cls) and cls.name == 'type'
                   for cls in mro):
            return True
    return False


def _infer_from_metaclass_constructor(cls, func):
    """Try to infer what the given *func* constructor is building

    :param astroid.FunctionDef func:
        A metaclass constructor. Metaclass definitions can be
        functions, which should accept three arguments, the name of
        the class, the bases of the class and the attributes.
        The function could return anything, but usually it should
        be a proper metaclass.
    :param astroid.ClassDef cls:
        The class for which the *func* parameter should generate
        a metaclass.
    :returns:
        The class generated by the function or None,
        if we couldn't infer it.
    :rtype: astroid.ClassDef
    """
    context = astroid.context.InferenceContext()

    class_bases = astroid.List()
    class_bases.postinit(elts=cls.bases)

    attrs = astroid.Dict()
    local_names = [(name, values[-1]) for name, values in cls.locals.items()]
    attrs.postinit(local_names)

    builder_args = astroid.Tuple()
    builder_args.postinit([cls.name, class_bases, attrs])

    context.callcontext = astroid.context.CallContext(builder_args)
    try:
        inferred = next(func.infer_call_result(func, context), None)
    except astroid.InferenceError:
        return None
    return inferred or None


class TypeChecker(BaseChecker):
    """try to find bugs in the code using type inference
    """

    __implements__ = (IAstroidChecker,)

    # configuration section name
    name = 'typecheck'
    # messages
    msgs = MSGS
    priority = -1
    # configuration options
    options = (('ignore-on-opaque-inference',
                {'default': True, 'type': 'yn', 'metavar': '<y_or_n>',
                 'help': 'This flag controls whether pylint should warn about '
                         'no-member and similar checks whenever an opaque object '
                         'is returned when inferring. The inference can return '
                         'multiple potential results while evaluating a Python object, '
                         'but some branches might not be evaluated, which results in '
                         'partial inference. In that case, it might be useful to still emit '
                         'no-member and other checks for the rest of the inferred objects.'}
               ),
               ('ignore-mixin-members',
                {'default' : True, 'type' : 'yn', 'metavar': '<y_or_n>',
                 'help' : 'Tells whether missing members accessed in mixin \
class should be ignored. A mixin class is detected if its name ends with \
"mixin" (case insensitive).'}
               ),
               ('ignored-modules',
                {'default': (),
                 'type': 'csv',
                 'metavar': '<module names>',
                 'help': 'List of module names for which member attributes '
                         'should not be checked (useful for modules/projects '
                         'where namespaces are manipulated during runtime and '
                         'thus existing member attributes cannot be '
                         'deduced by static analysis. It supports qualified '
                         'module names, as well as Unix pattern matching.'}
               ),
               # the defaults here are *stdlib* names that (almost) always
               # lead to false positives, since their idiomatic use is
               # 'too dynamic' for pylint to grok.
               ('ignored-classes',
                {'default' : ('optparse.Values', 'thread._local', '_thread._local'),
                 'type' : 'csv',
                 'metavar' : '<members names>',
                 'help' : 'List of class names for which member attributes '
                          'should not be checked (useful for classes with '
                          'dynamically set attributes). This supports '
                          'the use of qualified names.'}
               ),

               ('generated-members',
                {'default' : (),
                 'type' : 'string',
                 'metavar' : '<members names>',
                 'help' : 'List of members which are set dynamically and \
missed by pylint inference system, and so shouldn\'t trigger E1101 when \
accessed. Python regular expressions are accepted.'}
               ),
               ('contextmanager-decorators',
                {'default': ['contextlib.contextmanager'],
                 'type': 'csv',
                 'metavar': '<decorator names>',
                 'help': 'List of decorators that produce context managers, '
                         'such as contextlib.contextmanager. Add to this list '
                         'to register other decorators that produce valid '
                         'context managers.'}
               ),
               ('missing-member-hint-distance',
                {'default': 1,
                 'type': 'int',
                 'metavar': '<member hint edit distance>',
                 'help': 'The minimum edit distance a name should have in order '
                         'to be considered a similar match for a missing member name.'
                }
               ),
               ('missing-member-max-choices',
                {'default': 1,
                 'type': "int",
                 'metavar': '<member hint max choices>',
                 'help': 'The total number of similar names that should be taken in '
                         'consideration when showing a hint for a missing member.'
                }
               ),
               ('missing-member-hint',
                {'default': True,
                 'type': "yn",
                 'metavar': '<missing member hint>',
                 'help': 'Show a hint with possible names when a member name was not '
                         'found. The aspect of finding the hint is based on edit distance.'
                }
               ),
              )

    def open(self):
        # do this in open since config not fully initialized in __init__
        # generated_members may contain regular expressions
        # (surrounded by quote `"` and followed by a comma `,`)
        # REQUEST,aq_parent,"[a-zA-Z]+_set{1,2}"' =>
        # ('REQUEST', 'aq_parent', '[a-zA-Z]+_set{1,2}')
        if isinstance(self.config.generated_members, six.string_types):
            gen = shlex.shlex(self.config.generated_members)
            gen.whitespace += ','
            gen.wordchars += r'[]-+\.*?()|'
            self.config.generated_members = tuple(tok.strip('"') for tok in gen)

    @check_messages('invalid-metaclass')
    def visit_classdef(self, node):

        def _metaclass_name(metaclass):
            if isinstance(metaclass, (astroid.ClassDef, astroid.FunctionDef)):
                return metaclass.name
            return metaclass.as_string()

        metaclass = node.declared_metaclass()
        if not metaclass:
            return

        if isinstance(metaclass, astroid.FunctionDef):
            # Try to infer the result.
            metaclass = _infer_from_metaclass_constructor(node, metaclass)
            if not metaclass:
                # Don't do anything if we cannot infer the result.
                return

        if isinstance(metaclass, astroid.ClassDef):
            if _is_invalid_metaclass(metaclass):
                self.add_message('invalid-metaclass', node=node,
                                 args=(_metaclass_name(metaclass), ))
        else:
            self.add_message('invalid-metaclass', node=node,
                             args=(_metaclass_name(metaclass), ))

    def visit_assignattr(self, node):
        if isinstance(node.assign_type(), astroid.AugAssign):
            self.visit_attribute(node)

    def visit_delattr(self, node):
        self.visit_attribute(node)

    @check_messages('no-member')
    def visit_attribute(self, node):
        """check that the accessed attribute exists

        to avoid too much false positives for now, we'll consider the code as
        correct if a single of the inferred nodes has the accessed attribute.

        function/method, super call and metaclasses are ignored
        """
        for pattern in self.config.generated_members:
            # attribute is marked as generated, stop here
            if re.match(pattern, node.attrname):
                return
            if re.match(pattern, node.as_string()):
                return

        try:
            inferred = list(node.expr.infer())
        except exceptions.InferenceError:
            return

        # list of (node, nodename) which are missing the attribute
        missingattr = set()

        non_opaque_inference_results = [
            owner for owner in inferred
            if owner is not astroid.Uninferable
            and not isinstance(owner, astroid.nodes.Unknown)
        ]
        if (len(non_opaque_inference_results) != len(inferred)
                and self.config.ignore_on_opaque_inference):
            # There is an ambiguity in the inference. Since we can't
            # make sure that we won't emit a false positive, we just stop
            # whenever the inference returns an opaque inference object.
            return

        for owner in non_opaque_inference_results:
            name = getattr(owner, 'name', None)
            if _is_owner_ignored(owner, name, self.config.ignored_classes,
                                 self.config.ignored_modules):
                continue

            try:
                if not [n for n in owner.getattr(node.attrname)
                        if not isinstance(n.statement(), astroid.AugAssign)]:
                    missingattr.add((owner, name))
                    continue
            except AttributeError:
                # XXX method / function
                continue
            except exceptions.NotFoundError:
                # This can't be moved before the actual .getattr call,
                # because there can be more values inferred and we are
                # stopping after the first one which has the attribute in question.
                # The problem is that if the first one has the attribute,
                # but we continue to the next values which doesn't have the
                # attribute, then we'll have a false positive.
                # So call this only after the call has been made.
                if not _emit_no_member(node, owner, name,
                                       self.config.ignore_mixin_members):
                    continue
                missingattr.add((owner, name))
                continue
            # stop on the first found
            break
        else:
            # we have not found any node with the attributes, display the
            # message for infered nodes
            done = set()
            for owner, name in missingattr:
                if isinstance(owner, astroid.Instance):
                    actual = owner._proxied
                else:
                    actual = owner
                if actual in done:
                    continue
                done.add(actual)

                if self.config.missing_member_hint:
                    hint = _missing_member_hint(owner, node.attrname,
                                                self.config.missing_member_hint_distance,
                                                self.config.missing_member_max_choices)
                else:
                    hint = ""

                self.add_message('no-member', node=node,
                                 args=(owner.display_type(), name,
                                       node.attrname, hint),
                                 confidence=INFERENCE)

    @check_messages('assignment-from-no-return', 'assignment-from-none')
    def visit_assign(self, node):
        """check that if assigning to a function call, the function is
        possibly returning something valuable
        """
        if not isinstance(node.value, astroid.Call):
            return
        function_node = safe_infer(node.value.func)
        # skip class, generator and incomplete function definition
        if not (isinstance(function_node, astroid.FunctionDef) and
                function_node.root().fully_defined()):
            return
        if function_node.is_generator() \
               or function_node.is_abstract(pass_is_abstract=False):
            return
        returns = list(function_node.nodes_of_class(astroid.Return,
                                                    skip_klass=astroid.FunctionDef))
        if not returns:
            self.add_message('assignment-from-no-return', node=node)
        else:
            for rnode in returns:
                if not (isinstance(rnode.value, astroid.Const)
                        and rnode.value.value is None
                        or rnode.value is None):
                    break
            else:
                self.add_message('assignment-from-none', node=node)

    def _check_uninferable_callfunc(self, node):
        """
        Check that the given uninferable CallFunc node does not
        call an actual function.
        """
        if not isinstance(node.func, astroid.Attribute):
            return

        # Look for properties. First, obtain
        # the lhs of the Getattr node and search the attribute
        # there. If that attribute is a property or a subclass of properties,
        # then most likely it's not callable.

        # TODO: since astroid doesn't understand descriptors very well
        # we will not handle them here, right now.

        expr = node.func.expr
        klass = safe_infer(expr)
        if (klass is None or klass is astroid.YES or
                not isinstance(klass, astroid.Instance)):
            return

        try:
            attrs = klass._proxied.getattr(node.func.attrname)
        except exceptions.NotFoundError:
            return

        for attr in attrs:
            if attr is astroid.YES:
                continue
            if not isinstance(attr, astroid.FunctionDef):
                continue

            # Decorated, see if it is decorated with a property.
            # Also, check the returns and see if they are callable.
            if decorated_with_property(attr):
                if all(return_node.callable()
                       for return_node in attr.infer_call_result(node)):
                    continue
                else:
                    self.add_message('not-callable', node=node,
                                     args=node.func.as_string())
                    break

    @check_messages(*(list(MSGS.keys())))
    def visit_call(self, node):
        """check that called functions/methods are inferred to callable objects,
        and that the arguments passed to the function match the parameters in
        the inferred function's definition
        """
        # Build the set of keyword arguments, checking for duplicate keywords,
        # and count the positional arguments.
        call_site = astroid.arguments.CallSite.from_call(node)
        num_positional_args = len(call_site.positional_arguments)
        keyword_args = list(call_site.keyword_arguments.keys())

        # Determine if we don't have a context for our call and we use variadics.
        if isinstance(node.scope(), astroid.FunctionDef):
            has_no_context_positional_variadic = _no_context_variadic_positional(node)
            has_no_context_keywords_variadic = _no_context_variadic_keywords(node)
        else:
            has_no_context_positional_variadic = has_no_context_keywords_variadic = False

        called = safe_infer(node.func)
        # only function, generator and object defining __call__ are allowed
        if called and not called.callable():
            if isinstance(called, astroid.Instance) and not has_known_bases(called):
                # Don't emit if we can't make sure this object is callable.
                pass
            else:
                self.add_message('not-callable', node=node,
                                 args=node.func.as_string())

        self._check_uninferable_callfunc(node)

        try:
            called, implicit_args, callable_name = _determine_callable(called)
        except ValueError:
            # Any error occurred during determining the function type, most of
            # those errors are handled by different warnings.
            return

        num_positional_args += implicit_args
        if called.args.args is None:
            # Built-in functions have no argument information.
            return

        if len(called.argnames()) != len(set(called.argnames())):
            # Duplicate parameter name (see duplicate-argument).  We can't really
            # make sense of the function call in this case, so just return.
            return

        # Warn about duplicated keyword arguments, such as `f=24, **{'f': 24}`
        for keyword in call_site.duplicated_keywords:
            self.add_message('repeated-keyword',
                             node=node, args=(keyword, ))

        if call_site.has_invalid_arguments() or call_site.has_invalid_keywords():
            # Can't make sense of this.
            return

        # Analyze the list of formal parameters.
        num_mandatory_parameters = len(called.args.args) - len(called.args.defaults)
        parameters = []
        parameter_name_to_index = {}
        for i, arg in enumerate(called.args.args):
            if isinstance(arg, astroid.Tuple):
                name = None
                # Don't store any parameter names within the tuple, since those
                # are not assignable from keyword arguments.
            else:
                assert isinstance(arg, astroid.AssignName)
                # This occurs with:
                #    def f( (a), (b) ): pass
                name = arg.name
                parameter_name_to_index[name] = i
            if i >= num_mandatory_parameters:
                defval = called.args.defaults[i - num_mandatory_parameters]
            else:
                defval = None
            parameters.append([(name, defval), False])

        kwparams = {}
        for i, arg in enumerate(called.args.kwonlyargs):
            if isinstance(arg, astroid.Keyword):
                name = arg.arg
            else:
                assert isinstance(arg, astroid.AssignName)
                name = arg.name
            kwparams[name] = [called.args.kw_defaults[i], False]

        # Match the supplied arguments against the function parameters.

        # 1. Match the positional arguments.
        for i in range(num_positional_args):
            if i < len(parameters):
                parameters[i][1] = True
            elif called.args.vararg is not None:
                # The remaining positional arguments get assigned to the *args
                # parameter.
                break
            else:
                # Too many positional arguments.
                self.add_message('too-many-function-args',
                                 node=node, args=(callable_name,))
                break

        # 2. Match the keyword arguments.
        for keyword in keyword_args:
            if keyword in parameter_name_to_index:
                i = parameter_name_to_index[keyword]
                if parameters[i][1]:
                    # Duplicate definition of function parameter.

                    # Might be too hardcoded, but this can actually
                    # happen when using str.format and `self` is passed
                    # by keyword argument, as in `.format(self=self)`.
                    # It's perfectly valid to so, so we're just skipping
                    # it if that's the case.
                    if not (keyword == 'self' and called.qname() == STR_FORMAT):
                        self.add_message('redundant-keyword-arg',
                                         node=node, args=(keyword, callable_name))
                else:
                    parameters[i][1] = True
            elif keyword in kwparams:
                if kwparams[keyword][1]:  # XXX is that even possible?
                    # Duplicate definition of function parameter.
                    self.add_message('redundant-keyword-arg', node=node,
                                     args=(keyword, callable_name))
                else:
                    kwparams[keyword][1] = True
            elif called.args.kwarg is not None:
                # The keyword argument gets assigned to the **kwargs parameter.
                pass
            else:
                # Unexpected keyword argument.
                self.add_message('unexpected-keyword-arg', node=node,
                                 args=(keyword, callable_name))

        # 3. Match the **kwargs, if any.
        if node.kwargs:
            for i, [(name, defval), assigned] in enumerate(parameters):
                # Assume that *kwargs provides values for all remaining
                # unassigned named parameters.
                if name is not None:
                    parameters[i][1] = True
                else:
                    # **kwargs can't assign to tuples.
                    pass

        # Check that any parameters without a default have been assigned
        # values.
        for [(name, defval), assigned] in parameters:
            if (defval is None) and not assigned:
                if name is None:
                    display_name = '<tuple>'
                else:
                    display_name = repr(name)
                # TODO(cpopa): this should be removed after PyCQA/astroid/issues/177
                if not has_no_context_positional_variadic:
                    self.add_message('no-value-for-parameter', node=node,
                                     args=(display_name, callable_name))

        for name in kwparams:
            defval, assigned = kwparams[name]
            if defval is None and not assigned and not has_no_context_keywords_variadic:
                self.add_message('missing-kwoa', node=node,
                                 args=(name, callable_name))

    @check_messages('invalid-sequence-index')
    def visit_extslice(self, node):
        # Check extended slice objects as if they were used as a sequence
        # index to check if the object being sliced can support them
        return self.visit_index(node)

    @check_messages('invalid-sequence-index')
    def visit_index(self, node):
        if not node.parent or not hasattr(node.parent, "value"):
            return
        # Look for index operations where the parent is a sequence type.
        # If the types can be determined, only allow indices to be int,
        # slice or instances with __index__.
        parent_type = safe_infer(node.parent.value)
        if not isinstance(parent_type, (astroid.ClassDef, astroid.Instance)):
            return
        if not has_known_bases(parent_type):
            return

        # Determine what method on the parent this index will use
        # The parent of this node will be a Subscript, and the parent of that
        # node determines if the Subscript is a get, set, or delete operation.
        if node.parent.ctx is astroid.Store:
            methodname = '__setitem__'
        elif node.parent.ctx is astroid.Del:
            methodname = '__delitem__'
        else:
            methodname = '__getitem__'

        # Check if this instance's __getitem__, __setitem__, or __delitem__, as
        # appropriate to the statement, is implemented in a builtin sequence
        # type. This way we catch subclasses of sequence types but skip classes
        # that override __getitem__ and which may allow non-integer indices.
        try:
            methods = dunder_lookup.lookup(parent_type, methodname)
            if methods is astroid.YES:
                return
            itemmethod = methods[0]
        except (exceptions.NotFoundError,
                exceptions.AttributeInferenceError,
                IndexError):
            return
        if not isinstance(itemmethod, astroid.FunctionDef):
            return
        if itemmethod.root().name != BUILTINS:
            return
        if not itemmethod.parent:
            return
        if itemmethod.parent.name not in SEQUENCE_TYPES:
            return

        # For ExtSlice objects coming from visit_extslice, no further
        # inference is necessary, since if we got this far the ExtSlice
        # is an error.
        if isinstance(node, astroid.ExtSlice):
            index_type = node
        else:
            index_type = safe_infer(node)
        if index_type is None or index_type is astroid.YES:
            return
        # Constants must be of type int
        if isinstance(index_type, astroid.Const):
            if isinstance(index_type.value, int):
                return
        # Instance values must be int, slice, or have an __index__ method
        elif isinstance(index_type, astroid.Instance):
            if index_type.pytype() in (BUILTINS + '.int', BUILTINS + '.slice'):
                return
            try:
                index_type.getattr('__index__')
                return
            except exceptions.NotFoundError:
                pass
        elif isinstance(index_type, astroid.Slice):
            # Delegate to visit_slice. A slice can be present
            # here after inferring the index node, which could
            # be a `slice(...)` call for instance.
            return self.visit_slice(index_type)

        # Anything else is an error
        self.add_message('invalid-sequence-index', node=node)

    @check_messages('invalid-slice-index')
    def visit_slice(self, node):
        # Check the type of each part of the slice
        for index in (node.lower, node.upper, node.step):
            if index is None:
                continue

            index_type = safe_infer(index)
            if index_type is None or index_type is astroid.YES:
                continue

            # Constants must of type int or None
            if isinstance(index_type, astroid.Const):
                if isinstance(index_type.value, (int, type(None))):
                    continue
            # Instance values must be of type int, None or an object
            # with __index__
            elif isinstance(index_type, astroid.Instance):
                if index_type.pytype() in (BUILTINS + '.int',
                                           BUILTINS + '.NoneType'):
                    continue

                try:
                    index_type.getattr('__index__')
                    return
                except exceptions.NotFoundError:
                    pass

            # Anything else is an error
            self.add_message('invalid-slice-index', node=node)

    @check_messages('not-context-manager')
    def visit_with(self, node):
        for ctx_mgr, _ in node.items:
            context = astroid.context.InferenceContext()
            infered = safe_infer(ctx_mgr, context=context)
            if infered is None or infered is astroid.YES:
                continue

            if isinstance(infered, bases.Generator):
                # Check if we are dealing with a function decorated
                # with contextlib.contextmanager.
                if decorated_with(infered.parent,
                                  self.config.contextmanager_decorators):
                    continue
                # If the parent of the generator is not the context manager itself,
                # that means that it could have been returned from another
                # function which was the real context manager.
                # The following approach is more of a hack rather than a real
                # solution: walk all the inferred statements for the
                # given *ctx_mgr* and if you find one function scope
                # which is decorated, consider it to be the real
                # manager and give up, otherwise emit not-context-manager.
                # See the test file for not_context_manager for a couple
                # of self explaining tests.
                for path in six.moves.filter(None, _unflatten(context.path)):
                    scope = path.scope()
                    if not isinstance(scope, astroid.FunctionDef):
                        continue
                    if decorated_with(scope,
                                      self.config.contextmanager_decorators):
                        break
                else:
                    self.add_message('not-context-manager',
                                     node=node, args=(infered.name, ))
            else:
                try:
                    infered.getattr('__enter__')
                    infered.getattr('__exit__')
                except exceptions.NotFoundError:
                    if isinstance(infered, astroid.Instance):
                        # If we do not know the bases of this class,
                        # just skip it.
                        if not has_known_bases(infered):
                            continue
                        # Just ignore mixin classes.
                        if self.config.ignore_mixin_members:
                            if infered.name[-5:].lower() == 'mixin':
                                continue

                    self.add_message('not-context-manager',
                                     node=node, args=(infered.name, ))

    @check_messages('invalid-unary-operand-type')
    def visit_unaryop(self, node):
        """Detect TypeErrors for unary operands."""

        for error in node.type_errors():
            # Let the error customize its output.
            self.add_message('invalid-unary-operand-type',
                             args=str(error), node=node)

    @check_messages('unsupported-binary-operation')
    def _visit_binop(self, node):
        """Detect TypeErrors for binary arithmetic operands."""
        self._check_binop_errors(node)

    @check_messages('unsupported-binary-operation')
    def _visit_augassign(self, node):
        """Detect TypeErrors for augmented binary arithmetic operands."""
        self._check_binop_errors(node)

    def _check_binop_errors(self, node):
        for error in node.type_errors():
            # Let the error customize its output.
            if any(isinstance(obj, astroid.ClassDef) and not has_known_bases(obj)
                   for obj in (error.left_type, error.right_type)):
                continue
            self.add_message('unsupported-binary-operation',
                             args=str(error), node=node)

    def _check_membership_test(self, node):
        if is_inside_abstract_class(node):
            return
        if is_comprehension(node):
            return
        infered = safe_infer(node)
        if infered is None or infered is astroid.YES:
            return
        if not supports_membership_test(infered):
            self.add_message('unsupported-membership-test',
                             args=node.as_string(),
                             node=node)

    @check_messages('unsupported-membership-test')
    def visit_compare(self, node):
        if len(node.ops) != 1:
            return

        op, right = node.ops[0]
        if op in ['in', 'not in']:
            self._check_membership_test(right)

    @check_messages('unsubscriptable-object', 'unsupported-assignment-operation',
                    'unsupported-delete-operation')
    def visit_subscript(self, node):
        supported_protocol = None
        if isinstance(node.value, (astroid.ListComp, astroid.DictComp)):
            return

        if node.ctx == astroid.Load:
            supported_protocol = supports_getitem
            msg = 'unsubscriptable-object'
        elif node.ctx == astroid.Store:
            supported_protocol = supports_setitem
            msg = 'unsupported-assignment-operation'
        elif node.ctx == astroid.Del:
            supported_protocol = supports_delitem
            msg = 'unsupported-delete-operation'

        if isinstance(node.value, astroid.SetComp):
            self.add_message(msg, args=node.value.as_string(),
                             node=node.value)
            return

        if is_inside_abstract_class(node):
            return

        inferred = safe_infer(node.value)
        if inferred is None or inferred is astroid.YES:
            return

        if not supported_protocol(inferred):
            self.add_message(msg, args=node.value.as_string(), node=node.value)


class IterableChecker(BaseChecker):
    """
    Checks for non-iterables used in an iterable context.
    Contexts include:
    - for-statement
    - starargs in function call
    - `yield from`-statement
    - list, dict and set comprehensions
    - generator expressions
    Also checks for non-mappings in function call kwargs.
    """

    __implements__ = (IAstroidChecker,)
    name = 'iterable_check'

    msgs = {'E1133': ('Non-iterable value %s is used in an iterating context',
                      'not-an-iterable',
                      'Used when a non-iterable value is used in place where '
                      'iterable is expected'),
            'E1134': ('Non-mapping value %s is used in a mapping context',
                      'not-a-mapping',
                      'Used when a non-mapping value is used in place where '
                      'mapping is expected'),
           }

    def _check_iterable(self, node):
        if is_inside_abstract_class(node):
            return
        if is_comprehension(node):
            return
        infered = safe_infer(node)
        if infered is None or infered is astroid.YES:
            return
        if not is_iterable(infered):
            self.add_message('not-an-iterable',
                             args=node.as_string(),
                             node=node)

    def _check_mapping(self, node):
        if is_inside_abstract_class(node):
            return
        if isinstance(node, astroid.DictComp):
            return
        infered = safe_infer(node)
        if infered is None or infered is astroid.YES:
            return
        if not is_mapping(infered):
            self.add_message('not-a-mapping',
                             args=node.as_string(),
                             node=node)

    @check_messages('not-an-iterable')
    def visit_for(self, node):
        self._check_iterable(node.iter)

    @check_messages('not-an-iterable')
    def visit_yieldfrom(self, node):
        self._check_iterable(node.value)

    @check_messages('not-an-iterable', 'not-a-mapping')
    def visit_call(self, node):
        for stararg in node.starargs:
            self._check_iterable(stararg.value)
        for kwarg in node.kwargs:
            self._check_mapping(kwarg.value)

    @check_messages('not-an-iterable')
    def visit_listcomp(self, node):
        for gen in node.generators:
            self._check_iterable(gen.iter)

    @check_messages('not-an-iterable')
    def visit_dictcomp(self, node):
        for gen in node.generators:
            self._check_iterable(gen.iter)

    @check_messages('not-an-iterable')
    def visit_setcomp(self, node):
        for gen in node.generators:
            self._check_iterable(gen.iter)

    @check_messages('not-an-iterable')
    def visit_generatorexp(self, node):
        for gen in node.generators:
            self._check_iterable(gen.iter)


def register(linter):
    """required method to auto register this checker """
    linter.register_checker(TypeChecker(linter))
    linter.register_checker(IterableChecker(linter))
