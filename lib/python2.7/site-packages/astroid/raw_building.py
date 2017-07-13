# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""this module contains a set of functions to create astroid trees from scratch
(build_* functions) or from living object (object_build_* functions)
"""

import inspect
import logging
import os
import sys
import types

import six

from astroid import bases
from astroid import manager
from astroid import node_classes
from astroid import nodes


MANAGER = manager.AstroidManager()
# the keys of CONST_CLS eg python builtin types
_CONSTANTS = tuple(node_classes.CONST_CLS)
_JYTHON = os.name == 'java'
_BUILTINS = vars(six.moves.builtins)
_LOG = logging.getLogger(__name__)


def _io_discrepancy(member):
    # _io module names itself `io`: http://bugs.python.org/issue18602
    member_self = getattr(member, '__self__', None)
    return (member_self and
            inspect.ismodule(member_self) and
            member_self.__name__ == '_io' and
            member.__module__ == 'io')

def _attach_local_node(parent, node, name):
    node.name = name # needed by add_local_node
    parent.add_local_node(node)


def _add_dunder_class(func, member):
    """Add a __class__ member to the given func node, if we can determine it."""
    python_cls = member.__class__
    cls_name = getattr(python_cls, '__name__', None)
    if not cls_name:
        return
    cls_bases = [ancestor.__name__ for ancestor in python_cls.__bases__]
    ast_klass = build_class(cls_name, cls_bases, python_cls.__doc__)
    func.instance_attrs['__class__'] = [ast_klass]


_marker = object()


def attach_dummy_node(node, name, runtime_object=_marker):
    """create a dummy node and register it in the locals of the given
    node with the specified name
    """
    enode = nodes.EmptyNode()
    enode.object = runtime_object
    _attach_local_node(node, enode, name)

def _has_underlying_object(self):
    return self.object is not None and self.object is not _marker

nodes.EmptyNode.has_underlying_object = _has_underlying_object

def attach_const_node(node, name, value):
    """create a Const node and register it in the locals of the given
    node with the specified name
    """
    if name not in node.special_attributes:
        _attach_local_node(node, nodes.const_factory(value), name)

def attach_import_node(node, modname, membername):
    """create a ImportFrom node and register it in the locals of the given
    node with the specified name
    """
    from_node = nodes.ImportFrom(modname, [(membername, None)])
    _attach_local_node(node, from_node, membername)


def build_module(name, doc=None):
    """create and initialize a astroid Module node"""
    node = nodes.Module(name, doc, pure_python=False)
    node.package = False
    node.parent = None
    return node


def build_class(name, basenames=(), doc=None):
    """create and initialize a astroid ClassDef node"""
    node = nodes.ClassDef(name, doc)
    for base in basenames:
        basenode = nodes.Name()
        basenode.name = base
        node.bases.append(basenode)
        basenode.parent = node
    return node


def build_function(name, args=None, defaults=None, doc=None):
    """create and initialize a astroid FunctionDef node"""
    args, defaults = args or [], defaults or []
    # first argument is now a list of decorators
    func = nodes.FunctionDef(name, doc)
    func.args = argsnode = nodes.Arguments()
    argsnode.args = []
    for arg in args:
        argsnode.args.append(nodes.Name())
        argsnode.args[-1].name = arg
        argsnode.args[-1].parent = argsnode
    argsnode.defaults = []
    for default in defaults:
        argsnode.defaults.append(nodes.const_factory(default))
        argsnode.defaults[-1].parent = argsnode
    argsnode.kwarg = None
    argsnode.vararg = None
    argsnode.parent = func
    if args:
        register_arguments(func)
    return func


def build_from_import(fromname, names):
    """create and initialize an astroid ImportFrom import statement"""
    return nodes.ImportFrom(fromname, [(name, None) for name in names])

def register_arguments(func, args=None):
    """add given arguments to local

    args is a list that may contains nested lists
    (i.e. def func(a, (b, c, d)): ...)
    """
    if args is None:
        args = func.args.args
        if func.args.vararg:
            func.set_local(func.args.vararg, func.args)
        if func.args.kwarg:
            func.set_local(func.args.kwarg, func.args)
    for arg in args:
        if isinstance(arg, nodes.Name):
            func.set_local(arg.name, arg)
        else:
            register_arguments(func, arg.elts)


def object_build_class(node, member, localname):
    """create astroid for a living class object"""
    basenames = [base.__name__ for base in member.__bases__]
    return _base_class_object_build(node, member, basenames,
                                    localname=localname)


def object_build_function(node, member, localname):
    """create astroid for a living function object"""
    # pylint: disable=deprecated-method; completely removed in 2.0
    args, varargs, varkw, defaults = inspect.getargspec(member)
    if varargs is not None:
        args.append(varargs)
    if varkw is not None:
        args.append(varkw)
    func = build_function(getattr(member, '__name__', None) or localname, args,
                          defaults, member.__doc__)
    node.add_local_node(func, localname)


def object_build_datadescriptor(node, member, name):
    """create astroid for a living data descriptor object"""
    return _base_class_object_build(node, member, [], name)


def object_build_methoddescriptor(node, member, localname):
    """create astroid for a living method descriptor object"""
    # FIXME get arguments ?
    func = build_function(getattr(member, '__name__', None) or localname,
                          doc=member.__doc__)
    # set node's arguments to None to notice that we have no information, not
    # and empty argument list
    func.args.args = None
    node.add_local_node(func, localname)
    _add_dunder_class(func, member)


def _base_class_object_build(node, member, basenames, name=None, localname=None):
    """create astroid for a living class object, with a given set of base names
    (e.g. ancestors)
    """
    klass = build_class(name or getattr(member, '__name__', None) or localname,
                        basenames, member.__doc__)
    klass._newstyle = isinstance(member, type)
    node.add_local_node(klass, localname)
    try:
        # limit the instantiation trick since it's too dangerous
        # (such as infinite test execution...)
        # this at least resolves common case such as Exception.args,
        # OSError.errno
        if issubclass(member, Exception):
            instdict = member().__dict__
        else:
            raise TypeError
    except: # pylint: disable=bare-except
        pass
    else:
        for item_name, obj in instdict.items():
            valnode = nodes.EmptyNode()
            valnode.object = obj
            valnode.parent = klass
            valnode.lineno = 1
            klass.instance_attrs[item_name] = [valnode]
    return klass


def _build_from_function(node, name, member, module):
    # verify this is not an imported function
    try:
        code = six.get_function_code(member)
    except AttributeError:
        # Some implementations don't provide the code object,
        # such as Jython.
        code = None
    filename = getattr(code, 'co_filename', None)
    if filename is None:
        assert isinstance(member, object)
        object_build_methoddescriptor(node, member, name)
    elif filename != getattr(module, '__file__', None):
        attach_dummy_node(node, name, member)
    else:
        object_build_function(node, member, name)


class InspectBuilder(object):
    """class for building nodes from living object

    this is actually a really minimal representation, including only Module,
    FunctionDef and ClassDef nodes and some others as guessed.
    """

    # astroid from living objects ###############################################

    def __init__(self):
        self._done = {}
        self._module = None

    def inspect_build(self, module, modname=None, path=None):
        """build astroid from a living module (i.e. using inspect)
        this is used when there is no python source code available (either
        because it's a built-in module or because the .py is not available)
        """
        self._module = module
        if modname is None:
            modname = module.__name__
        try:
            node = build_module(modname, module.__doc__)
        except AttributeError:
            # in jython, java modules have no __doc__ (see #109562)
            node = build_module(modname)
        node.file = node.path = os.path.abspath(path) if path else path
        node.name = modname
        MANAGER.cache_module(node)
        node.package = hasattr(module, '__path__')
        self._done = {}
        self.object_build(node, module)
        return node

    def object_build(self, node, obj):
        """recursive method which create a partial ast from real objects
         (only function, class, and method are handled)
        """
        if obj in self._done:
            return self._done[obj]
        self._done[obj] = node
        for name in dir(obj):
            try:
                member = getattr(obj, name)
            except AttributeError:
                # damned ExtensionClass.Base, I know you're there !
                attach_dummy_node(node, name)
                continue
            if inspect.ismethod(member):
                member = six.get_method_function(member)
            if inspect.isfunction(member):
                _build_from_function(node, name, member, self._module)
            elif inspect.isbuiltin(member):
                if (not _io_discrepancy(member) and
                        self.imported_member(node, member, name)):
                    continue
                object_build_methoddescriptor(node, member, name)
            elif inspect.isclass(member):
                if self.imported_member(node, member, name):
                    continue
                if member in self._done:
                    class_node = self._done[member]
                    if class_node not in node.locals.get(name, ()):
                        node.add_local_node(class_node, name)
                else:
                    class_node = object_build_class(node, member, name)
                    # recursion
                    self.object_build(class_node, member)
                if name == '__class__' and class_node.parent is None:
                    class_node.parent = self._done[self._module]
            elif inspect.ismethoddescriptor(member):
                assert isinstance(member, object)
                object_build_methoddescriptor(node, member, name)
            elif inspect.isdatadescriptor(member):
                assert isinstance(member, object)
                object_build_datadescriptor(node, member, name)
            elif isinstance(member, _CONSTANTS):
                attach_const_node(node, name, member)
            elif inspect.isroutine(member):
                # This should be called for Jython, where some builtin
                # methods aren't caught by isbuiltin branch.
                _build_from_function(node, name, member, self._module)
            else:
                # create an empty node so that the name is actually defined
                attach_dummy_node(node, name, member)

    def imported_member(self, node, member, name):
        """verify this is not an imported class or handle it"""
        # /!\ some classes like ExtensionClass doesn't have a __module__
        # attribute ! Also, this may trigger an exception on badly built module
        # (see http://www.logilab.org/ticket/57299 for instance)
        try:
            modname = getattr(member, '__module__', None)
        except: # pylint: disable=bare-except
            _LOG.exception('unexpected error while building '
                           'astroid from living object')
            modname = None
        if modname is None:
            if (name in ('__new__', '__subclasshook__')
                    or (name in _BUILTINS and _JYTHON)):
                # Python 2.5.1 (r251:54863, Sep  1 2010, 22:03:14)
                # >>> print object.__new__.__module__
                # None
                modname = six.moves.builtins.__name__
            else:
                attach_dummy_node(node, name, member)
                return True

        real_name = {
            'gtk': 'gtk_gtk',
            '_io': 'io',
        }.get(modname, modname)

        if real_name != self._module.__name__:
            # check if it sounds valid and then add an import node, else use a
            # dummy node
            try:
                getattr(sys.modules[modname], name)
            except (KeyError, AttributeError):
                attach_dummy_node(node, name, member)
            else:
                attach_import_node(node, modname, name)
            return True
        return False


### astroid bootstrapping ######################################################
Astroid_BUILDER = InspectBuilder()

_CONST_PROXY = {}
def _astroid_bootstrapping(astroid_builtin=None):
    """astroid boot strapping the builtins module"""
    # this boot strapping is necessary since we need the Const nodes to
    # inspect_build builtins, and then we can proxy Const
    if astroid_builtin is None:
        from six.moves import builtins
        astroid_builtin = Astroid_BUILDER.inspect_build(builtins)

    # pylint: disable=redefined-outer-name
    for cls, node_cls in node_classes.CONST_CLS.items():
        if cls is type(None):
            proxy = build_class('NoneType')
            proxy.parent = astroid_builtin
        elif cls is type(NotImplemented):
            proxy = build_class('NotImplementedType')
            proxy.parent = astroid_builtin
        else:
            proxy = astroid_builtin.getattr(cls.__name__)[0]
        if cls in (dict, list, set, tuple):
            node_cls._proxied = proxy
        else:
            _CONST_PROXY[cls] = proxy

_astroid_bootstrapping()

# TODO : find a nicer way to handle this situation;
# However __proxied introduced an
# infinite recursion (see https://bugs.launchpad.net/pylint/+bug/456870)
def _set_proxied(const):
    return _CONST_PROXY[const.value.__class__]
nodes.Const._proxied = property(_set_proxied)

_GeneratorType = nodes.ClassDef(types.GeneratorType.__name__, types.GeneratorType.__doc__)
_GeneratorType.parent = MANAGER.astroid_cache[six.moves.builtins.__name__]
bases.Generator._proxied = _GeneratorType
Astroid_BUILDER.object_build(bases.Generator._proxied, types.GeneratorType)

_builtins = MANAGER.astroid_cache[six.moves.builtins.__name__]
BUILTIN_TYPES = (types.GetSetDescriptorType, types.GeneratorType,
                 types.MemberDescriptorType, type(None), type(NotImplemented),
                 types.FunctionType, types.MethodType,
                 types.BuiltinFunctionType, types.ModuleType, types.TracebackType)
for _type in BUILTIN_TYPES:
    if _type.__name__ not in _builtins:
        cls = nodes.ClassDef(_type.__name__, _type.__doc__)
        cls.parent = MANAGER.astroid_cache[six.moves.builtins.__name__]
        Astroid_BUILDER.object_build(cls, _type)
        _builtins[_type.__name__] = cls
