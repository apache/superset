# Copyright (c) 2012-2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for the Python standard library."""

import functools
import sys
import keyword
from textwrap import dedent

from astroid import (
    MANAGER, UseInferenceDefault, inference_tip,
    InferenceError)
from astroid import arguments
from astroid import exceptions
from astroid import nodes
from astroid.builder import AstroidBuilder, extract_node
from astroid import util

PY3K = sys.version_info > (3, 0)
PY33 = sys.version_info >= (3, 3)
PY34 = sys.version_info >= (3, 4)

# general function

def infer_func_form(node, base_type, context=None, enum=False):
    """Specific inference function for namedtuple or Python 3 enum. """
    def infer_first(node):
        if node is util.Uninferable:
            raise UseInferenceDefault
        try:            
            value = next(node.infer(context=context))
            if value is util.Uninferable:
                raise UseInferenceDefault()
            else:
                return value
        except StopIteration:
            raise InferenceError()

    # node is a Call node, class name as first argument and generated class
    # attributes as second argument
    if len(node.args) != 2:
        # something weird here, go back to class implementation
        raise UseInferenceDefault()
    # namedtuple or enums list of attributes can be a list of strings or a
    # whitespace-separate string
    try:
        name = infer_first(node.args[0]).value
        names = infer_first(node.args[1])
        try:
            attributes = names.value.replace(',', ' ').split()
        except AttributeError:
            if not enum:
                attributes = [infer_first(const).value for const in names.elts]
            else:
                # Enums supports either iterator of (name, value) pairs
                # or mappings.
                # TODO: support only list, tuples and mappings.
                if hasattr(names, 'items') and isinstance(names.items, list):
                    attributes = [infer_first(const[0]).value
                                  for const in names.items
                                  if isinstance(const[0], nodes.Const)]
                elif hasattr(names, 'elts'):
                    # Enums can support either ["a", "b", "c"]
                    # or [("a", 1), ("b", 2), ...], but they can't
                    # be mixed.
                    if all(isinstance(const, nodes.Tuple)
                           for const in names.elts):
                        attributes = [infer_first(const.elts[0]).value
                                      for const in names.elts
                                      if isinstance(const, nodes.Tuple)]
                    else:
                        attributes = [infer_first(const).value
                                      for const in names.elts]
                else:
                    raise AttributeError
                if not attributes:
                    raise AttributeError
    except (AttributeError, exceptions.InferenceError):
        raise UseInferenceDefault()

    # If we can't infer the name of the class, don't crash, up to this point
    # we know it is a namedtuple anyway.
    name = name or 'Uninferable'
    # we want to return a Class node instance with proper attributes set
    class_node = nodes.ClassDef(name, 'docstring')
    class_node.parent = node.parent
    # set base class=tuple
    class_node.bases.append(base_type)
    # XXX add __init__(*attributes) method
    for attr in attributes:
        fake_node = nodes.EmptyNode()
        fake_node.parent = class_node
        fake_node.attrname = attr
        class_node.instance_attrs[attr] = [fake_node]
    return class_node, name, attributes


def _looks_like(node, name):
    func = node.func
    if isinstance(func, nodes.Attribute):
        return func.attrname == name
    if isinstance(func, nodes.Name):
        return func.name == name
    return False

_looks_like_namedtuple = functools.partial(_looks_like, name='namedtuple')
_looks_like_enum = functools.partial(_looks_like, name='Enum')


def infer_named_tuple(node, context=None):
    """Specific inference function for namedtuple Call node"""
    class_node, name, attributes = infer_func_form(node, nodes.Tuple._proxied,
                                                   context=context)
    call_site = arguments.CallSite.from_call(node)
    func = next(extract_node('import collections; collections.namedtuple').infer())
    try:
        rename = next(call_site.infer_argument(func, 'rename', context)).bool_value()
    except InferenceError:
        rename = False

    if rename:
        attributes = _get_renamed_namedtuple_atributes(attributes)

    field_def = ("    {name} = property(lambda self: self[{index:d}], "
                 "doc='Alias for field number {index:d}')")
    field_defs = '\n'.join(field_def.format(name=name, index=index)
                           for index, name in enumerate(attributes))
    fake = AstroidBuilder(MANAGER).string_build('''
class %(name)s(tuple):
    __slots__ = ()
    _fields = %(fields)r
    def _asdict(self):
        return self.__dict__
    @classmethod
    def _make(cls, iterable, new=tuple.__new__, len=len):
        return new(cls, iterable)
    def _replace(self, **kwds):
        return self
    def __getnewargs__(self):
        return tuple(self)
%(field_defs)s
    ''' % {'name': name, 'fields': attributes, 'field_defs': field_defs})
    class_node.locals['_asdict'] = fake.body[0].locals['_asdict']
    class_node.locals['_make'] = fake.body[0].locals['_make']
    class_node.locals['_replace'] = fake.body[0].locals['_replace']
    class_node.locals['_fields'] = fake.body[0].locals['_fields']
    for attr in attributes:
        class_node.locals[attr] = fake.body[0].locals[attr]
    # we use UseInferenceDefault, we can't be a generator so return an iterator
    return iter([class_node])


def _get_renamed_namedtuple_atributes(field_names):
    names = list(field_names)
    seen = set()
    for i, name in enumerate(field_names):
        if (not all(c.isalnum() or c == '_' for c in name) or keyword.iskeyword(name)
            or not name or name[0].isdigit() or name.startswith('_') or name in seen):
            names[i] = '_%d' % i
        seen.add(name)
    return tuple(names)


def infer_enum(node, context=None):
    """ Specific inference function for enum Call node. """
    enum_meta = extract_node('''
    class EnumMeta(object):
        'docstring'
        def __call__(self, node):
            class EnumAttribute(object):
                name = ''
                value = 0
            return EnumAttribute()
    ''')
    class_node = infer_func_form(node, enum_meta,
                                 context=context, enum=True)[0]
    return iter([class_node.instantiate_class()])


def infer_enum_class(node):
    """ Specific inference for enums. """
    names = set(('Enum', 'IntEnum', 'enum.Enum', 'enum.IntEnum'))
    for basename in node.basenames:
        # TODO: doesn't handle subclasses yet. This implementation
        # is a hack to support enums.
        if basename not in names:
            continue
        if node.root().name == 'enum':
            # Skip if the class is directly from enum module.
            break
        for local, values in node.locals.items():
            if any(not isinstance(value, nodes.AssignName)
                   for value in values):
                continue

            stmt = values[0].statement()
            if isinstance(stmt.targets[0], nodes.Tuple):
                targets = stmt.targets[0].itered()
            else:
                targets = stmt.targets

            new_targets = []
            for target in targets:
                # Replace all the assignments with our mocked class.
                classdef = dedent('''
                class %(name)s(%(types)s):
                    @property
                    def value(self):
                        # Not the best return.
                        return None
                    @property
                    def name(self):
                        return %(name)r
                ''' % {'name': target.name, 'types': ', '.join(node.basenames)})
                fake = AstroidBuilder(MANAGER).string_build(classdef)[target.name]
                fake.parent = target.parent
                for method in node.mymethods():
                    fake.locals[method.name] = [method]
                new_targets.append(fake.instantiate_class())
            node.locals[local] = new_targets
        break
    return node


MANAGER.register_transform(nodes.Call, inference_tip(infer_named_tuple),
                           _looks_like_namedtuple)
MANAGER.register_transform(nodes.Call, inference_tip(infer_enum),
                           _looks_like_enum)
MANAGER.register_transform(nodes.ClassDef, infer_enum_class)
