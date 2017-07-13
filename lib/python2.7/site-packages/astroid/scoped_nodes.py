# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2011, 2013-2015 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015 Rene Zhang <rz99@cornell.edu>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


"""
This module contains the classes for "scoped" node, i.e. which are opening a
new local scope in the language definition : Module, ClassDef, FunctionDef (and
Lambda, GeneratorExp, DictComp and SetComp to some extent).
"""

import sys
import io
import itertools
import warnings

import six

from astroid import bases
from astroid import context as contextmod
from astroid import exceptions
from astroid import decorators as decorators_mod
from astroid.interpreter import objectmodel
from astroid.interpreter import dunder_lookup
from astroid import manager
from astroid import mixins
from astroid import node_classes
from astroid import util


BUILTINS = six.moves.builtins.__name__
ITER_METHODS = ('__iter__', '__getitem__')


def _c3_merge(sequences, cls, context):
    """Merges MROs in *sequences* to a single MRO using the C3 algorithm.

    Adapted from http://www.python.org/download/releases/2.3/mro/.

    """
    result = []
    while True:
        sequences = [s for s in sequences if s]   # purge empty sequences
        if not sequences:
            return result
        for s1 in sequences:   # find merge candidates among seq heads
            candidate = s1[0]
            for s2 in sequences:
                if candidate in s2[1:]:
                    candidate = None
                    break      # reject the current head, it appears later
            else:
                break
        if not candidate:
            # Show all the remaining bases, which were considered as
            # candidates for the next mro sequence.
            raise exceptions.InconsistentMroError(
                message="Cannot create a consistent method resolution order "
                "for MROs {mros} of class {cls!r}.",
                mros=sequences, cls=cls, context=context)

        result.append(candidate)
        # remove the chosen candidate
        for seq in sequences:
            if seq[0] == candidate:
                del seq[0]


def _verify_duplicates_mro(sequences, cls, context):
    for sequence in sequences:
        names = [node.qname() for node in sequence]
        if len(names) != len(set(names)):
            raise exceptions.DuplicateBasesError(
                message='Duplicates found in MROs {mros} for {cls!r}.',
                mros=sequences, cls=cls, context=context)


def function_to_method(n, klass):
    if isinstance(n, FunctionDef):
        if n.type == 'classmethod':
            return bases.BoundMethod(n, klass)
        if n.type != 'staticmethod':
            return bases.UnboundMethod(n)
    return n


MANAGER = manager.AstroidManager()
def builtin_lookup(name):
    """lookup a name into the builtin module
    return the list of matching statements and the astroid for the builtin
    module
    """
    builtin_astroid = MANAGER.ast_from_module(six.moves.builtins)
    if name == '__dict__':
        return builtin_astroid, ()
    try:
        stmts = builtin_astroid.locals[name]
    except KeyError:
        stmts = ()
    return builtin_astroid, stmts


# TODO move this Mixin to mixins.py; problem: 'FunctionDef' in _scope_lookup
class LocalsDictNodeNG(node_classes.LookupMixIn,
                       node_classes.NodeNG):
    """ this class provides locals handling common to Module, FunctionDef
    and ClassDef nodes, including a dict like interface for direct access
    to locals information
    """

    # attributes below are set by the builder module or by raw factories

    # dictionary of locals with name as key and node defining the local as
    # value

    locals = {}

    def qname(self):
        """return the 'qualified' name of the node, eg module.name,
        module.class.name ...
        """
        # pylint: disable=no-member; github.com/pycqa/astroid/issues/278
        if self.parent is None:
            return self.name
        return '%s.%s' % (self.parent.frame().qname(), self.name)

    def frame(self):
        """return the first parent frame node (i.e. Module, FunctionDef or ClassDef)
        """
        return self

    def scope(self):
        """return the first node defining a new scope (i.e. Module,
        FunctionDef, ClassDef, Lambda but also GeneratorExp, DictComp and SetComp)
        """
        return self

    def _scope_lookup(self, node, name, offset=0):
        """XXX method for interfacing the scope lookup"""
        try:
            stmts = node._filter_stmts(self.locals[name], self, offset)
        except KeyError:
            stmts = ()
        if stmts:
            return self, stmts
        if self.parent: # i.e. not Module
            # nested scope: if parent scope is a function, that's fine
            # else jump to the module
            pscope = self.parent.scope()
            if not pscope.is_function:
                pscope = pscope.root()
            return pscope.scope_lookup(node, name)
        return builtin_lookup(name) # Module

    def set_local(self, name, stmt):
        """define <name> in locals (<stmt> is the node defining the name)
        if the node is a Module node (i.e. has globals), add the name to
        globals

        if the name is already defined, ignore it
        """
        #assert not stmt in self.locals.get(name, ()), (self, stmt)
        self.locals.setdefault(name, []).append(stmt)

    __setitem__ = set_local

    def _append_node(self, child):
        """append a child, linking it in the tree"""
        # pylint: disable=no-member; depending by the class
        # which uses the current class as a mixin or base class.
        # It's rewritten in 2.0, so it makes no sense for now
        # to spend development time on it.
        self.body.append(child)
        child.parent = self

    def add_local_node(self, child_node, name=None):
        """append a child which should alter locals to the given node"""
        if name != '__class__':
            # add __class__ node as a child will cause infinite recursion later!
            self._append_node(child_node)
        self.set_local(name or child_node.name, child_node)

    def __getitem__(self, item):
        """method from the `dict` interface returning the first node
        associated with the given name in the locals dictionary

        :type item: str
        :param item: the name of the locally defined object
        :raises KeyError: if the name is not defined
        """
        return self.locals[item][0]

    def __iter__(self):
        """method from the `dict` interface returning an iterator on
        `self.keys()`
        """
        return iter(self.keys())

    def keys(self):
        """method from the `dict` interface returning a tuple containing
        locally defined names
        """
        return list(self.locals.keys())

    def values(self):
        """method from the `dict` interface returning a tuple containing
        locally defined nodes which are instance of `FunctionDef` or `ClassDef`
        """
        return [self[key] for key in self.keys()]

    def items(self):
        """method from the `dict` interface returning a list of tuple
        containing each locally defined name with its associated node,
        which is an instance of `FunctionDef` or `ClassDef`
        """
        return list(zip(self.keys(), self.values()))

    def __contains__(self, name):
        return name in self.locals


class Module(LocalsDictNodeNG):
    _astroid_fields = ('body',)

    fromlineno = 0
    lineno = 0

    # attributes below are set by the builder module or by raw factories

    # the file from which as been extracted the astroid representation. It may
    # be None if the representation has been built from a built-in module
    file = None
    # Alternatively, if built from a string/bytes, this can be set
    file_bytes = None
    # encoding of python source file, so we can get unicode out of it (python2
    # only)
    file_encoding = None
    # the module name
    name = None
    # boolean for astroid built from source (i.e. ast)
    pure_python = None
    # boolean for package module
    package = None
    # dictionary of globals with name as key and node defining the global
    # as value
    globals = None

    # Future imports
    future_imports = None
    special_attributes = objectmodel.ModuleModel()

    # names of python special attributes (handled by getattr impl.)

    # names of module attributes available through the global scope
    scope_attrs = set(('__name__', '__doc__', '__file__', '__path__'))

    _other_fields = ('name', 'doc', 'file', 'path', 'package',
                     'pure_python', 'future_imports')
    _other_other_fields = ('locals', 'globals')

    def __init__(self, name, doc, file=None, path=None, package=None,
                 parent=None, pure_python=True):
        self.name = name
        self.doc = doc
        self.file = file
        self.path = path
        self.package = package
        self.parent = parent
        self.pure_python = pure_python
        self.locals = self.globals = {}
        self.body = []
        self.future_imports = set()
    # pylint: enable=redefined-builtin

    def postinit(self, body=None):
        self.body = body

    def _get_stream(self):
        if self.file_bytes is not None:
            return io.BytesIO(self.file_bytes)
        if self.file is not None:
            stream = open(self.file, 'rb')
            return stream
        return None

    @property
    def file_stream(self):
        warnings.warn("file_stream property is deprecated and "
                      "it is slated for removal in astroid 1.6."
                      "Use the new method 'stream' instead.",
                      PendingDeprecationWarning,
                      stacklevel=2)
        return self._get_stream()

    def stream(self):
        """Get a stream to the underlying file or bytes."""
        return self._get_stream()

    def close(self):
        """Close the underlying file streams."""
        warnings.warn("close method is deprecated and it is "
                      "slated for removal in astroid 1.6, along "
                      "with 'file_stream' property. "
                      "Its behaviour is replaced by managing each "
                      "file stream returned by the 'stream' method.",
                      PendingDeprecationWarning,
                      stacklevel=2)

    def block_range(self, lineno):
        """return block line numbers.

        start from the beginning whatever the given lineno
        """
        return self.fromlineno, self.tolineno

    def scope_lookup(self, node, name, offset=0):
        if name in self.scope_attrs and name not in self.locals:
            try:
                return self, self.getattr(name)
            except exceptions.AttributeInferenceError:
                return self, ()
        return self._scope_lookup(node, name, offset)

    def pytype(self):
        return '%s.module' % BUILTINS

    def display_type(self):
        return 'Module'

    def getattr(self, name, context=None, ignore_locals=False):
        result = []
        name_in_locals = name in self.locals

        if name in self.special_attributes and not ignore_locals and not name_in_locals:
            result = [self.special_attributes.lookup(name)]
        elif not ignore_locals and name_in_locals:
            result = self.locals[name]
        elif self.package:
            try:
                result = [self.import_module(name, relative_only=True)]
            except (exceptions.AstroidBuildingError, SyntaxError):
                util.reraise(exceptions.AttributeInferenceError(target=self,
                                                                attribute=name,
                                                                context=context))
        result = [n for n in result if not isinstance(n, node_classes.DelName)]
        if result:
            return result
        raise exceptions.AttributeInferenceError(target=self, attribute=name,
                                                 context=context)

    def igetattr(self, name, context=None):
        """inferred getattr"""
        # set lookup name since this is necessary to infer on import nodes for
        # instance
        context = contextmod.copy_context(context)
        context.lookupname = name
        try:
            return bases._infer_stmts(self.getattr(name, context),
                                      context, frame=self)
        except exceptions.AttributeInferenceError as error:
            util.reraise(exceptions.InferenceError(
                error.message, target=self, attribute=name, context=context))

    def fully_defined(self):
        """return True if this module has been built from a .py file
        and so contains a complete representation including the code
        """
        return self.file is not None and self.file.endswith('.py')

    def statement(self):
        """return the first parent node marked as statement node
        consider a module as a statement...
        """
        return self

    def previous_sibling(self):
        """module has no sibling"""
        return

    def next_sibling(self):
        """module has no sibling"""
        return

    if six.PY2:
        @decorators_mod.cachedproperty
        def _absolute_import_activated(self):
            for stmt in self.locals.get('absolute_import', ()):
                if isinstance(stmt, node_classes.ImportFrom) and stmt.modname == '__future__':
                    return True
            return False
    else:
        _absolute_import_activated = True

    def absolute_import_activated(self):
        return self._absolute_import_activated

    def import_module(self, modname, relative_only=False, level=None):
        """import the given module considering self as context"""
        if relative_only and level is None:
            level = 0
        absmodname = self.relative_to_absolute_name(modname, level)

        try:
            return MANAGER.ast_from_module_name(absmodname)
        except exceptions.AstroidBuildingError:
            # we only want to import a sub module or package of this module,
            # skip here
            if relative_only:
                raise
        return MANAGER.ast_from_module_name(modname)

    def relative_to_absolute_name(self, modname, level):
        """return the absolute module name for a relative import.

        The relative import can be implicit or explicit.
        """
        # XXX this returns non sens when called on an absolute import
        # like 'pylint.checkers.astroid.utils'
        # XXX doesn't return absolute name if self.name isn't absolute name
        if self.absolute_import_activated() and level is None:
            return modname
        if level:
            if self.package:
                level = level - 1
            if level and self.name.count('.') < level:
                raise exceptions.TooManyLevelsError(
                    level=level, name=self.name)

            package_name = self.name.rsplit('.', level)[0]
        elif self.package:
            package_name = self.name
        else:
            package_name = self.name.rsplit('.', 1)[0]

        if package_name:
            if not modname:
                return package_name
            return '%s.%s' % (package_name, modname)
        return modname

    def wildcard_import_names(self):
        """return the list of imported names when this module is 'wildcard
        imported'

        It doesn't include the '__builtins__' name which is added by the
        current CPython implementation of wildcard imports.
        """
        # We separate the different steps of lookup in try/excepts
        # to avoid catching too many Exceptions
        default = [name for name in self.keys() if not name.startswith('_')]
        try:
            all_values = self['__all__']
        except KeyError:
            return default

        try:
            explicit = next(all_values.assigned_stmts())
        except exceptions.InferenceError:
            return default
        except AttributeError:
            # not an assignment node
            # XXX infer?
            return default

        # Try our best to detect the exported name.
        inferred = []
        try:
            explicit = next(explicit.infer())
        except exceptions.InferenceError:
            return default
        if not isinstance(explicit, (node_classes.Tuple, node_classes.List)):
            return default

        str_const = lambda node: (isinstance(node, node_classes.Const) and
                                  isinstance(node.value, six.string_types))
        for node in explicit.elts:
            if str_const(node):
                inferred.append(node.value)
            else:
                try:
                    inferred_node = next(node.infer())
                except exceptions.InferenceError:
                    continue
                if str_const(inferred_node):
                    inferred.append(inferred_node.value)
        return inferred

    def public_names(self):
        """Get the list of the names which are publicly available in this module."""
        return [name for name in self.keys() if not name.startswith('_')]

    def bool_value(self):
        return True


class ComprehensionScope(LocalsDictNodeNG):
    def frame(self):
        return self.parent.frame()

    scope_lookup = LocalsDictNodeNG._scope_lookup


class GeneratorExp(ComprehensionScope):
    _astroid_fields = ('elt', 'generators')
    _other_other_fields = ('locals',)
    elt = None
    generators = None

    def __init__(self, lineno=None, col_offset=None, parent=None):
        self.locals = {}
        super(GeneratorExp, self).__init__(lineno, col_offset, parent)

    def postinit(self, elt=None, generators=None):
        self.elt = elt
        if generators is None:
            self.generators = []
        else:
            self.generators = generators

    def bool_value(self):
        return True


class DictComp(ComprehensionScope):
    _astroid_fields = ('key', 'value', 'generators')
    _other_other_fields = ('locals',)
    key = None
    value = None
    generators = None

    def __init__(self, lineno=None, col_offset=None, parent=None):
        self.locals = {}
        super(DictComp, self).__init__(lineno, col_offset, parent)

    def postinit(self, key=None, value=None, generators=None):
        self.key = key
        self.value = value
        if generators is None:
            self.generators = []
        else:
            self.generators = generators

    def bool_value(self):
        return util.Uninferable


class SetComp(ComprehensionScope):
    _astroid_fields = ('elt', 'generators')
    _other_other_fields = ('locals',)
    elt = None
    generators = None

    def __init__(self, lineno=None, col_offset=None, parent=None):
        self.locals = {}
        super(SetComp, self).__init__(lineno, col_offset, parent)

    def postinit(self, elt=None, generators=None):
        self.elt = elt
        if generators is None:
            self.generators = []
        else:
            self.generators = generators

    def bool_value(self):
        return util.Uninferable


class _ListComp(node_classes.NodeNG):
    """class representing a ListComp node"""
    _astroid_fields = ('elt', 'generators')
    elt = None
    generators = None

    def postinit(self, elt=None, generators=None):
        self.elt = elt
        self.generators = generators

    def bool_value(self):
        return util.Uninferable


if six.PY3:
    class ListComp(_ListComp, ComprehensionScope):
        """class representing a ListComp node"""
        _other_other_fields = ('locals',)

        def __init__(self, lineno=None, col_offset=None, parent=None):
            self.locals = {}
            super(ListComp, self).__init__(lineno, col_offset, parent)
else:
    class ListComp(_ListComp):
        """class representing a ListComp node"""


def _infer_decorator_callchain(node):
    """Detect decorator call chaining and see if the end result is a
    static or a classmethod.
    """
    if not isinstance(node, FunctionDef):
        return
    if not node.parent:
        return
    try:
        # TODO: We don't handle multiple inference results right now,
        #       because there's no flow to reason when the return
        #       is what we are looking for, a static or a class method.
        result = next(node.infer_call_result(node.parent))
    except (StopIteration, exceptions.InferenceError):
        return
    if isinstance(result, bases.Instance):
        result = result._proxied
    if isinstance(result, ClassDef):
        if result.is_subtype_of('%s.classmethod' % BUILTINS):
            return 'classmethod'
        if result.is_subtype_of('%s.staticmethod' % BUILTINS):
            return 'staticmethod'


class Lambda(mixins.FilterStmtsMixin, LocalsDictNodeNG):
    _astroid_fields = ('args', 'body',)
    _other_other_fields = ('locals',)
    name = '<lambda>'

    # function's type, 'function' | 'method' | 'staticmethod' | 'classmethod'
    @property
    def type(self):
        # pylint: disable=no-member
        if self.args.args and self.args.args[0].name == 'self':
            if isinstance(self.parent.scope(), ClassDef):
                return 'method'
        return 'function'

    def __init__(self, lineno=None, col_offset=None, parent=None):
        self.locals = {}
        self.args = []
        self.body = []
        super(Lambda, self).__init__(lineno, col_offset, parent)

    def postinit(self, args, body):
        self.args = args
        self.body = body

    def pytype(self):
        if 'method' in self.type:
            return '%s.instancemethod' % BUILTINS
        return '%s.function' % BUILTINS

    def display_type(self):
        if 'method' in self.type:
            return 'Method'
        return 'Function'

    def callable(self):
        return True

    def argnames(self):
        """return a list of argument names"""
        # pylint: disable=no-member; github.com/pycqa/astroid/issues/291
        # args is in fact redefined later on by postinit. Can't be changed
        # to None due to a strong interaction between Lambda and FunctionDef.

        if self.args.args: # maybe None with builtin functions
            names = _rec_get_names(self.args.args)
        else:
            names = []
        if self.args.vararg:
            names.append(self.args.vararg)
        if self.args.kwarg:
            names.append(self.args.kwarg)
        return names

    def infer_call_result(self, caller, context=None):
        """infer what a function is returning when called"""
        # pylint: disable=no-member; github.com/pycqa/astroid/issues/291
        # args is in fact redefined later on by postinit. Can't be changed
        # to None due to a strong interaction between Lambda and FunctionDef.

        return self.body.infer(context)

    def scope_lookup(self, node, name, offset=0):
        # pylint: disable=no-member; github.com/pycqa/astroid/issues/291
        # args is in fact redefined later on by postinit. Can't be changed
        # to None due to a strong interaction between Lambda and FunctionDef.

        if node in self.args.defaults or node in self.args.kw_defaults:
            frame = self.parent.frame()
            # line offset to avoid that def func(f=func) resolve the default
            # value to the defined function
            offset = -1
        else:
            # check this is not used in function decorators
            frame = self
        return frame._scope_lookup(node, name, offset)

    def bool_value(self):
        return True


class FunctionDef(node_classes.Statement, Lambda):
    if six.PY3:
        _astroid_fields = ('decorators', 'args', 'returns', 'body')
        returns = None
    else:
        _astroid_fields = ('decorators', 'args', 'body')
    decorators = None
    special_attributes = objectmodel.FunctionModel()
    is_function = True
    # attributes below are set by the builder module or by raw factories
    _other_fields = ('name', 'doc')
    _other_other_fields = ('locals', '_type')
    _type = None

    def __init__(self, name=None, doc=None, lineno=None,
                 col_offset=None, parent=None):
        self.name = name
        self.doc = doc
        self.instance_attrs = {}
        super(FunctionDef, self).__init__(lineno, col_offset, parent)
        if parent:
            frame = parent.frame()
            frame.set_local(name, self)

    # pylint: disable=arguments-differ; different than Lambdas
    def postinit(self, args, body, decorators=None, returns=None):
        self.args = args
        self.body = body
        self.decorators = decorators
        self.returns = returns

    @decorators_mod.cachedproperty
    def extra_decorators(self):
        """Get the extra decorators that this function can haves
        Additional decorators are considered when they are used as
        assignments, as in `method = staticmethod(method)`.
        The property will return all the callables that are used for
        decoration.
        """
        frame = self.parent.frame()
        if not isinstance(frame, ClassDef):
            return []

        decorators = []
        for assign in frame.nodes_of_class(node_classes.Assign):
            if (isinstance(assign.value, node_classes.Call)
                    and isinstance(assign.value.func, node_classes.Name)):
                for assign_node in assign.targets:
                    if not isinstance(assign_node, node_classes.AssignName):
                        # Support only `name = callable(name)`
                        continue

                    if assign_node.name != self.name:
                        # Interested only in the assignment nodes that
                        # decorates the current method.
                        continue
                    try:
                        meth = frame[self.name]
                    except KeyError:
                        continue
                    else:
                        # Must be a function and in the same frame as the
                        # original method.
                        if (isinstance(meth, FunctionDef)
                                and assign_node.frame() == frame):
                            decorators.append(assign.value)
        return decorators

    @decorators_mod.cachedproperty
    def type(self):
        """Get the function type for this node.

        Possible values are: method, function, staticmethod, classmethod.
        """
        builtin_descriptors = {'classmethod', 'staticmethod'}

        for decorator in self.extra_decorators:
            if decorator.func.name in builtin_descriptors:
                return decorator.func.name

        frame = self.parent.frame()
        type_name = 'function'
        if isinstance(frame, ClassDef):
            if self.name == '__new__':
                return 'classmethod'
            elif sys.version_info >= (3, 6) and self.name == '__init_subclass__':
                return 'classmethod'
            else:
                type_name = 'method'

        if not self.decorators:
            return type_name

        for node in self.decorators.nodes:
            if isinstance(node, node_classes.Name):
                if node.name in builtin_descriptors:
                    return node.name

            if isinstance(node, node_classes.Call):
                # Handle the following case:
                # @some_decorator(arg1, arg2)
                # def func(...)
                #
                try:
                    current = next(node.func.infer())
                except exceptions.InferenceError:
                    continue
                _type = _infer_decorator_callchain(current)
                if _type is not None:
                    return _type

            try:
                for inferred in node.infer():
                    # Check to see if this returns a static or a class method.
                    _type = _infer_decorator_callchain(inferred)
                    if _type is not None:
                        return _type

                    if not isinstance(inferred, ClassDef):
                        continue
                    for ancestor in inferred.ancestors():
                        if not isinstance(ancestor, ClassDef):
                            continue
                        if ancestor.is_subtype_of('%s.classmethod' % BUILTINS):
                            return 'classmethod'
                        elif ancestor.is_subtype_of('%s.staticmethod' % BUILTINS):
                            return 'staticmethod'
            except exceptions.InferenceError:
                pass
        return type_name

    @decorators_mod.cachedproperty
    def fromlineno(self):
        # lineno is the line number of the first decorator, we want the def
        # statement lineno
        lineno = self.lineno
        if self.decorators is not None:
            lineno += sum(node.tolineno - node.lineno + 1
                          for node in self.decorators.nodes)

        return lineno

    @decorators_mod.cachedproperty
    def blockstart_tolineno(self):
        return self.args.tolineno

    def block_range(self, lineno):
        """return block line numbers.

        start from the "def" position whatever the given lineno
        """
        return self.fromlineno, self.tolineno

    def getattr(self, name, context=None):
        """this method doesn't look in the instance_attrs dictionary since it's
        done by an Instance proxy at inference time.
        """
        if name in self.instance_attrs:
            return self.instance_attrs[name]
        if name in self.special_attributes:
            return [self.special_attributes.lookup(name)]
        raise exceptions.AttributeInferenceError(target=self, attribute=name)

    def igetattr(self, name, context=None):
        """Inferred getattr, which returns an iterator of inferred statements."""
        try:
            return bases._infer_stmts(self.getattr(name, context),
                                      context, frame=self)
        except exceptions.AttributeInferenceError as error:
            util.reraise(exceptions.InferenceError(
                error.message, target=self, attribute=name, context=context))

    def is_method(self):
        """return true if the function node should be considered as a method"""
        # check we are defined in a ClassDef, because this is usually expected
        # (e.g. pylint...) when is_method() return True
        return self.type != 'function' and isinstance(self.parent.frame(), ClassDef)

    @decorators_mod.cached
    def decoratornames(self):
        """return a list of decorator qualified names"""
        result = set()
        decoratornodes = []
        if self.decorators is not None:
            decoratornodes += self.decorators.nodes
        decoratornodes += self.extra_decorators
        for decnode in decoratornodes:
            try:
                for infnode in decnode.infer():
                    result.add(infnode.qname())
            except exceptions.InferenceError:
                continue
        return result

    def is_bound(self):
        """return true if the function is bound to an Instance or a class"""
        return self.type == 'classmethod'

    def is_abstract(self, pass_is_abstract=True):
        """Returns True if the method is abstract.

        A method is considered abstract if
         - the only statement is 'raise NotImplementedError', or
         - the only statement is 'pass' and pass_is_abstract is True, or
         - the method is annotated with abc.astractproperty/abc.abstractmethod
        """
        if self.decorators:
            for node in self.decorators.nodes:
                try:
                    inferred = next(node.infer())
                except exceptions.InferenceError:
                    continue
                if inferred and inferred.qname() in ('abc.abstractproperty',
                                                     'abc.abstractmethod'):
                    return True

        for child_node in self.body:
            if isinstance(child_node, node_classes.Raise):
                if child_node.raises_not_implemented():
                    return True
            return pass_is_abstract and isinstance(child_node, node_classes.Pass)
        # empty function is the same as function with a single "pass" statement
        if pass_is_abstract:
            return True

    def is_generator(self):
        """return true if this is a generator function"""
        yield_nodes = (node_classes.Yield, node_classes.YieldFrom)
        return next(self.nodes_of_class(yield_nodes,
                                        skip_klass=(FunctionDef, Lambda)), False)

    def infer_call_result(self, caller, context=None):
        """infer what a function is returning when called"""
        if self.is_generator():
            result = bases.Generator(self)
            yield result
            return
        # This is really a gigantic hack to work around metaclass generators
        # that return transient class-generating functions. Pylint's AST structure
        # cannot handle a base class object that is only used for calling __new__,
        # but does not contribute to the inheritance structure itself. We inject
        # a fake class into the hierarchy here for several well-known metaclass
        # generators, and filter it out later.
        if (self.name == 'with_metaclass' and
                len(self.args.args) == 1 and
                self.args.vararg is not None):
            metaclass = next(caller.args[0].infer(context))
            if isinstance(metaclass, ClassDef):
                c = ClassDef('temporary_class', None)
                c.hide = True
                c.parent = self
                class_bases = [next(b.infer(context)) for b in caller.args[1:]]
                c.bases = [base for base in class_bases if base != util.Uninferable]
                c._metaclass = metaclass
                yield c
                return
        returns = self.nodes_of_class(node_classes.Return, skip_klass=FunctionDef)
        for returnnode in returns:
            if returnnode.value is None:
                yield node_classes.Const(None)
            else:
                try:
                    for inferred in returnnode.value.infer(context):
                        yield inferred
                except exceptions.InferenceError:
                    yield util.Uninferable

    def bool_value(self):
        return True


class AsyncFunctionDef(FunctionDef):
    """Asynchronous function created with the `async` keyword."""


def _rec_get_names(args, names=None):
    """return a list of all argument names"""
    if names is None:
        names = []
    for arg in args:
        if isinstance(arg, node_classes.Tuple):
            _rec_get_names(arg.elts, names)
        else:
            names.append(arg.name)
    return names


def _is_metaclass(klass, seen=None):
    """ Return if the given class can be
    used as a metaclass.
    """
    if klass.name == 'type':
        return True
    if seen is None:
        seen = set()
    for base in klass.bases:
        try:
            for baseobj in base.infer():
                baseobj_name = baseobj.qname()
                if baseobj_name in seen:
                    continue
                else:
                    seen.add(baseobj_name)
                if isinstance(baseobj, bases.Instance):
                    # not abstract
                    return False
                if baseobj is util.Uninferable:
                    continue
                if baseobj is klass:
                    continue
                if not isinstance(baseobj, ClassDef):
                    continue
                if baseobj._type == 'metaclass':
                    return True
                if _is_metaclass(baseobj, seen):
                    return True
        except exceptions.InferenceError:
            continue
    return False


def _class_type(klass, ancestors=None):
    """return a ClassDef node type to differ metaclass and exception
    from 'regular' classes
    """
    # XXX we have to store ancestors in case we have a ancestor loop
    if klass._type is not None:
        return klass._type
    if _is_metaclass(klass):
        klass._type = 'metaclass'
    elif klass.name.endswith('Exception'):
        klass._type = 'exception'
    else:
        if ancestors is None:
            ancestors = set()
        klass_name = klass.qname()
        if klass_name in ancestors:
            # XXX we are in loop ancestors, and have found no type
            klass._type = 'class'
            return 'class'
        ancestors.add(klass_name)
        for base in klass.ancestors(recurs=False):
            name = _class_type(base, ancestors)
            if name != 'class':
                if name == 'metaclass' and not _is_metaclass(klass):
                    # don't propagate it if the current class
                    # can't be a metaclass
                    continue
                klass._type = base.type
                break
    if klass._type is None:
        klass._type = 'class'
    return klass._type


def get_wrapping_class(node):
    """Obtain the class that *wraps* this node

    We consider that a class wraps a node if the class
    is a parent for the said node.
    """

    klass = node.frame()
    while klass is not None and not isinstance(klass, ClassDef):
        if klass.parent is None:
            klass = None
        else:
            klass = klass.parent.frame()
    return klass



class ClassDef(mixins.FilterStmtsMixin, LocalsDictNodeNG,
               node_classes.Statement):

    # some of the attributes below are set by the builder module or
    # by a raw factories

    # a dictionary of class instances attributes
    _astroid_fields = ('decorators', 'bases', 'body') # name

    decorators = None
    special_attributes = objectmodel.ClassModel()

    _type = None
    _metaclass_hack = False
    hide = False
    type = property(_class_type,
                    doc="class'type, possible values are 'class' | "
                    "'metaclass' | 'exception'")
    _other_fields = ('name', 'doc')
    _other_other_fields = ('locals', '_newstyle')
    _newstyle = None

    def __init__(self, name=None, doc=None, lineno=None,
                 col_offset=None, parent=None):
        self.instance_attrs = {}
        self.locals = {}
        self.keywords = []
        self.bases = []
        self.body = []
        self.name = name
        self.doc = doc
        super(ClassDef, self).__init__(lineno, col_offset, parent)
        if parent is not None:
            parent.frame().set_local(name, self)

    # pylint: disable=redefined-outer-name
    def postinit(self, bases, body, decorators, newstyle=None, metaclass=None, keywords=None):
        self.keywords = keywords
        self.bases = bases
        self.body = body
        self.decorators = decorators
        if newstyle is not None:
            self._newstyle = newstyle
        if metaclass is not None:
            self._metaclass = metaclass

    def _newstyle_impl(self, context=None):
        if context is None:
            context = contextmod.InferenceContext()
        if self._newstyle is not None:
            return self._newstyle
        for base in self.ancestors(recurs=False, context=context):
            if base._newstyle_impl(context):
                self._newstyle = True
                break
        klass = self.declared_metaclass()
        # could be any callable, we'd need to infer the result of klass(name,
        # bases, dict).  punt if it's not a class node.
        if klass is not None and isinstance(klass, ClassDef):
            self._newstyle = klass._newstyle_impl(context)
        if self._newstyle is None:
            self._newstyle = False
        return self._newstyle

    _newstyle = None
    newstyle = property(_newstyle_impl,
                        doc="boolean indicating if it's a new style class"
                        "or not")

    @decorators_mod.cachedproperty
    def blockstart_tolineno(self):
        if self.bases:
            return self.bases[-1].tolineno

        return self.fromlineno

    def block_range(self, lineno):
        """return block line numbers.

        start from the "class" position whatever the given lineno
        """
        return self.fromlineno, self.tolineno

    def pytype(self):
        if self.newstyle:
            return '%s.type' % BUILTINS
        return '%s.classobj' % BUILTINS

    def display_type(self):
        return 'Class'

    def callable(self):
        return True

    def is_subtype_of(self, type_name, context=None):
        if self.qname() == type_name:
            return True
        for anc in self.ancestors(context=context):
            if anc.qname() == type_name:
                return True

    def _infer_type_call(self, caller, context):
        name_node = next(caller.args[0].infer(context))
        if (isinstance(name_node, node_classes.Const) and
                isinstance(name_node.value, six.string_types)):
            name = name_node.value
        else:
            return util.Uninferable

        result = ClassDef(name, None)

        # Get the bases of the class.
        class_bases = next(caller.args[1].infer(context))
        if isinstance(class_bases, (node_classes.Tuple, node_classes.List)):
            result.bases = class_bases.itered()
        else:
            # There is currently no AST node that can represent an 'unknown'
            # node (Uninferable is not an AST node), therefore we simply return Uninferable here
            # although we know at least the name of the class.
            return util.Uninferable

        # Get the members of the class
        try:
            members = next(caller.args[2].infer(context))
        except exceptions.InferenceError:
            members = None

        if members and isinstance(members, node_classes.Dict):
            for attr, value in members.items:
                if (isinstance(attr, node_classes.Const) and
                        isinstance(attr.value, six.string_types)):
                    result.locals[attr.value] = [value]

        result.parent = caller.parent
        return result

    def infer_call_result(self, caller, context=None):
        """infer what a class is returning when called"""
        if (self.is_subtype_of('%s.type' % (BUILTINS,), context)
                and len(caller.args) == 3):
            result = self._infer_type_call(caller, context)
            yield result
        else:
            yield bases.Instance(self)

    def scope_lookup(self, node, name, offset=0):
        # If the name looks like a builtin name, just try to look
        # into the upper scope of this class. We might have a
        # decorator that it's poorly named after a builtin object
        # inside this class.
        lookup_upper_frame = (
            isinstance(node.parent, node_classes.Decorators) and
            name in MANAGER.astroid_cache[six.moves.builtins.__name__]
        )
        if any(node == base or base.parent_of(node)
               for base in self.bases) or lookup_upper_frame:
            # Handle the case where we have either a name
            # in the bases of a class, which exists before
            # the actual definition or the case where we have
            # a Getattr node, with that name.
            #
            # name = ...
            # class A(name):
            #     def name(self): ...
            #
            # import name
            # class A(name.Name):
            #     def name(self): ...

            frame = self.parent.frame()
            # line offset to avoid that class A(A) resolve the ancestor to
            # the defined class
            offset = -1
        else:
            frame = self
        return frame._scope_lookup(node, name, offset)

    @property
    def basenames(self):
        """Get the list of parent class names, as they appear in the class definition."""
        return [bnode.as_string() for bnode in self.bases]

    def ancestors(self, recurs=True, context=None):
        """return an iterator on the node base classes in a prefixed
        depth first order

        :param recurs:
          boolean indicating if it should recurse or return direct
          ancestors only
        """
        # FIXME: should be possible to choose the resolution order
        # FIXME: inference make infinite loops possible here
        yielded = set([self])
        if context is None:
            context = contextmod.InferenceContext()
        if six.PY3:
            if not self.bases and self.qname() != 'builtins.object':
                yield builtin_lookup("object")[1][0]
                return

        for stmt in self.bases:
            with context.restore_path():
                try:
                    for baseobj in stmt.infer(context):
                        if not isinstance(baseobj, ClassDef):
                            if isinstance(baseobj, bases.Instance):
                                baseobj = baseobj._proxied
                            else:
                                continue
                        if not baseobj.hide:
                            if baseobj in yielded:
                                continue
                            yielded.add(baseobj)
                            yield baseobj
                        if recurs:
                            for grandpa in baseobj.ancestors(recurs=True,
                                                             context=context):
                                if grandpa is self:
                                    # This class is the ancestor of itself.
                                    break
                                if grandpa in yielded:
                                    continue
                                yielded.add(grandpa)
                                yield grandpa
                except exceptions.InferenceError:
                    continue

    def local_attr_ancestors(self, name, context=None):
        """return an iterator on astroid representation of parent classes
        which have <name> defined in their locals
        """
        if self.newstyle and all(n.newstyle for n in self.ancestors(context)):
            # Look up in the mro if we can. This will result in the
            # attribute being looked up just as Python does it.
            try:
                ancestors = self.mro(context)[1:]
            except exceptions.MroError:
                # Fallback to use ancestors, we can't determine
                # a sane MRO.
                ancestors = self.ancestors(context=context)
        else:
            ancestors = self.ancestors(context=context)
        for astroid in ancestors:
            if name in astroid:
                yield astroid

    def instance_attr_ancestors(self, name, context=None):
        """return an iterator on astroid representation of parent classes
        which have <name> defined in their instance attribute dictionary
        """
        for astroid in self.ancestors(context=context):
            if name in astroid.instance_attrs:
                yield astroid

    def has_base(self, node):
        return node in self.bases

    def local_attr(self, name, context=None):
        """return the list of assign node associated to name in this class
        locals or in its parents

        :raises `AttributeInferenceError`:
          if no attribute with this name has been find in this class or
          its parent classes
        """
        result = []
        if name in self.locals:
            result = self.locals[name]
        else:
            class_node = next(self.local_attr_ancestors(name, context), ())
            if class_node:
                result = class_node.locals[name]
        result = [n for n in result if not isinstance(n, node_classes.DelAttr)]
        if result:
            return result
        raise exceptions.AttributeInferenceError(target=self, attribute=name,
                                                 context=context)

    def instance_attr(self, name, context=None):
        """return the astroid nodes associated to name in this class instance
        attributes dictionary and in its parents

        :raises `AttributeInferenceError`:
          if no attribute with this name has been find in this class or
          its parent classes
        """
        # Return a copy, so we don't modify self.instance_attrs,
        # which could lead to infinite loop.
        values = list(self.instance_attrs.get(name, []))
        # get all values from parents
        for class_node in self.instance_attr_ancestors(name, context):
            values += class_node.instance_attrs[name]
        values = [n for n in values if not isinstance(n, node_classes.DelAttr)]
        if values:
            return values
        raise exceptions.AttributeInferenceError(target=self, attribute=name,
                                                 context=context)

    def instantiate_class(self):
        """return Instance of ClassDef node, else return self"""
        return bases.Instance(self)

    def instanciate_class(self):
        warnings.warn('%s.instanciate_class() is deprecated and slated for '
                      'removal in astroid 2.0, use %s.instantiate_class() '
                      'instead.' % (type(self).__name__, type(self).__name__),
                      PendingDeprecationWarning, stacklevel=2)
        return self.instantiate_class()

    def getattr(self, name, context=None, class_context=True):
        """Get an attribute from this class, using Python's attribute semantic

        This method doesn't look in the instance_attrs dictionary
        since it's done by an Instance proxy at inference time.  It
        may return a Uninferable object if the attribute has not been actually
        found but a __getattr__ or __getattribute__ method is defined.
        If *class_context* is given, then it's considered that the
        attribute is accessed from a class context,
        e.g. ClassDef.attribute, otherwise it might have been accessed
        from an instance as well.  If *class_context* is used in that
        case, then a lookup in the implicit metaclass and the explicit
        metaclass will be done.

        """
        values = self.locals.get(name, [])
        if name in self.special_attributes and class_context and not values:
            result = [self.special_attributes.lookup(name)]
            if name == '__bases__':
                # Need special treatment, since they are mutable
                # and we need to return all the values.
                result += values
            return result

        # don't modify the list in self.locals!
        values = list(values)
        for classnode in self.ancestors(recurs=True, context=context):
            values += classnode.locals.get(name, [])

        if class_context:
            values += self._metaclass_lookup_attribute(name, context)

        if not values:
            raise exceptions.AttributeInferenceError(target=self, attribute=name,
                                                     context=context)
        return values

    def _metaclass_lookup_attribute(self, name, context):
        """Search the given name in the implicit and the explicit metaclass."""
        attrs = set()
        implicit_meta = self.implicit_metaclass()
        metaclass = self.metaclass()
        for cls in {implicit_meta, metaclass}:
            if cls and cls != self and isinstance(cls, ClassDef):
                cls_attributes = self._get_attribute_from_metaclass(
                    cls, name, context)
                attrs.update(set(cls_attributes))
        return attrs

    def _get_attribute_from_metaclass(self, cls, name, context):
        try:
            attrs = cls.getattr(name, context=context,
                                class_context=True)
        except exceptions.AttributeInferenceError:
            return

        for attr in bases._infer_stmts(attrs, context, frame=cls):
            if not isinstance(attr, FunctionDef):
                yield attr
                continue

            if bases._is_property(attr):
                # TODO(cpopa): don't use a private API.
                for inferred in attr.infer_call_result(self, context):
                    yield inferred
                continue
            if attr.type == 'classmethod':
                # If the method is a classmethod, then it will
                # be bound to the metaclass, not to the class
                # from where the attribute is retrieved.
                # get_wrapping_class could return None, so just
                # default to the current class.
                frame = get_wrapping_class(attr) or self
                yield bases.BoundMethod(attr, frame)
            elif attr.type == 'staticmethod':
                yield attr
            else:
                yield bases.BoundMethod(attr, self)

    def igetattr(self, name, context=None, class_context=True):
        """inferred getattr, need special treatment in class to handle
        descriptors
        """
        # set lookup name since this is necessary to infer on import nodes for
        # instance
        context = contextmod.copy_context(context)
        context.lookupname = name
        try:
            attrs = self.getattr(name, context, class_context=class_context)
            for inferred in bases._infer_stmts(attrs, context, frame=self):
                # yield Uninferable object instead of descriptors when necessary
                if (not isinstance(inferred, node_classes.Const)
                        and isinstance(inferred, bases.Instance)):
                    try:
                        inferred._proxied.getattr('__get__', context)
                    except exceptions.AttributeInferenceError:
                        yield inferred
                    else:
                        yield util.Uninferable
                else:
                    yield function_to_method(inferred, self)
        except exceptions.AttributeInferenceError as error:
            if not name.startswith('__') and self.has_dynamic_getattr(context):
                # class handle some dynamic attributes, return a Uninferable object
                yield util.Uninferable
            else:
                util.reraise(exceptions.InferenceError(
                    error.message, target=self, attribute=name, context=context))

    def has_dynamic_getattr(self, context=None):
        """
        Check if the current instance has a custom __getattr__
        or a custom __getattribute__.

        If any such method is found and it is not from
        builtins, nor from an extension module, then the function
        will return True.
        """
        def _valid_getattr(node):
            root = node.root()
            return root.name != BUILTINS and getattr(root, 'pure_python', None)

        try:
            return _valid_getattr(self.getattr('__getattr__', context)[0])
        except exceptions.AttributeInferenceError:
            #if self.newstyle: XXX cause an infinite recursion error
            try:
                getattribute = self.getattr('__getattribute__', context)[0]
                return _valid_getattr(getattribute)
            except exceptions.AttributeInferenceError:
                pass
        return False

    def getitem(self, index, context=None):
        """Return the inference of a subscript.

        This is basically looking up the method in the metaclass and calling it.
        """
        try:
            methods = dunder_lookup.lookup(self, '__getitem__')
        except exceptions.AttributeInferenceError as exc:
            util.reraise(
                exceptions.AstroidTypeError(
                    node=self, error=exc,
                    context=context
                )
            )

        method = methods[0]

        # Create a new callcontext for providing index as an argument.
        if context:
            new_context = context.clone()
        else:
            new_context = contextmod.InferenceContext()

        new_context.callcontext = contextmod.CallContext(args=[index])
        new_context.boundnode = self

        return next(method.infer_call_result(self, new_context))

    def methods(self):
        """return an iterator on all methods defined in the class and
        its ancestors
        """
        done = {}
        for astroid in itertools.chain(iter((self,)), self.ancestors()):
            for meth in astroid.mymethods():
                if meth.name in done:
                    continue
                done[meth.name] = None
                yield meth

    def mymethods(self):
        """return an iterator on all methods defined in the class"""
        for member in self.values():
            if isinstance(member, FunctionDef):
                yield member

    def implicit_metaclass(self):
        """Get the implicit metaclass of the current class

        For newstyle classes, this will return an instance of builtins.type.
        For oldstyle classes, it will simply return None, since there's
        no implicit metaclass there.
        """

        if self.newstyle:
            return builtin_lookup('type')[1][0]

    _metaclass = None
    def declared_metaclass(self):
        """Return the explicit declared metaclass for the current class.

        An explicit declared metaclass is defined
        either by passing the ``metaclass`` keyword argument
        in the class definition line (Python 3) or (Python 2) by
        having a ``__metaclass__`` class attribute, or if there are
        no explicit bases but there is a global ``__metaclass__`` variable.
        """
        for base in self.bases:
            try:
                for baseobj in base.infer():
                    if isinstance(baseobj, ClassDef) and baseobj.hide:
                        self._metaclass = baseobj._metaclass
                        self._metaclass_hack = True
                        break
            except exceptions.InferenceError:
                pass

        if self._metaclass:
            # Expects this from Py3k TreeRebuilder
            try:
                return next(node for node in self._metaclass.infer()
                            if node is not util.Uninferable)
            except (exceptions.InferenceError, StopIteration):
                return None
        if six.PY3:
            return None

        if '__metaclass__' in self.locals:
            assignment = self.locals['__metaclass__'][-1]
        elif self.bases:
            return None
        elif '__metaclass__' in self.root().locals:
            assignments = [ass for ass in self.root().locals['__metaclass__']
                           if ass.lineno < self.lineno]
            if not assignments:
                return None
            assignment = assignments[-1]
        else:
            return None

        try:
            inferred = next(assignment.infer())
        except exceptions.InferenceError:
            return
        if inferred is util.Uninferable: # don't expose this
            return None
        return inferred

    def _find_metaclass(self, seen=None):
        if seen is None:
            seen = set()
        seen.add(self)

        klass = self.declared_metaclass()
        if klass is None:
            for parent in self.ancestors():
                if parent not in seen:
                    klass = parent._find_metaclass(seen)
                    if klass is not None:
                        break
        return klass

    def metaclass(self):
        """Return the metaclass of this class.

        If this class does not define explicitly a metaclass,
        then the first defined metaclass in ancestors will be used
        instead.
        """
        return self._find_metaclass()

    def has_metaclass_hack(self):
        return self._metaclass_hack

    def _islots(self):
        """ Return an iterator with the inferred slots. """
        if '__slots__' not in self.locals:
            return
        for slots in self.igetattr('__slots__'):
            # check if __slots__ is a valid type
            for meth in ITER_METHODS:
                try:
                    slots.getattr(meth)
                    break
                except exceptions.AttributeInferenceError:
                    continue
            else:
                continue

            if isinstance(slots, node_classes.Const):
                # a string. Ignore the following checks,
                # but yield the node, only if it has a value
                if slots.value:
                    yield slots
                continue
            if not hasattr(slots, 'itered'):
                # we can't obtain the values, maybe a .deque?
                continue

            if isinstance(slots, node_classes.Dict):
                values = [item[0] for item in slots.items]
            else:
                values = slots.itered()
            if values is util.Uninferable:
                continue
            if not values:
                # Stop the iteration, because the class
                # has an empty list of slots.
                raise StopIteration(values)

            for elt in values:
                try:
                    for inferred in elt.infer():
                        if inferred is util.Uninferable:
                            continue
                        if (not isinstance(inferred, node_classes.Const) or
                                not isinstance(inferred.value,
                                               six.string_types)):
                            continue
                        if not inferred.value:
                            continue
                        yield inferred
                except exceptions.InferenceError:
                    continue

    def _slots(self):
        if not self.newstyle:
            raise NotImplementedError(
                "The concept of slots is undefined for old-style classes.")

        slots = self._islots()
        try:
            first = next(slots)
        except StopIteration as exc:
            # The class doesn't have a __slots__ definition or empty slots.
            if exc.args and exc.args[0] not in ('', None):
                return exc.args[0]
            return None
        return [first] + list(slots)

    # Cached, because inferring them all the time is expensive
    @decorators_mod.cached
    def slots(self):
        """Get all the slots for this node.

        If the class doesn't define any slot, through `__slots__`
        variable, then this function will return a None.
        Also, it will return None in the case the slots weren't inferred.
        Otherwise, it will return a list of slot names.
        """
        def grouped_slots():
            # Not interested in object, since it can't have slots.
            for cls in self.mro()[:-1]:
                try:
                    cls_slots = cls._slots()
                except NotImplementedError:
                    continue
                if cls_slots is not None:
                    for slot in cls_slots:
                        yield slot
                else:
                    yield None

        if not self.newstyle:
            raise NotImplementedError(
                "The concept of slots is undefined for old-style classes.")

        slots = list(grouped_slots())
        if not all(slot is not None for slot in slots):
            return None

        return sorted(slots, key=lambda item: item.value)

    def _inferred_bases(self, context=None):
        # TODO(cpopa): really similar with .ancestors,
        # but the difference is when one base is inferred,
        # only the first object is wanted. That's because
        # we aren't interested in superclasses, as in the following
        # example:
        #
        # class SomeSuperClass(object): pass
        # class SomeClass(SomeSuperClass): pass
        # class Test(SomeClass): pass
        #
        # Inferring SomeClass from the Test's bases will give
        # us both SomeClass and SomeSuperClass, but we are interested
        # only in SomeClass.

        if context is None:
            context = contextmod.InferenceContext()
        if six.PY3:
            if not self.bases and self.qname() != 'builtins.object':
                yield builtin_lookup("object")[1][0]
                return

        for stmt in self.bases:
            try:
                baseobj = next(stmt.infer(context=context))
            except exceptions.InferenceError:
                continue
            if isinstance(baseobj, bases.Instance):
                baseobj = baseobj._proxied
            if not isinstance(baseobj, ClassDef):
                continue
            if not baseobj.hide:
                yield baseobj
            else:
                for base in baseobj.bases:
                    yield base

    def _compute_mro(self, context=None):
        inferred_bases = list(self._inferred_bases(context=context))
        bases_mro = []
        for base in inferred_bases:
            if base is self:
                continue

            try:
                mro = base._compute_mro(context=context)
                bases_mro.append(mro)
            except NotImplementedError:
                # Some classes have in their ancestors both newstyle and
                # old style classes. For these we can't retrieve the .mro,
                # although in Python it's possible, since the class we are
                # currently working is in fact new style.
                # So, we fallback to ancestors here.
                ancestors = list(base.ancestors(context=context))
                bases_mro.append(ancestors)

        unmerged_mro = ([[self]] + bases_mro + [inferred_bases])
        _verify_duplicates_mro(unmerged_mro, self, context)
        return _c3_merge(unmerged_mro, self, context)

    def mro(self, context=None):
        """Get the method resolution order, using C3 linearization.

        It returns the list of ancestors sorted by the mro.
        This will raise `NotImplementedError` for old-style classes, since
        they don't have the concept of MRO.
        """

        if not self.newstyle:
            raise NotImplementedError(
                "Could not obtain mro for old-style classes.")

        return self._compute_mro(context=context)

    def bool_value(self):
        return True


# Backwards-compatibility aliases
Class = util.proxy_alias('Class', ClassDef)
Function = util.proxy_alias('Function', FunctionDef)
GenExpr = util.proxy_alias('GenExpr', GeneratorExp)
