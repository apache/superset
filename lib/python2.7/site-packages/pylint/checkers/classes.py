# -*- coding: utf-8 -*-
# Copyright (c) 2006-2016 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2012, 2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Dmitry Pribysh <dmand@yandex.ru>
# Copyright (c) 2016 Moises Lopez - https://www.vauxoo.com/ <moylop260@vauxoo.com>
# Copyright (c) 2016 Łukasz Rogalski <rogalski.91@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""classes checker for Python code
"""
from __future__ import generators

import collections
import sys

import six

import astroid
from astroid.bases import Generator, BUILTINS
from astroid.exceptions import InconsistentMroError, DuplicateBasesError
from astroid import decorators
from astroid import objects
from astroid.scoped_nodes import function_to_method
from pylint.interfaces import IAstroidChecker
from pylint.checkers import BaseChecker
from pylint.checkers.utils import (
    PYMETHODS, SPECIAL_METHODS_PARAMS,
    overrides_a_method, check_messages, is_attr_private,
    is_attr_protected, node_frame_class, is_builtin_object,
    decorated_with_property, unimplemented_abstract_methods,
    decorated_with, class_is_abstract,
    safe_infer, has_known_bases, is_iterable, is_comprehension)
from pylint.utils import get_global_option


if sys.version_info >= (3, 0):
    NEXT_METHOD = '__next__'
else:
    NEXT_METHOD = 'next'
INVALID_BASE_CLASSES = {'bool', 'range', 'slice', 'memoryview'}


# Dealing with useless override detection, with regard
# to parameters vs arguments

_CallSignature = collections.namedtuple(
    '_CallSignature', 'args kws starred_args starred_kws')
_ParameterSignature = collections.namedtuple(
    '_ParameterSignature',
    'args kwonlyargs varargs kwargs',
)


def _signature_from_call(call):
    kws = {}
    args = []
    starred_kws = []
    starred_args = []
    for keyword in call.keywords or []:
        arg, value = keyword.arg, keyword.value
        if arg is None and isinstance(value, astroid.Name):
            # Starred node and we are interested only in names,
            # otherwise some transformation might occur for the parameter.
            starred_kws.append(value.name)
        elif isinstance(value, astroid.Name):
            kws[arg] = value.name
        else:
            kws[arg] = None

    for arg in call.args:
        if isinstance(arg, astroid.Starred) and isinstance(arg.value, astroid.Name):
            # Positional variadic and a name, otherwise some transformation
            # might have occurred.
            starred_args.append(arg.value.name)
        elif isinstance(arg, astroid.Name):
            args.append(arg.name)
        else:
            args.append(None)

    return _CallSignature(args, kws, starred_args, starred_kws)


def _signature_from_arguments(arguments):
    kwarg = arguments.kwarg
    vararg = arguments.vararg
    args = [arg.name for arg in arguments.args if arg.name != 'self']
    kwonlyargs = [arg.name for arg in arguments.kwonlyargs]
    return _ParameterSignature(args, kwonlyargs, vararg, kwarg)


def _definition_equivalent_to_call(definition, call):
    '''Check if a definition signature is equivalent to a call.'''
    if definition.kwargs:
        same_kw_variadics = definition.kwargs in call.starred_kws
    else:
        same_kw_variadics = not call.starred_kws
    if definition.varargs:
        same_args_variadics = definition.varargs in call.starred_args
    else:
        same_args_variadics = not call.starred_args
    same_kwonlyargs = all(kw in call.kws for kw in definition.kwonlyargs)
    same_args = definition.args == call.args

    no_additional_kwarg_arguments = True
    if call.kws:
        for keyword in call.kws:
            is_arg = keyword in call.args
            is_kwonly = keyword in definition.kwonlyargs
            if not is_arg and not is_kwonly:
                # Maybe this argument goes into **kwargs,
                # or it is an extraneous argument.
                # In any case, the signature is different than
                # the call site, which stops our search.
                no_additional_kwarg_arguments = False
                break

    return all((
        same_args,
        same_kwonlyargs,
        same_args_variadics,
        same_kw_variadics,
        no_additional_kwarg_arguments,
    ))

# Deal with parameters overridding in two methods.

def _positional_parameters(method):
    positional = method.args.args
    if method.type in ('classmethod', 'method'):
        positional = positional[1:]
    return positional


def _has_different_parameters(original, overridden, dummy_parameter_regex):
    zipped = six.moves.zip_longest(original, overridden)
    for original_param, overridden_param in zipped:
        params = (original_param, overridden_param)
        if not all(params):
            return True

        names = [param.name for param in params]
        if any(map(dummy_parameter_regex.match, names)):
            continue
        if original_param.name != overridden_param.name:
            return True
    return False


def _different_parameters(original, overridden, dummy_parameter_regex):
    """Determine if the two methods have different parameters

    They are considered to have different parameters if:

       * they have different positional parameters, including different names

       * one of the methods is having variadics, while the other is not

       * they have different keyword only parameters.

    """
    original_parameters = _positional_parameters(original)
    overridden_parameters = _positional_parameters(overridden)

    different_positional = _has_different_parameters(
        original_parameters,
        overridden_parameters,
        dummy_parameter_regex)
    different_kwonly = _has_different_parameters(
        original.args.kwonlyargs,
        overridden.args.kwonlyargs,
        dummy_parameter_regex)
    if original.name in PYMETHODS:
        # Ignore the difference for special methods. If the parameter
        # numbers are different, then that is going to be caught by
        # unexpected-special-method-signature.
        # If the names are different, it doesn't matter, since they can't
        # be used as keyword arguments anyway.
        different_positional = different_kwonly = False

    # Both or none should have extra variadics, otherwise the method
    # loses or gains capabilities that are not reflected into the parent method,
    # leading to potential inconsistencies in the code.
    different_kwarg = sum(
        1 for param in (original.args.kwarg, overridden.args.kwarg)
        if not param) == 1
    different_vararg = sum(
        1 for param in (original.args.vararg, overridden.args.vararg)
        if not param) == 1

    return any((
        different_positional,
        different_kwarg,
        different_vararg,
        different_kwonly
    ))


def _is_invalid_base_class(cls):
    return cls.name in INVALID_BASE_CLASSES and is_builtin_object(cls)


def _has_data_descriptor(cls, attr):
    attributes = cls.getattr(attr)
    for attribute in attributes:
        try:
            for inferred in attribute.infer():
                if isinstance(inferred, astroid.Instance):
                    try:
                        inferred.getattr('__get__')
                        inferred.getattr('__set__')
                    except astroid.NotFoundError:
                        continue
                    else:
                        return True
        except astroid.InferenceError:
            # Can't infer, avoid emitting a false positive in this case.
            return True
    return False


def _called_in_methods(func, klass, methods):
    """ Check if the func was called in any of the given methods,
    belonging to the *klass*. Returns True if so, False otherwise.
    """
    if not isinstance(func, astroid.FunctionDef):
        return False
    for method in methods:
        try:
            infered = klass.getattr(method)
        except astroid.NotFoundError:
            continue
        for infer_method in infered:
            for callfunc in infer_method.nodes_of_class(astroid.Call):
                try:
                    bound = next(callfunc.func.infer())
                except (astroid.InferenceError, StopIteration):
                    continue
                if not isinstance(bound, astroid.BoundMethod):
                    continue
                func_obj = bound._proxied
                if isinstance(func_obj, astroid.UnboundMethod):
                    func_obj = func_obj._proxied
                if func_obj.name == func.name:
                    return True
    return False


def _is_attribute_property(name, klass):
    """ Check if the given attribute *name* is a property
    in the given *klass*.

    It will look for `property` calls or for functions
    with the given name, decorated by `property` or `property`
    subclasses.
    Returns ``True`` if the name is a property in the given klass,
    ``False`` otherwise.
    """

    try:
        attributes = klass.getattr(name)
    except astroid.NotFoundError:
        return False
    property_name = "{0}.property".format(BUILTINS)
    for attr in attributes:
        try:
            infered = next(attr.infer())
        except astroid.InferenceError:
            continue
        if (isinstance(infered, astroid.FunctionDef) and
                decorated_with_property(infered)):
            return True
        if infered.pytype() == property_name:
            return True
    return False


def _has_bare_super_call(fundef_node):
    for call in fundef_node.nodes_of_class(astroid.Call):
        func = call.func
        if (isinstance(func, astroid.Name) and
                func.name == 'super' and
                not call.args):
            return True
    return False


def _safe_infer_call_result(node, caller, context=None):
    """
    Safely infer the return value of a function.

    Returns None if inference failed or if there is some ambiguity (more than
    one node has been inferred). Otherwise returns infered value.
    """
    try:
        inferit = node.infer_call_result(caller, context=context)
        value = next(inferit)
    except astroid.InferenceError:
        return  # inference failed
    except StopIteration:
        return  # no values infered
    try:
        next(inferit)
        return  # there is ambiguity on the inferred node
    except astroid.InferenceError:
        return  # there is some kind of ambiguity
    except StopIteration:
        return value


MSGS = {
    'F0202': ('Unable to check methods signature (%s / %s)',
              'method-check-failed',
              'Used when Pylint has been unable to check methods signature '
              'compatibility for an unexpected reason. Please report this kind '
              'if you don\'t make sense of it.'),

    'E0202': ('An attribute defined in %s line %s hides this method',
              'method-hidden',
              'Used when a class defines a method which is hidden by an '
              'instance attribute from an ancestor class or set by some '
              'client code.'),
    'E0203': ('Access to member %r before its definition line %s',
              'access-member-before-definition',
              'Used when an instance member is accessed before it\'s actually '
              'assigned.'),
    'W0201': ('Attribute %r defined outside __init__',
              'attribute-defined-outside-init',
              'Used when an instance attribute is defined outside the __init__ '
              'method.'),

    'W0212': ('Access to a protected member %s of a client class', # E0214
              'protected-access',
              'Used when a protected member (i.e. class member with a name '
              'beginning with an underscore) is access outside the class or a '
              'descendant of the class where it\'s defined.'),

    'E0211': ('Method has no argument',
              'no-method-argument',
              'Used when a method which should have the bound instance as '
              'first argument has no argument defined.'),
    'E0213': ('Method should have "self" as first argument',
              'no-self-argument',
              'Used when a method has an attribute different the "self" as '
              'first argument. This is considered as an error since this is '
              'a so common convention that you shouldn\'t break it!'),
    'C0202': ('Class method %s should have %s as first argument',
              'bad-classmethod-argument',
              'Used when a class method has a first argument named differently '
              'than the value specified in valid-classmethod-first-arg option '
              '(default to "cls"), recommended to easily differentiate them '
              'from regular instance methods.'),
    'C0203': ('Metaclass method %s should have %s as first argument',
              'bad-mcs-method-argument',
              'Used when a metaclass method has a first argument named '
              'differently than the value specified in valid-classmethod-first'
              '-arg option (default to "cls"), recommended to easily '
              'differentiate them from regular instance methods.'),
    'C0204': ('Metaclass class method %s should have %s as first argument',
              'bad-mcs-classmethod-argument',
              'Used when a metaclass class method has a first argument named '
              'differently than the value specified in valid-metaclass-'
              'classmethod-first-arg option (default to "mcs"), recommended to '
              'easily differentiate them from regular instance methods.'),

    'W0211': ('Static method with %r as first argument',
              'bad-staticmethod-argument',
              'Used when a static method has "self" or a value specified in '
              'valid-classmethod-first-arg option or '
              'valid-metaclass-classmethod-first-arg option as first argument.'
             ),
    'R0201': ('Method could be a function',
              'no-self-use',
              'Used when a method doesn\'t use its bound instance, and so could '
              'be written as a function.'
             ),
    'W0221': ('Parameters differ from %s %r method',
              'arguments-differ',
              'Used when a method has a different number of arguments than in '
              'the implemented interface or in an overridden method.'),
    'W0222': ('Signature differs from %s %r method',
              'signature-differs',
              'Used when a method signature is different than in the '
              'implemented interface or in an overridden method.'),
    'W0223': ('Method %r is abstract in class %r but is not overridden',
              'abstract-method',
              'Used when an abstract method (i.e. raise NotImplementedError) is '
              'not overridden in concrete class.'
             ),
    'W0231': ('__init__ method from base class %r is not called',
              'super-init-not-called',
              'Used when an ancestor class method has an __init__ method '
              'which is not called by a derived class.'),
    'W0232': ('Class has no __init__ method',
              'no-init',
              'Used when a class has no __init__ method, neither its parent '
              'classes.'),
    'W0233': ('__init__ method from a non direct base class %r is called',
              'non-parent-init-called',
              'Used when an __init__ method is called on a class which is not '
              'in the direct ancestors for the analysed class.'),
    'W0235': ('Useless super delegation in method %r',
              'useless-super-delegation',
              'Used whenever we can detect that an overridden method is useless, '
              'relying on super() delegation to do the same thing as another method '
              'from the MRO.'),
    'E0236': ('Invalid object %r in __slots__, must contain '
              'only non empty strings',
              'invalid-slots-object',
              'Used when an invalid (non-string) object occurs in __slots__.'),
    'E0237': ('Assigning to attribute %r not defined in class slots',
              'assigning-non-slot',
              'Used when assigning to an attribute not defined '
              'in the class slots.'),
    'E0238': ('Invalid __slots__ object',
              'invalid-slots',
              'Used when an invalid __slots__ is found in class. '
              'Only a string, an iterable or a sequence is permitted.'),
    'E0239': ('Inheriting %r, which is not a class.',
              'inherit-non-class',
              'Used when a class inherits from something which is not a '
              'class.'),
    'E0240': ('Inconsistent method resolution order for class %r',
              'inconsistent-mro',
              'Used when a class has an inconsistent method resolution order.'),
    'E0241': ('Duplicate bases for class %r',
              'duplicate-bases',
              'Used when a class has duplicate bases.'),
    'R0202': ('Consider using a decorator instead of calling classmethod',
              'no-classmethod-decorator',
              'Used when a class method is defined without using the decorator '
              'syntax.'),
    'R0203': ('Consider using a decorator instead of calling staticmethod',
              'no-staticmethod-decorator',
              'Used when a static method is defined without using the decorator '
              'syntax.'),
    'C0205': ('Class __slots__ should be a non-string iterable',
              'single-string-used-for-slots',
              'Used when a class __slots__ is a simple string, rather '
              'than an iterable.'),
    }


class ScopeAccessMap(object):
    """Store the accessed variables per scope."""

    def __init__(self):
        self._scopes = collections.defaultdict(
            lambda: collections.defaultdict(list)
        )

    def set_accessed(self, node):
        """Set the given node as accessed."""

        frame = node_frame_class(node)
        if frame is None:
            # The node does not live in a class.
            return
        self._scopes[frame][node.attrname].append(node)

    def accessed(self, scope):
        """Get the accessed variables for the given scope."""
        return self._scopes.get(scope, {})


class ClassChecker(BaseChecker):
    """checks for :
    * methods without self as first argument
    * overridden methods signature
    * access only to existent members via self
    * attributes not defined in the __init__ method
    * unreachable code
    """

    __implements__ = (IAstroidChecker,)

    # configuration section name
    name = 'classes'
    # messages
    msgs = MSGS
    priority = -2
    # configuration options
    options = (('defining-attr-methods',
                {'default' : ('__init__', '__new__', 'setUp'),
                 'type' : 'csv',
                 'metavar' : '<method names>',
                 'help' : 'List of method names used to declare (i.e. assign) \
instance attributes.'}
               ),
               ('valid-classmethod-first-arg',
                {'default' : ('cls',),
                 'type' : 'csv',
                 'metavar' : '<argument names>',
                 'help' : 'List of valid names for the first argument in \
a class method.'}
               ),
               ('valid-metaclass-classmethod-first-arg',
                {'default' : ('mcs',),
                 'type' : 'csv',
                 'metavar' : '<argument names>',
                 'help' : 'List of valid names for the first argument in \
a metaclass class method.'}
               ),
               ('exclude-protected',
                {
                    'default': (
                        # namedtuple public API.
                        '_asdict', '_fields', '_replace', '_source', '_make'),
                    'type': 'csv',
                    'metavar': '<protected access exclusions>',
                    'help': ('List of member names, which should be excluded '
                             'from the protected access warning.')}
               ))

    def __init__(self, linter=None):
        BaseChecker.__init__(self, linter)
        self._accessed = ScopeAccessMap()
        self._first_attrs = []
        self._meth_could_be_func = None

    @decorators.cachedproperty
    def _dummy_rgx(self):
        return get_global_option(
            self, 'dummy-variables-rgx', default=None)

    @decorators.cachedproperty
    def _ignore_mixin(self):
        return get_global_option(
            self, 'ignore-mixin-members', default=True)

    def visit_classdef(self, node):
        """init visit variable _accessed
        """
        self._check_bases_classes(node)
        # if not an exception or a metaclass
        if node.type == 'class' and has_known_bases(node):
            try:
                node.local_attr('__init__')
            except astroid.NotFoundError:
                self.add_message('no-init', args=node, node=node)
        self._check_slots(node)
        self._check_proper_bases(node)
        self._check_consistent_mro(node)

    def _check_consistent_mro(self, node):
        """Detect that a class has a consistent mro or duplicate bases."""
        try:
            node.mro()
        except InconsistentMroError:
            self.add_message('inconsistent-mro', args=node.name, node=node)
        except DuplicateBasesError:
            self.add_message('duplicate-bases', args=node.name, node=node)
        except NotImplementedError:
            # Old style class, there's no mro so don't do anything.
            pass

    def _check_proper_bases(self, node):
        """
        Detect that a class inherits something which is not
        a class or a type.
        """
        for base in node.bases:
            ancestor = safe_infer(base)
            if ancestor in (astroid.YES, None):
                continue
            if (isinstance(ancestor, astroid.Instance) and
                    ancestor.is_subtype_of('%s.type' % (BUILTINS,))):
                continue

            if (not isinstance(ancestor, astroid.ClassDef) or
                    _is_invalid_base_class(ancestor)):
                self.add_message('inherit-non-class',
                                 args=base.as_string(), node=node)

    def leave_classdef(self, cnode):
        """close a class node:
        check that instance attributes are defined in __init__ and check
        access to existent members
        """
        # check access to existent members on non metaclass classes
        if self._ignore_mixin and cnode.name[-5:].lower() == 'mixin':
            # We are in a mixin class. No need to try to figure out if
            # something is missing, since it is most likely that it will
            # miss.
            return

        accessed = self._accessed.accessed(cnode)
        if cnode.type != 'metaclass':
            self._check_accessed_members(cnode, accessed)
        # checks attributes are defined in an allowed method such as __init__
        if not self.linter.is_message_enabled('attribute-defined-outside-init'):
            return
        defining_methods = self.config.defining_attr_methods
        current_module = cnode.root()
        for attr, nodes in six.iteritems(cnode.instance_attrs):
            # skip nodes which are not in the current module and it may screw up
            # the output, while it's not worth it
            nodes = [n for n in nodes if not
                     isinstance(n.statement(), (astroid.Delete, astroid.AugAssign))
                     and n.root() is current_module]
            if not nodes:
                continue # error detected by typechecking
            # check if any method attr is defined in is a defining method
            if any(node.frame().name in defining_methods
                   for node in nodes):
                continue

            # check attribute is defined in a parent's __init__
            for parent in cnode.instance_attr_ancestors(attr):
                attr_defined = False
                # check if any parent method attr is defined in is a defining method
                for node in parent.instance_attrs[attr]:
                    if node.frame().name in defining_methods:
                        attr_defined = True
                if attr_defined:
                    # we're done :)
                    break
            else:
                # check attribute is defined as a class attribute
                try:
                    cnode.local_attr(attr)
                except astroid.NotFoundError:
                    for node in nodes:
                        if node.frame().name not in defining_methods:
                            # If the attribute was set by a callfunc in any
                            # of the defining methods, then don't emit
                            # the warning.
                            if _called_in_methods(node.frame(), cnode,
                                                  defining_methods):
                                continue
                            self.add_message('attribute-defined-outside-init',
                                             args=attr, node=node)

    def visit_functiondef(self, node):
        """check method arguments, overriding"""
        # ignore actual functions
        if not node.is_method():
            return

        self._check_useless_super_delegation(node)

        klass = node.parent.frame()
        self._meth_could_be_func = True
        # check first argument is self if this is actually a method
        self._check_first_arg_for_type(node, klass.type == 'metaclass')
        if node.name == '__init__':
            self._check_init(node)
            return
        # check signature if the method overloads inherited method
        for overridden in klass.local_attr_ancestors(node.name):
            # get astroid for the searched method
            try:
                meth_node = overridden[node.name]
            except KeyError:
                # we have found the method but it's not in the local
                # dictionary.
                # This may happen with astroid build from living objects
                continue
            if not isinstance(meth_node, astroid.FunctionDef):
                continue
            self._check_signature(node, meth_node, 'overridden', klass)
            break
        if node.decorators:
            for decorator in node.decorators.nodes:
                if isinstance(decorator, astroid.Attribute) and \
                        decorator.attrname in ('getter', 'setter', 'deleter'):
                    # attribute affectation will call this method, not hiding it
                    return
                if isinstance(decorator, astroid.Name) and decorator.name == 'property':
                    # attribute affectation will either call a setter or raise
                    # an attribute error, anyway not hiding the function
                    return
        # check if the method is hidden by an attribute
        try:
            overridden = klass.instance_attr(node.name)[0] # XXX
            overridden_frame = overridden.frame()
            if (isinstance(overridden_frame, astroid.FunctionDef)
                    and overridden_frame.type == 'method'):
                overridden_frame = overridden_frame.parent.frame()
            if (isinstance(overridden_frame, astroid.ClassDef)
                    and klass.is_subtype_of(overridden_frame.qname())):
                args = (overridden.root().name, overridden.fromlineno)
                self.add_message('method-hidden', args=args, node=node)
        except astroid.NotFoundError:
            pass

    visit_asyncfunctiondef = visit_functiondef

    def _check_useless_super_delegation(self, function):
        '''Check if the given function node is an useless method override

        We consider it *useless* if it uses the super() builtin, but having
        nothing additional whatsoever than not implementing the method at all.
        If the method uses super() to delegate an operation to the rest of the MRO,
        and if the method called is the same as the current one, the arguments
        passed to super() are the same as the parameters that were passed to
        this method, then the method could be removed altogether, by letting
        other implementation to take precedence.
        '''

        if not function.is_method():
            return

        if function.decorators:
            # With decorators is a change of use
            return

        body = function.body
        if len(body) != 1:
            # Multiple statements, which means this overridden method
            # could do multiple things we are not aware of.
            return

        statement = body[0]
        if not isinstance(statement, (astroid.Expr, astroid.Return)):
            # Doing something else than what we are interested into.
            return

        call = statement.value
        if not isinstance(call, astroid.Call):
            return
        if not isinstance(call.func, astroid.Attribute):
            # Not a super() attribute access.
            return

        # Should be a super call.
        try:
            super_call = next(call.func.expr.infer())
        except astroid.InferenceError:
            return
        else:
            if not isinstance(super_call, objects.Super):
                return

        # The name should be the same.
        if call.func.attrname != function.name:
            return

        # Should be a super call with the MRO pointer being the current class
        # and the type being the current instance.
        current_scope = function.parent.scope()
        if super_call.mro_pointer != current_scope:
            return
        if not isinstance(super_call.type, astroid.Instance):
            return
        if super_call.type.name != current_scope.name:
            return

        # Detect if the parameters are the same as the call's arguments.
        params = _signature_from_arguments(function.args)
        args = _signature_from_call(call)
        if _definition_equivalent_to_call(params, args):
            self.add_message('useless-super-delegation', node=function,
                             args=(function.name, ))

    def _check_slots(self, node):
        if '__slots__' not in node.locals:
            return
        for slots in node.igetattr('__slots__'):
            # check if __slots__ is a valid type
            if slots is astroid.YES:
                continue
            if not is_iterable(slots) and not is_comprehension(slots):
                self.add_message('invalid-slots', node=node)
                continue

            if isinstance(slots, astroid.Const):
                # a string, ignore the following checks
                self.add_message('single-string-used-for-slots', node=node)
                continue
            if not hasattr(slots, 'itered'):
                # we can't obtain the values, maybe a .deque?
                continue

            if isinstance(slots, astroid.Dict):
                values = [item[0] for item in slots.items]
            else:
                values = slots.itered()
            if values is astroid.YES:
                return

            for elt in values:
                try:
                    self._check_slots_elt(elt)
                except astroid.InferenceError:
                    continue

    def _check_slots_elt(self, elt):
        for infered in elt.infer():
            if infered is astroid.YES:
                continue
            if (not isinstance(infered, astroid.Const) or
                    not isinstance(infered.value, six.string_types)):
                self.add_message('invalid-slots-object',
                                 args=infered.as_string(),
                                 node=elt)
                continue
            if not infered.value:
                self.add_message('invalid-slots-object',
                                 args=infered.as_string(),
                                 node=elt)

    def leave_functiondef(self, node):
        """on method node, check if this method couldn't be a function

        ignore class, static and abstract methods, initializer,
        methods overridden from a parent class.
        """
        if node.is_method():
            if node.args.args is not None:
                self._first_attrs.pop()
            if not self.linter.is_message_enabled('no-self-use'):
                return
            class_node = node.parent.frame()
            if (self._meth_could_be_func and node.type == 'method'
                    and node.name not in PYMETHODS
                    and not (node.is_abstract() or
                             overrides_a_method(class_node, node.name) or
                             decorated_with_property(node) or
                             (six.PY3 and _has_bare_super_call(node)))):
                self.add_message('no-self-use', node=node)

    def visit_attribute(self, node):
        """check if the getattr is an access to a class member
        if so, register it. Also check for access to protected
        class member from outside its class (but ignore __special__
        methods)
        """
        # Check self
        if self._uses_mandatory_method_param(node):
            self._accessed.set_accessed(node)
            return
        if not self.linter.is_message_enabled('protected-access'):
            return

        self._check_protected_attribute_access(node)

    def visit_assignattr(self, node):
        if (isinstance(node.assign_type(), astroid.AugAssign) and
                self._uses_mandatory_method_param(node)):
            self._accessed.set_accessed(node)
        self._check_in_slots(node)

    def _check_in_slots(self, node):
        """ Check that the given assattr node
        is defined in the class slots.
        """
        infered = safe_infer(node.expr)
        if infered and isinstance(infered, astroid.Instance):
            klass = infered._proxied
            if '__slots__' not in klass.locals or not klass.newstyle:
                return

            slots = klass.slots()
            if slots is None:
                return
            # If any ancestor doesn't use slots, the slots
            # defined for this class are superfluous.
            if any('__slots__' not in ancestor.locals and
                   ancestor.name != 'object'
                   for ancestor in klass.ancestors()):
                return

            if not any(slot.value == node.attrname for slot in slots):
                # If we have a '__dict__' in slots, then
                # assigning any name is valid.
                if not any(slot.value == '__dict__' for slot in slots):
                    if _is_attribute_property(node.attrname, klass):
                        # Properties circumvent the slots mechanism,
                        # so we should not emit a warning for them.
                        return
                    if (node.attrname in klass.locals
                            and _has_data_descriptor(klass, node.attrname)):
                        # Descriptors circumvent the slots mechanism as well.
                        return
                    self.add_message('assigning-non-slot',
                                     args=(node.attrname, ), node=node)

    @check_messages('protected-access', 'no-classmethod-decorator',
                    'no-staticmethod-decorator')
    def visit_assign(self, assign_node):
        self._check_classmethod_declaration(assign_node)
        node = assign_node.targets[0]
        if not isinstance(node, astroid.AssignAttr):
            return

        if self._uses_mandatory_method_param(node):
            return
        self._check_protected_attribute_access(node)

    def _check_classmethod_declaration(self, node):
        """Checks for uses of classmethod() or staticmethod()

        When a @classmethod or @staticmethod decorator should be used instead.
        A message will be emitted only if the assignment is at a class scope
        and only if the classmethod's argument belongs to the class where it
        is defined.
        `node` is an assign node.
        """
        if not isinstance(node.value, astroid.Call):
            return

        # check the function called is "classmethod" or "staticmethod"
        func = node.value.func
        if (not isinstance(func, astroid.Name) or
                func.name not in ('classmethod', 'staticmethod')):
            return

        msg = ('no-classmethod-decorator' if func.name == 'classmethod' else
               'no-staticmethod-decorator')
        # assignment must be at a class scope
        parent_class = node.scope()
        if not isinstance(parent_class, astroid.ClassDef):
            return

        # Check if the arg passed to classmethod is a class member
        classmeth_arg = node.value.args[0]
        if not isinstance(classmeth_arg, astroid.Name):
            return

        method_name = classmeth_arg.name
        if any(method_name == member.name
               for member in parent_class.mymethods()):
            self.add_message(msg, node=node.targets[0])

    def _check_protected_attribute_access(self, node):
        '''Given an attribute access node (set or get), check if attribute
        access is legitimate. Call _check_first_attr with node before calling
        this method. Valid cases are:
        * self._attr in a method or cls._attr in a classmethod. Checked by
        _check_first_attr.
        * Klass._attr inside "Klass" class.
        * Klass2._attr inside "Klass" class when Klass2 is a base class of
            Klass.
        '''
        attrname = node.attrname

        if (is_attr_protected(attrname) and
                attrname not in self.config.exclude_protected):

            klass = node_frame_class(node)

            # XXX infer to be more safe and less dirty ??
            # in classes, check we are not getting a parent method
            # through the class object or through super
            callee = node.expr.as_string()

            # We are not in a class, no remaining valid case
            if klass is None:
                self.add_message('protected-access', node=node, args=attrname)
                return

            # If the expression begins with a call to super, that's ok.
            if isinstance(node.expr, astroid.Call) and \
               isinstance(node.expr.func, astroid.Name) and \
               node.expr.func.name == 'super':
                return

            # If the expression begins with a call to type(self), that's ok.
            if self._is_type_self_call(node.expr):
                return

            # We are in a class, one remaining valid cases, Klass._attr inside
            # Klass
            if not (callee == klass.name or callee in klass.basenames):
                # Detect property assignments in the body of the class.
                # This is acceptable:
                #
                # class A:
                #     b = property(lambda: self._b)

                stmt = node.parent.statement()
                if (isinstance(stmt, astroid.Assign)
                        and len(stmt.targets) == 1
                        and isinstance(stmt.targets[0], astroid.AssignName)):
                    name = stmt.targets[0].name
                    if _is_attribute_property(name, klass):
                        return

                self.add_message('protected-access', node=node, args=attrname)

    def _is_type_self_call(self, expr):
        return (isinstance(expr, astroid.Call) and
                isinstance(expr.func, astroid.Name) and
                expr.func.name == 'type' and len(expr.args) == 1 and
                self._is_mandatory_method_param(expr.args[0]))

    def visit_name(self, node):
        """check if the name handle an access to a class member
        if so, register it
        """
        if self._first_attrs and (node.name == self._first_attrs[-1] or
                                  not self._first_attrs[-1]):
            self._meth_could_be_func = False

    def _check_accessed_members(self, node, accessed):
        """check that accessed members are defined"""
        # XXX refactor, probably much simpler now that E0201 is in type checker
        excs = ('AttributeError', 'Exception', 'BaseException')
        for attr, nodes in six.iteritems(accessed):
            try:
                # is it a class attribute ?
                node.local_attr(attr)
                # yes, stop here
                continue
            except astroid.NotFoundError:
                pass
            # is it an instance attribute of a parent class ?
            try:
                next(node.instance_attr_ancestors(attr))
                # yes, stop here
                continue
            except StopIteration:
                pass
            # is it an instance attribute ?
            try:
                defstmts = node.instance_attr(attr)
            except astroid.NotFoundError:
                pass
            else:
                # filter out augment assignment nodes
                defstmts = [stmt for stmt in defstmts if stmt not in nodes]
                if not defstmts:
                    # only augment assignment for this node, no-member should be
                    # triggered by the typecheck checker
                    continue
                # filter defstmts to only pick the first one when there are
                # several assignments in the same scope
                scope = defstmts[0].scope()
                defstmts = [stmt for i, stmt in enumerate(defstmts)
                            if i == 0 or stmt.scope() is not scope]
                # if there are still more than one, don't attempt to be smarter
                # than we can be
                if len(defstmts) == 1:
                    defstmt = defstmts[0]
                    # check that if the node is accessed in the same method as
                    # it's defined, it's accessed after the initial assignment
                    frame = defstmt.frame()
                    lno = defstmt.fromlineno
                    for _node in nodes:
                        if _node.frame() is frame and _node.fromlineno < lno \
                           and not astroid.are_exclusive(_node.statement(), defstmt, excs):
                            self.add_message('access-member-before-definition',
                                             node=_node, args=(attr, lno))

    def _check_first_arg_for_type(self, node, metaclass=0):
        """check the name of first argument, expect:

        * 'self' for a regular method
        * 'cls' for a class method or a metaclass regular method (actually
          valid-classmethod-first-arg value)
        * 'mcs' for a metaclass class method (actually
          valid-metaclass-classmethod-first-arg)
        * not one of the above for a static method
        """
        # don't care about functions with unknown argument (builtins)
        if node.args.args is None:
            return
        first_arg = node.args.args and node.argnames()[0]
        self._first_attrs.append(first_arg)
        first = self._first_attrs[-1]
        # static method
        if node.type == 'staticmethod':
            if (first_arg == 'self' or
                    first_arg in self.config.valid_classmethod_first_arg or
                    first_arg in self.config.valid_metaclass_classmethod_first_arg):
                self.add_message('bad-staticmethod-argument', args=first, node=node)
                return
            self._first_attrs[-1] = None
        # class / regular method with no args
        elif not node.args.args:
            self.add_message('no-method-argument', node=node)
        # metaclass
        elif metaclass:
            # metaclass __new__ or classmethod
            if node.type == 'classmethod':
                self._check_first_arg_config(
                    first,
                    self.config.valid_metaclass_classmethod_first_arg, node,
                    'bad-mcs-classmethod-argument', node.name)
            # metaclass regular method
            else:
                self._check_first_arg_config(
                    first,
                    self.config.valid_classmethod_first_arg, node,
                    'bad-mcs-method-argument',
                    node.name)
        # regular class
        else:
            # class method
            if node.type == 'classmethod':
                self._check_first_arg_config(
                    first,
                    self.config.valid_classmethod_first_arg, node,
                    'bad-classmethod-argument',
                    node.name)
            # regular method without self as argument
            elif first != 'self':
                self.add_message('no-self-argument', node=node)

    def _check_first_arg_config(self, first, config, node, message,
                                method_name):
        if first not in config:
            if len(config) == 1:
                valid = repr(config[0])
            else:
                valid = ', '.join(repr(v) for v in config[:-1])
                valid = '%s or %r' % (valid, config[-1])
            self.add_message(message, args=(method_name, valid), node=node)

    def _check_bases_classes(self, node):
        """check that the given class node implements abstract methods from
        base classes
        """
        def is_abstract(method):
            return method.is_abstract(pass_is_abstract=False)

        # check if this class abstract
        if class_is_abstract(node):
            return

        methods = sorted(
            unimplemented_abstract_methods(node, is_abstract).items(),
            key=lambda item: item[0],
        )
        for name, method in methods:
            owner = method.parent.frame()
            if owner is node:
                continue
            # owner is not this class, it must be a parent class
            # check that the ancestor's method is not abstract
            if name in node.locals:
                # it is redefined as an attribute or with a descriptor
                continue
            self.add_message('abstract-method', node=node,
                             args=(name, owner.name))

    def _check_init(self, node):
        """check that the __init__ method call super or ancestors'__init__
        method
        """
        if (not self.linter.is_message_enabled('super-init-not-called') and
                not self.linter.is_message_enabled('non-parent-init-called')):
            return
        klass_node = node.parent.frame()
        to_call = _ancestors_to_call(klass_node)
        not_called_yet = dict(to_call)
        for stmt in node.nodes_of_class(astroid.Call):
            expr = stmt.func
            if not isinstance(expr, astroid.Attribute) \
                   or expr.attrname != '__init__':
                continue
            # skip the test if using super
            if isinstance(expr.expr, astroid.Call) and \
                   isinstance(expr.expr.func, astroid.Name) and \
               expr.expr.func.name == 'super':
                return
            try:
                for klass in expr.expr.infer():
                    if klass is astroid.YES:
                        continue
                    # The infered klass can be super(), which was
                    # assigned to a variable and the `__init__`
                    # was called later.
                    #
                    # base = super()
                    # base.__init__(...)

                    if (isinstance(klass, astroid.Instance) and
                            isinstance(klass._proxied, astroid.ClassDef) and
                            is_builtin_object(klass._proxied) and
                            klass._proxied.name == 'super'):
                        return
                    elif isinstance(klass, objects.Super):
                        return
                    try:
                        del not_called_yet[klass]
                    except KeyError:
                        if klass not in to_call:
                            self.add_message('non-parent-init-called',
                                             node=expr, args=klass.name)
            except astroid.InferenceError:
                continue
        for klass, method in six.iteritems(not_called_yet):
            cls = node_frame_class(method)
            if klass.name == 'object' or (cls and cls.name == 'object'):
                continue
            self.add_message('super-init-not-called', args=klass.name, node=node)

    def _check_signature(self, method1, refmethod, class_type, cls):
        """check that the signature of the two given methods match
        """
        if not (isinstance(method1, astroid.FunctionDef)
                and isinstance(refmethod, astroid.FunctionDef)):
            self.add_message('method-check-failed',
                             args=(method1, refmethod), node=method1)
            return

        instance = cls.instantiate_class()
        method1 = function_to_method(method1, instance)
        refmethod = function_to_method(refmethod, instance)

        # Don't care about functions with unknown argument (builtins).
        if method1.args.args is None or refmethod.args.args is None:
            return

        # Ignore private to class methods.
        if is_attr_private(method1.name):
            return
        # Ignore setters, they have an implicit extra argument,
        # which shouldn't be taken in consideration.
        if method1.decorators:
            for decorator in method1.decorators.nodes:
                if (isinstance(decorator, astroid.Attribute) and
                        decorator.attrname == 'setter'):
                    return

        if _different_parameters(
                refmethod, method1,
                dummy_parameter_regex=self._dummy_rgx):
            self.add_message('arguments-differ',
                             args=(class_type, method1.name),
                             node=method1)
        elif len(method1.args.defaults) < len(refmethod.args.defaults):
            self.add_message('signature-differs',
                             args=(class_type, method1.name),
                             node=method1)

    def _uses_mandatory_method_param(self, node):
        """Check that attribute lookup name use first attribute variable name

        Name is `self` for method, `cls` for classmethod and `mcs` for metaclass.
        """
        return self._is_mandatory_method_param(node.expr)

    def _is_mandatory_method_param(self, node):
        """Check if astroid.Name corresponds to first attribute variable name

        Name is `self` for method, `cls` for classmethod and `mcs` for metaclass.
        """
        return (self._first_attrs and isinstance(node, astroid.Name)
                and node.name == self._first_attrs[-1])


class SpecialMethodsChecker(BaseChecker):
    """Checker which verifies that special methods
    are implemented correctly.
    """
    __implements__ = (IAstroidChecker, )
    name = 'classes'
    msgs = {
        'E0301': ('__iter__ returns non-iterator',
                  'non-iterator-returned',
                  'Used when an __iter__ method returns something which is not an '
                  'iterable (i.e. has no `%s` method)' % NEXT_METHOD,
                  {'old_names': [('W0234', 'non-iterator-returned'),
                                 ('E0234', 'non-iterator-returned')]}),
        'E0302': ('The special method %r expects %s param(s), %d %s given',
                  'unexpected-special-method-signature',
                  'Emitted when a special method was defined with an '
                  'invalid number of parameters. If it has too few or '
                  'too many, it might not work at all.',
                  {'old_names': [('E0235', 'bad-context-manager')]}),
        'E0303': ('__len__ does not return non-negative integer',
                  'invalid-length-returned',
                  'Used when an __len__ method returns something which is not a '
                  'non-negative integer', {}),
    }
    priority = -2

    @check_messages('unexpected-special-method-signature',
                    'non-iterator-returned', 'invalid-length-returned')
    def visit_functiondef(self, node):
        if not node.is_method():
            return
        if node.name == '__iter__':
            self._check_iter(node)
        if node.name == '__len__':
            self._check_len(node)
        if node.name in PYMETHODS:
            self._check_unexpected_method_signature(node)

    visit_asyncfunctiondef = visit_functiondef

    def _check_unexpected_method_signature(self, node):
        expected_params = SPECIAL_METHODS_PARAMS[node.name]

        if expected_params is None:
            # This can support a variable number of parameters.
            return
        if not node.args.args and not node.args.vararg:
            # Method has no parameter, will be caught
            # by no-method-argument.
            return

        if decorated_with(node, [BUILTINS + ".staticmethod"]):
            # We expect to not take in consideration self.
            all_args = node.args.args
        else:
            all_args = node.args.args[1:]
        mandatory = len(all_args) - len(node.args.defaults)
        optional = len(node.args.defaults)
        current_params = mandatory + optional

        if isinstance(expected_params, tuple):
            # The expected number of parameters can be any value from this
            # tuple, although the user should implement the method
            # to take all of them in consideration.
            emit = mandatory not in expected_params
            expected_params = "between %d or %d" % expected_params
        else:
            # If the number of mandatory parameters doesn't
            # suffice, the expected parameters for this
            # function will be deduced from the optional
            # parameters.
            rest = expected_params - mandatory
            if rest == 0:
                emit = False
            elif rest < 0:
                emit = True
            elif rest > 0:
                emit = not ((optional - rest) >= 0 or node.args.vararg)

        if emit:
            verb = "was" if current_params <= 1 else "were"
            self.add_message('unexpected-special-method-signature',
                             args=(node.name, expected_params, current_params, verb),
                             node=node)

    @staticmethod
    def _is_iterator(node):
        if node is astroid.YES:
            # Just ignore YES objects.
            return True
        if isinstance(node, Generator):
            # Generators can be itered.
            return True

        if isinstance(node, astroid.Instance):
            try:
                node.local_attr(NEXT_METHOD)
                return True
            except astroid.NotFoundError:
                pass
        elif isinstance(node, astroid.ClassDef):
            metaclass = node.metaclass()
            if metaclass and isinstance(metaclass, astroid.ClassDef):
                try:
                    metaclass.local_attr(NEXT_METHOD)
                    return True
                except astroid.NotFoundError:
                    pass
        return False

    def _check_iter(self, node):
        infered = _safe_infer_call_result(node, node)
        if infered is not None:
            if not self._is_iterator(infered):
                self.add_message('non-iterator-returned', node=node)

    def _check_len(self, node):
        inferred = _safe_infer_call_result(node, node)
        if not inferred:
            return

        if not isinstance(inferred, astroid.Const):
            self.add_message('invalid-length-returned', node=node)
            return

        value = inferred.value
        if not isinstance(value, six.integer_types) or value < 0:
            self.add_message('invalid-length-returned', node=node)


def _ancestors_to_call(klass_node, method='__init__'):
    """return a dictionary where keys are the list of base classes providing
    the queried method, and so that should/may be called from the method node
    """
    to_call = {}
    for base_node in klass_node.ancestors(recurs=False):
        try:
            to_call[base_node] = next(base_node.igetattr(method))
        except astroid.InferenceError:
            continue
    return to_call


def node_method(node, method_name):
    """get astroid for <method_name> on the given class node, ensuring it
    is a Function node
    """
    for node_attr in node.local_attr(method_name):
        if isinstance(node_attr, astroid.Function):
            return node_attr
    raise astroid.NotFoundError(method_name)

def register(linter):
    """required method to auto register this checker """
    linter.register_checker(ClassChecker(linter))
    linter.register_checker(SpecialMethodsChecker(linter))
