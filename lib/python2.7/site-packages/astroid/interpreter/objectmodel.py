# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>
# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER
"""
Data object model, as per https://docs.python.org/3/reference/datamodel.html.

This module describes, at least partially, a data object model for some
of astroid's nodes. The model contains special attributes that nodes such
as functions, classes, modules etc have, such as __doc__, __class__,
__module__ etc, being used when doing attribute lookups over nodes.

For instance, inferring `obj.__class__` will first trigger an inference
of the `obj` variable. If it was succesfully inferred, then an attribute
`__class__ will be looked for in the inferred object. This is the part
where the data model occurs. The model is attached to those nodes
and the lookup mechanism will try to see if attributes such as
`__class__` are defined by the model or not. If they are defined,
the model will be requested to return the corresponding value of that
attribute. Thus the model can be viewed as a special part of the lookup
mechanism.
"""

try:
    from functools import lru_cache
except ImportError:
    from backports.functools_lru_cache import lru_cache

import itertools
import pprint
import os
import types

import six

import astroid
from astroid import context as contextmod
from astroid import exceptions
from astroid import node_classes


def _dunder_dict(instance, attributes):
    obj = node_classes.Dict(parent=instance)

    # Convert the keys to node strings
    keys = [node_classes.Const(value=value, parent=obj)
            for value in list(attributes.keys())]

    # The original attribute has a list of elements for each key,
    # but that is not useful for retrieving the special attribute's value.
    # In this case, we're picking the last value from each list.
    values = [elem[-1] for elem in attributes.values()]

    obj.postinit(list(zip(keys, values)))
    return obj


class ObjectModel(object):

    def __init__(self):
        self._instance = None

    def __repr__(self):
        result = []
        cname = type(self).__name__
        string = '%(cname)s(%(fields)s)'
        alignment = len(cname) + 1
        for field in sorted(self.attributes()):
            width = 80 - len(field) - alignment
            lines = pprint.pformat(field, indent=2,
                                   width=width).splitlines(True)

            inner = [lines[0]]
            for line in lines[1:]:
                inner.append(' ' * alignment + line)
            result.append(field)

        return string % {'cname': cname,
                         'fields': (',\n' + ' ' * alignment).join(result)}

    def __call__(self, instance):
        self._instance = instance
        return self

    def __get__(self, instance, cls=None):
        # ObjectModel needs to be a descriptor so that just doing
        # `special_attributes = SomeObjectModel` should be enough in the body of a node.
        # But at the same time, node.special_attributes should return an object
        # which can be used for manipulating the special attributes. That's the reason
        # we pass the instance through which it got accessed to ObjectModel.__call__,
        # returning itself afterwards, so we can still have access to the
        # underlying data model and to the instance for which it got accessed.
        return self(instance)

    def __contains__(self, name):
        return name in self.attributes()

    @lru_cache(maxsize=None)
    def attributes(self):
        """Get the attributes which are exported by this object model."""
        return [obj[2:] for obj in dir(self) if obj.startswith('py')]

    def lookup(self, name):
        """Look up the given *name* in the current model

        It should return an AST or an interpreter object,
        but if the name is not found, then an AttributeInferenceError will be raised.
        """

        if name in self.attributes():
            return getattr(self, "py" + name)
        raise exceptions.AttributeInferenceError(target=self._instance, attribute=name)


class ModuleModel(ObjectModel):

    def _builtins(self):
        builtins = astroid.MANAGER.astroid_cache[six.moves.builtins.__name__]
        return builtins.special_attributes.lookup('__dict__')

    if six.PY3:
        @property
        def pybuiltins(self):
            return self._builtins()

    else:
        @property
        def py__builtin__(self):
            return self._builtins()

    # __path__ is a standard attribute on *packages* not
    # non-package modules.  The only mention of it in the
    # official 2.7 documentation I can find is in the
    # tutorial.

    @property
    def py__path__(self):
        if not self._instance.package:
            raise exceptions.AttributeInferenceError(target=self._instance,
                                                     attribute='__path__')

        path = os.path.dirname(self._instance.file)
        path_obj = node_classes.Const(value=path, parent=self._instance)

        container = node_classes.List(parent=self._instance)
        container.postinit([path_obj])

        return container

    @property
    def py__name__(self):
        return node_classes.Const(value=self._instance.name,
                                  parent=self._instance)

    @property
    def py__doc__(self):
        return node_classes.Const(value=self._instance.doc,
                                  parent=self._instance)

    @property
    def py__file__(self):
        return node_classes.Const(value=self._instance.file,
                                  parent=self._instance)

    @property
    def py__dict__(self):
        return _dunder_dict(self._instance, self._instance.globals)

    # __package__ isn't mentioned anywhere outside a PEP:
    # https://www.python.org/dev/peps/pep-0366/
    @property
    def py__package__(self):
        if not self._instance.package:
            value = ''
        else:
            value = self._instance.name

        return node_classes.Const(value=value, parent=self._instance)

    # These are related to the Python 3 implementation of the
    # import system,
    # https://docs.python.org/3/reference/import.html#import-related-module-attributes

    @property
    def py__spec__(self):
        # No handling for now.
        return node_classes.Unknown()

    @property
    def py__loader__(self):
        # No handling for now.
        return node_classes.Unknown()

    @property
    def py__cached__(self):
        # No handling for now.
        return node_classes.Unknown()


class FunctionModel(ObjectModel):

    @property
    def py__name__(self):
        return node_classes.Const(value=self._instance.name,
                                  parent=self._instance)

    @property
    def py__doc__(self):
        return node_classes.Const(value=self._instance.doc,
                                  parent=self._instance)

    @property
    def py__qualname__(self):
        return node_classes.Const(value=self._instance.qname(),
                                  parent=self._instance)

    @property
    def py__defaults__(self):
        func = self._instance
        if not func.args.defaults:
            return node_classes.Const(value=None, parent=func)

        defaults_obj = node_classes.Tuple(parent=func)
        defaults_obj.postinit(func.args.defaults)
        return defaults_obj

    @property
    def py__annotations__(self):
        obj = node_classes.Dict(parent=self._instance)

        if not self._instance.returns:
            returns = None
        else:
            returns = self._instance.returns

        args = self._instance.args
        pair_annotations = itertools.chain(
            six.moves.zip(args.args, args.annotations),
            six.moves.zip(args.kwonlyargs, args.kwonlyargs_annotations)
        )

        annotations = {
            arg.name: annotation
            for (arg, annotation) in pair_annotations
            if annotation
        }
        if args.varargannotation:
            annotations[args.vararg] = args.varargannotation
        if args.kwargannotation:
            annotations[args.kwarg] = args.kwargannotation
        if returns:
            annotations['return'] = returns

        items = [(node_classes.Const(key, parent=obj), value)
                 for (key, value) in annotations.items()]

        obj.postinit(items)
        return obj

    @property
    def py__dict__(self):
        return node_classes.Dict(parent=self._instance)

    py__globals__ = py__dict__

    @property
    def py__kwdefaults__(self):

        def _default_args(args, parent):
            for arg in args.kwonlyargs:
                try:
                    default = args.default_value(arg.name)
                except exceptions.NoDefault:
                    continue

                name = node_classes.Const(arg.name, parent=parent)
                yield name, default

        args = self._instance.args
        obj = node_classes.Dict(parent=self._instance)
        defaults = dict(_default_args(args, obj))

        obj.postinit(list(defaults.items()))
        return obj

    @property
    def py__module__(self):
        return node_classes.Const(self._instance.root().qname())

    @property
    def py__get__(self):
        from astroid import bases

        func = self._instance

        class DescriptorBoundMethod(bases.BoundMethod):
            """Bound method which knows how to understand calling descriptor binding."""
            def infer_call_result(self, caller, context=None):
                if len(caller.args) != 2:
                    raise exceptions.InferenceError(
                        "Invalid arguments for descriptor binding",
                        target=self, context=context)

                context = contextmod.copy_context(context)
                cls = next(caller.args[0].infer(context=context))

                # Rebuild the original value, but with the parent set as the
                # class where it will be bound.
                new_func = func.__class__(name=func.name, doc=func.doc,
                                          lineno=func.lineno, col_offset=func.col_offset,
                                          parent=cls)
                # pylint: disable=no-member
                new_func.postinit(func.args, func.body,
                                  func.decorators, func.returns)

                # Build a proper bound method that points to our newly built function.
                proxy = bases.UnboundMethod(new_func)
                yield bases.BoundMethod(proxy=proxy, bound=cls)

        return DescriptorBoundMethod(proxy=self._instance, bound=self._instance)

    # These are here just for completion.
    @property
    def py__ne__(self):
        return node_classes.Unknown()

    py__subclasshook__ = py__ne__
    py__str__ = py__ne__
    py__sizeof__ = py__ne__
    py__setattr__ = py__ne__
    py__repr__ = py__ne__
    py__reduce__ = py__ne__
    py__reduce_ex__ = py__ne__
    py__new__ = py__ne__
    py__lt__ = py__ne__
    py__eq__ = py__ne__
    py__gt__ = py__ne__
    py__format__ = py__ne__
    py__delattr__ = py__ne__
    py__getattribute__ = py__ne__
    py__hash__ = py__ne__
    py__init__ = py__ne__
    py__dir__ = py__ne__
    py__call__ = py__ne__
    py__class__ = py__ne__
    py__closure__ = py__ne__
    py__code__ = py__ne__

    if six.PY2:
        pyfunc_name = py__name__
        pyfunc_doc = py__doc__
        pyfunc_globals = py__globals__
        pyfunc_dict = py__dict__
        pyfunc_defaults = py__defaults__
        pyfunc_code = py__code__
        pyfunc_closure = py__closure__


class ClassModel(ObjectModel):

    @property
    def py__module__(self):
        return node_classes.Const(self._instance.root().qname())

    @property
    def py__name__(self):
        return node_classes.Const(self._instance.name)

    @property
    def py__qualname__(self):
        return node_classes.Const(self._instance.qname())

    @property
    def py__doc__(self):
        return node_classes.Const(self._instance.doc)

    @property
    def py__mro__(self):
        if not self._instance.newstyle:
            raise exceptions.AttributeInferenceError(target=self._instance,
                                                     attribute='__mro__')

        mro = self._instance.mro()
        obj = node_classes.Tuple(parent=self._instance)
        obj.postinit(mro)
        return obj

    @property
    def pymro(self):
        if not self._instance.newstyle:
            raise exceptions.AttributeInferenceError(target=self._instance,
                                                     attribute='mro')

        from astroid import bases

        other_self = self

        # Cls.mro is a method and we need to return one in order to have a proper inference.
        # The method we're returning is capable of inferring the underlying MRO though.
        class MroBoundMethod(bases.BoundMethod):
            def infer_call_result(self, caller, context=None):
                yield other_self.py__mro__

        implicit_metaclass = self._instance.implicit_metaclass()
        mro_method = implicit_metaclass.locals['mro'][0]
        return MroBoundMethod(proxy=mro_method, bound=implicit_metaclass)

    @property
    def py__bases__(self):
        obj = node_classes.Tuple()
        context = contextmod.InferenceContext()
        elts = list(self._instance._inferred_bases(context))
        obj.postinit(elts=elts)
        return obj

    @property
    def py__class__(self):
        from astroid import helpers
        return helpers.object_type(self._instance)

    @property
    def py__subclasses__(self):
        """Get the subclasses of the underlying class

        This looks only in the current module for retrieving the subclasses,
        thus it might miss a couple of them.
        """
        from astroid import bases
        from astroid import scoped_nodes

        if not self._instance.newstyle:
            raise exceptions.AttributeInferenceError(target=self._instance,
                                                     attribute='__subclasses__')

        qname = self._instance.qname()
        root = self._instance.root()
        classes = [cls for cls in root.nodes_of_class(scoped_nodes.ClassDef)
                   if cls != self._instance and cls.is_subtype_of(qname)]

        obj = node_classes.List(parent=self._instance)
        obj.postinit(classes)

        class SubclassesBoundMethod(bases.BoundMethod):
            def infer_call_result(self, caller, context=None):
                yield obj

        implicit_metaclass = self._instance.implicit_metaclass()
        subclasses_method = implicit_metaclass.locals['__subclasses__'][0]
        return SubclassesBoundMethod(proxy=subclasses_method,
                                     bound=implicit_metaclass)

    @property
    def py__dict__(self):
        return node_classes.Dict(parent=self._instance)


class SuperModel(ObjectModel):

    @property
    def py__thisclass__(self):
        return self._instance.mro_pointer

    @property
    def py__self_class__(self):
        return self._instance._self_class

    @property
    def py__self__(self):
        return self._instance.type

    @property
    def py__class__(self):
        return self._instance._proxied


class UnboundMethodModel(ObjectModel):

    @property
    def py__class__(self):
        from astroid import helpers
        return helpers.object_type(self._instance)

    @property
    def py__func__(self):
        return self._instance._proxied

    @property
    def py__self__(self):
        return node_classes.Const(value=None, parent=self._instance)

    pyim_func = py__func__
    pyim_class = py__class__
    pyim_self = py__self__


class BoundMethodModel(FunctionModel):

    @property
    def py__func__(self):
        return self._instance._proxied._proxied

    @property
    def py__self__(self):
        return self._instance.bound


class GeneratorModel(FunctionModel):

    def __new__(cls, *args, **kwargs):
        # Append the values from the GeneratorType unto this object.
        ret = super(GeneratorModel, cls).__new__(cls, *args, **kwargs)
        generator = astroid.MANAGER.astroid_cache[six.moves.builtins.__name__]['generator']
        for name, values in generator.locals.items():
            print(name, values)
            method = values[0]
            patched = lambda cls, meth=method: meth

            setattr(type(ret), 'py' + name, property(patched))

        return ret

    @property
    def py__name__(self):
        return node_classes.Const(value=self._instance.parent.name,
                                  parent=self._instance)

    @property
    def py__doc__(self):
        return node_classes.Const(value=self._instance.parent.doc,
                                  parent=self._instance)


class InstanceModel(ObjectModel):

    @property
    def py__class__(self):
        return self._instance._proxied

    @property
    def py__module__(self):
        return node_classes.Const(self._instance.root().qname())

    @property
    def py__doc__(self):
        return node_classes.Const(self._instance.doc)

    @property
    def py__dict__(self):
        return _dunder_dict(self._instance, self._instance.instance_attrs)


class ExceptionInstanceModel(InstanceModel):

    @property
    def pyargs(self):
        message = node_classes.Const('')
        args = node_classes.Tuple(parent=self._instance)
        args.postinit((message, ))
        return args

    if six.PY3:
        # It's available only on Python 3.

        @property
        def py__traceback__(self):
            builtins = astroid.MANAGER.astroid_cache[six.moves.builtins.__name__]
            traceback_type = builtins[types.TracebackType.__name__]
            return traceback_type.instantiate_class()

    if six.PY2:
        # It's available only on Python 2.

        @property
        def pymessage(self):
            return node_classes.Const('')


class DictModel(ObjectModel):

    @property
    def py__class__(self):
        return self._instance._proxied

    def _generic_dict_attribute(self, obj, name):
        """Generate a bound method that can infer the given *obj*."""

        class DictMethodBoundMethod(astroid.BoundMethod):
            def infer_call_result(self, caller, context=None):
                yield obj

        meth = next(self._instance._proxied.igetattr(name))
        return DictMethodBoundMethod(proxy=meth, bound=self._instance)

    @property
    def pyitems(self):
        elems = []
        obj = node_classes.List(parent=self._instance)
        for key, value in self._instance.items:
            elem = node_classes.Tuple(parent=obj)
            elem.postinit((key, value))
            elems.append(elem)
        obj.postinit(elts=elems)

        if six.PY3:
            from astroid import objects
            obj = objects.DictItems(obj)

        return self._generic_dict_attribute(obj, 'items')

    @property
    def pykeys(self):
        keys = [key for (key, _) in self._instance.items]
        obj = node_classes.List(parent=self._instance)
        obj.postinit(elts=keys)

        if six.PY3:
            from astroid import objects
            obj = objects.DictKeys(obj)

        return self._generic_dict_attribute(obj, 'keys')

    @property
    def pyvalues(self):

        values = [value for (_, value) in self._instance.items]
        obj = node_classes.List(parent=self._instance)
        obj.postinit(values)

        if six.PY3:
            from astroid import objects
            obj = objects.DictValues(obj)

        return self._generic_dict_attribute(obj, 'values')
