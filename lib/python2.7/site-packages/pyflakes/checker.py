"""
Main module.

Implement the central Checker class.
Also, it models the Bindings and Scopes.
"""
import __future__
import doctest
import os
import sys

PY2 = sys.version_info < (3, 0)
PY32 = sys.version_info < (3, 3)    # Python 2.5 to 3.2
PY33 = sys.version_info < (3, 4)    # Python 2.5 to 3.3
PY34 = sys.version_info < (3, 5)    # Python 2.5 to 3.4
try:
    sys.pypy_version_info
    PYPY = True
except AttributeError:
    PYPY = False

builtin_vars = dir(__import__('__builtin__' if PY2 else 'builtins'))

try:
    import ast
except ImportError:     # Python 2.5
    import _ast as ast

    if 'decorator_list' not in ast.ClassDef._fields:
        # Patch the missing attribute 'decorator_list'
        ast.ClassDef.decorator_list = ()
        ast.FunctionDef.decorator_list = property(lambda s: s.decorators)

from pyflakes import messages


if PY2:
    def getNodeType(node_class):
        # workaround str.upper() which is locale-dependent
        return str(unicode(node_class.__name__).upper())
else:
    def getNodeType(node_class):
        return node_class.__name__.upper()

# Python >= 3.3 uses ast.Try instead of (ast.TryExcept + ast.TryFinally)
if PY32:
    def getAlternatives(n):
        if isinstance(n, (ast.If, ast.TryFinally)):
            return [n.body]
        if isinstance(n, ast.TryExcept):
            return [n.body + n.orelse] + [[hdl] for hdl in n.handlers]
else:
    def getAlternatives(n):
        if isinstance(n, ast.If):
            return [n.body]
        if isinstance(n, ast.Try):
            return [n.body + n.orelse] + [[hdl] for hdl in n.handlers]

if PY34:
    LOOP_TYPES = (ast.While, ast.For)
else:
    LOOP_TYPES = (ast.While, ast.For, ast.AsyncFor)


class _FieldsOrder(dict):
    """Fix order of AST node fields."""

    def _get_fields(self, node_class):
        # handle iter before target, and generators before element
        fields = node_class._fields
        if 'iter' in fields:
            key_first = 'iter'.find
        elif 'generators' in fields:
            key_first = 'generators'.find
        else:
            key_first = 'value'.find
        return tuple(sorted(fields, key=key_first, reverse=True))

    def __missing__(self, node_class):
        self[node_class] = fields = self._get_fields(node_class)
        return fields


def counter(items):
    """
    Simplest required implementation of collections.Counter. Required as 2.6
    does not have Counter in collections.
    """
    results = {}
    for item in items:
        results[item] = results.get(item, 0) + 1
    return results


def iter_child_nodes(node, omit=None, _fields_order=_FieldsOrder()):
    """
    Yield all direct child nodes of *node*, that is, all fields that
    are nodes and all items of fields that are lists of nodes.
    """
    for name in _fields_order[node.__class__]:
        if name == omit:
            continue
        field = getattr(node, name, None)
        if isinstance(field, ast.AST):
            yield field
        elif isinstance(field, list):
            for item in field:
                yield item


def convert_to_value(item):
    if isinstance(item, ast.Str):
        return item.s
    elif hasattr(ast, 'Bytes') and isinstance(item, ast.Bytes):
        return item.s
    elif isinstance(item, ast.Tuple):
        return tuple(convert_to_value(i) for i in item.elts)
    elif isinstance(item, ast.Num):
        return item.n
    elif isinstance(item, ast.Name):
        result = VariableKey(item=item)
        constants_lookup = {
            'True': True,
            'False': False,
            'None': None,
        }
        return constants_lookup.get(
            result.name,
            result,
        )
    elif (not PY33) and isinstance(item, ast.NameConstant):
        # None, True, False are nameconstants in python3, but names in 2
        return item.value
    else:
        return UnhandledKeyType()


class Binding(object):
    """
    Represents the binding of a value to a name.

    The checker uses this to keep track of which names have been bound and
    which names have not. See L{Assignment} for a special type of binding that
    is checked with stricter rules.

    @ivar used: pair of (L{Scope}, node) indicating the scope and
                the node that this binding was last used.
    """

    def __init__(self, name, source):
        self.name = name
        self.source = source
        self.used = False

    def __str__(self):
        return self.name

    def __repr__(self):
        return '<%s object %r from line %r at 0x%x>' % (self.__class__.__name__,
                                                        self.name,
                                                        self.source.lineno,
                                                        id(self))

    def redefines(self, other):
        return isinstance(other, Definition) and self.name == other.name


class Definition(Binding):
    """
    A binding that defines a function or a class.
    """


class UnhandledKeyType(object):
    """
    A dictionary key of a type that we cannot or do not check for duplicates.
    """


class VariableKey(object):
    """
    A dictionary key which is a variable.

    @ivar item: The variable AST object.
    """
    def __init__(self, item):
        self.name = item.id

    def __eq__(self, compare):
        return (
            compare.__class__ == self.__class__
            and compare.name == self.name
        )

    def __hash__(self):
        return hash(self.name)


class Importation(Definition):
    """
    A binding created by an import statement.

    @ivar fullName: The complete name given to the import statement,
        possibly including multiple dotted components.
    @type fullName: C{str}
    """

    def __init__(self, name, source, full_name=None):
        self.fullName = full_name or name
        self.redefined = []
        super(Importation, self).__init__(name, source)

    def redefines(self, other):
        if isinstance(other, SubmoduleImportation):
            # See note in SubmoduleImportation about RedefinedWhileUnused
            return self.fullName == other.fullName
        return isinstance(other, Definition) and self.name == other.name

    def _has_alias(self):
        """Return whether importation needs an as clause."""
        return not self.fullName.split('.')[-1] == self.name

    @property
    def source_statement(self):
        """Generate a source statement equivalent to the import."""
        if self._has_alias():
            return 'import %s as %s' % (self.fullName, self.name)
        else:
            return 'import %s' % self.fullName

    def __str__(self):
        """Return import full name with alias."""
        if self._has_alias():
            return self.fullName + ' as ' + self.name
        else:
            return self.fullName


class SubmoduleImportation(Importation):
    """
    A binding created by a submodule import statement.

    A submodule import is a special case where the root module is implicitly
    imported, without an 'as' clause, and the submodule is also imported.
    Python does not restrict which attributes of the root module may be used.

    This class is only used when the submodule import is without an 'as' clause.

    pyflakes handles this case by registering the root module name in the scope,
    allowing any attribute of the root module to be accessed.

    RedefinedWhileUnused is suppressed in `redefines` unless the submodule
    name is also the same, to avoid false positives.
    """

    def __init__(self, name, source):
        # A dot should only appear in the name when it is a submodule import
        assert '.' in name and (not source or isinstance(source, ast.Import))
        package_name = name.split('.')[0]
        super(SubmoduleImportation, self).__init__(package_name, source)
        self.fullName = name

    def redefines(self, other):
        if isinstance(other, Importation):
            return self.fullName == other.fullName
        return super(SubmoduleImportation, self).redefines(other)

    def __str__(self):
        return self.fullName

    @property
    def source_statement(self):
        return 'import ' + self.fullName


class ImportationFrom(Importation):

    def __init__(self, name, source, module, real_name=None):
        self.module = module
        self.real_name = real_name or name

        if module.endswith('.'):
            full_name = module + self.real_name
        else:
            full_name = module + '.' + self.real_name

        super(ImportationFrom, self).__init__(name, source, full_name)

    def __str__(self):
        """Return import full name with alias."""
        if self.real_name != self.name:
            return self.fullName + ' as ' + self.name
        else:
            return self.fullName

    @property
    def source_statement(self):
        if self.real_name != self.name:
            return 'from %s import %s as %s' % (self.module,
                                                self.real_name,
                                                self.name)
        else:
            return 'from %s import %s' % (self.module, self.name)


class StarImportation(Importation):
    """A binding created by a 'from x import *' statement."""

    def __init__(self, name, source):
        super(StarImportation, self).__init__('*', source)
        # Each star importation needs a unique name, and
        # may not be the module name otherwise it will be deemed imported
        self.name = name + '.*'
        self.fullName = name

    @property
    def source_statement(self):
        return 'from ' + self.fullName + ' import *'

    def __str__(self):
        # When the module ends with a ., avoid the ambiguous '..*'
        if self.fullName.endswith('.'):
            return self.source_statement
        else:
            return self.name


class FutureImportation(ImportationFrom):
    """
    A binding created by a from `__future__` import statement.

    `__future__` imports are implicitly used.
    """

    def __init__(self, name, source, scope):
        super(FutureImportation, self).__init__(name, source, '__future__')
        self.used = (scope, source)


class Argument(Binding):
    """
    Represents binding a name as an argument.
    """


class Assignment(Binding):
    """
    Represents binding a name with an explicit assignment.

    The checker will raise warnings for any Assignment that isn't used. Also,
    the checker does not consider assignments in tuple/list unpacking to be
    Assignments, rather it treats them as simple Bindings.
    """


class FunctionDefinition(Definition):
    pass


class ClassDefinition(Definition):
    pass


class ExportBinding(Binding):
    """
    A binding created by an C{__all__} assignment.  If the names in the list
    can be determined statically, they will be treated as names for export and
    additional checking applied to them.

    The only C{__all__} assignment that can be recognized is one which takes
    the value of a literal list containing literal strings.  For example::

        __all__ = ["foo", "bar"]

    Names which are imported and not otherwise used but appear in the value of
    C{__all__} will not have an unused import warning reported for them.
    """

    def __init__(self, name, source, scope):
        if '__all__' in scope and isinstance(source, ast.AugAssign):
            self.names = list(scope['__all__'].names)
        else:
            self.names = []
        if isinstance(source.value, (ast.List, ast.Tuple)):
            for node in source.value.elts:
                if isinstance(node, ast.Str):
                    self.names.append(node.s)
        super(ExportBinding, self).__init__(name, source)


class Scope(dict):
    importStarred = False       # set to True when import * is found

    def __repr__(self):
        scope_cls = self.__class__.__name__
        return '<%s at 0x%x %s>' % (scope_cls, id(self), dict.__repr__(self))


class ClassScope(Scope):
    pass


class FunctionScope(Scope):
    """
    I represent a name scope for a function.

    @ivar globals: Names declared 'global' in this function.
    """
    usesLocals = False
    alwaysUsed = set(['__tracebackhide__',
                      '__traceback_info__', '__traceback_supplement__'])

    def __init__(self):
        super(FunctionScope, self).__init__()
        # Simplify: manage the special locals as globals
        self.globals = self.alwaysUsed.copy()
        self.returnValue = None     # First non-empty return
        self.isGenerator = False    # Detect a generator

    def unusedAssignments(self):
        """
        Return a generator for the assignments which have not been used.
        """
        for name, binding in self.items():
            if (not binding.used and name not in self.globals
                    and not self.usesLocals
                    and isinstance(binding, Assignment)):
                yield name, binding


class GeneratorScope(Scope):
    pass


class ModuleScope(Scope):
    """Scope for a module."""
    _futures_allowed = True


class DoctestScope(ModuleScope):
    """Scope for a doctest."""


# Globally defined names which are not attributes of the builtins module, or
# are only present on some platforms.
_MAGIC_GLOBALS = ['__file__', '__builtins__', 'WindowsError']


def getNodeName(node):
    # Returns node.id, or node.name, or None
    if hasattr(node, 'id'):     # One of the many nodes with an id
        return node.id
    if hasattr(node, 'name'):   # an ExceptHandler node
        return node.name


class Checker(object):
    """
    I check the cleanliness and sanity of Python code.

    @ivar _deferredFunctions: Tracking list used by L{deferFunction}.  Elements
        of the list are two-tuples.  The first element is the callable passed
        to L{deferFunction}.  The second element is a copy of the scope stack
        at the time L{deferFunction} was called.

    @ivar _deferredAssignments: Similar to C{_deferredFunctions}, but for
        callables which are deferred assignment checks.
    """

    nodeDepth = 0
    offset = None
    traceTree = False

    builtIns = set(builtin_vars).union(_MAGIC_GLOBALS)
    _customBuiltIns = os.environ.get('PYFLAKES_BUILTINS')
    if _customBuiltIns:
        builtIns.update(_customBuiltIns.split(','))
    del _customBuiltIns

    def __init__(self, tree, filename='(none)', builtins=None,
                 withDoctest='PYFLAKES_DOCTEST' in os.environ):
        self._nodeHandlers = {}
        self._deferredFunctions = []
        self._deferredAssignments = []
        self.deadScopes = []
        self.messages = []
        self.filename = filename
        if builtins:
            self.builtIns = self.builtIns.union(builtins)
        self.withDoctest = withDoctest
        self.scopeStack = [ModuleScope()]
        self.exceptHandlers = [()]
        self.root = tree
        self.handleChildren(tree)
        self.runDeferred(self._deferredFunctions)
        # Set _deferredFunctions to None so that deferFunction will fail
        # noisily if called after we've run through the deferred functions.
        self._deferredFunctions = None
        self.runDeferred(self._deferredAssignments)
        # Set _deferredAssignments to None so that deferAssignment will fail
        # noisily if called after we've run through the deferred assignments.
        self._deferredAssignments = None
        del self.scopeStack[1:]
        self.popScope()
        self.checkDeadScopes()

    def deferFunction(self, callable):
        """
        Schedule a function handler to be called just before completion.

        This is used for handling function bodies, which must be deferred
        because code later in the file might modify the global scope. When
        `callable` is called, the scope at the time this is called will be
        restored, however it will contain any new bindings added to it.
        """
        self._deferredFunctions.append((callable, self.scopeStack[:], self.offset))

    def deferAssignment(self, callable):
        """
        Schedule an assignment handler to be called just after deferred
        function handlers.
        """
        self._deferredAssignments.append((callable, self.scopeStack[:], self.offset))

    def runDeferred(self, deferred):
        """
        Run the callables in C{deferred} using their associated scope stack.
        """
        for handler, scope, offset in deferred:
            self.scopeStack = scope
            self.offset = offset
            handler()

    def _in_doctest(self):
        return (len(self.scopeStack) >= 2 and
                isinstance(self.scopeStack[1], DoctestScope))

    @property
    def futuresAllowed(self):
        if not all(isinstance(scope, ModuleScope)
                   for scope in self.scopeStack):
            return False

        return self.scope._futures_allowed

    @futuresAllowed.setter
    def futuresAllowed(self, value):
        assert value is False
        if isinstance(self.scope, ModuleScope):
            self.scope._futures_allowed = False

    @property
    def scope(self):
        return self.scopeStack[-1]

    def popScope(self):
        self.deadScopes.append(self.scopeStack.pop())

    def checkDeadScopes(self):
        """
        Look at scopes which have been fully examined and report names in them
        which were imported but unused.
        """
        for scope in self.deadScopes:
            # imports in classes are public members
            if isinstance(scope, ClassScope):
                continue

            all_binding = scope.get('__all__')
            if all_binding and not isinstance(all_binding, ExportBinding):
                all_binding = None

            if all_binding:
                all_names = set(all_binding.names)
                undefined = all_names.difference(scope)
            else:
                all_names = undefined = []

            if undefined:
                if not scope.importStarred and \
                   os.path.basename(self.filename) != '__init__.py':
                    # Look for possible mistakes in the export list
                    for name in undefined:
                        self.report(messages.UndefinedExport,
                                    scope['__all__'].source, name)

                # mark all import '*' as used by the undefined in __all__
                if scope.importStarred:
                    for binding in scope.values():
                        if isinstance(binding, StarImportation):
                            binding.used = all_binding

            # Look for imported names that aren't used.
            for value in scope.values():
                if isinstance(value, Importation):
                    used = value.used or value.name in all_names
                    if not used:
                        messg = messages.UnusedImport
                        self.report(messg, value.source, str(value))
                    for node in value.redefined:
                        if isinstance(self.getParent(node), ast.For):
                            messg = messages.ImportShadowedByLoopVar
                        elif used:
                            continue
                        else:
                            messg = messages.RedefinedWhileUnused
                        self.report(messg, node, value.name, value.source)

    def pushScope(self, scopeClass=FunctionScope):
        self.scopeStack.append(scopeClass())

    def report(self, messageClass, *args, **kwargs):
        self.messages.append(messageClass(self.filename, *args, **kwargs))

    def getParent(self, node):
        # Lookup the first parent which is not Tuple, List or Starred
        while True:
            node = node.parent
            if not hasattr(node, 'elts') and not hasattr(node, 'ctx'):
                return node

    def getCommonAncestor(self, lnode, rnode, stop):
        if stop in (lnode, rnode) or not (hasattr(lnode, 'parent') and
                                          hasattr(rnode, 'parent')):
            return None
        if lnode is rnode:
            return lnode

        if (lnode.depth > rnode.depth):
            return self.getCommonAncestor(lnode.parent, rnode, stop)
        if (lnode.depth < rnode.depth):
            return self.getCommonAncestor(lnode, rnode.parent, stop)
        return self.getCommonAncestor(lnode.parent, rnode.parent, stop)

    def descendantOf(self, node, ancestors, stop):
        for a in ancestors:
            if self.getCommonAncestor(node, a, stop):
                return True
        return False

    def differentForks(self, lnode, rnode):
        """True, if lnode and rnode are located on different forks of IF/TRY"""
        ancestor = self.getCommonAncestor(lnode, rnode, self.root)
        parts = getAlternatives(ancestor)
        if parts:
            for items in parts:
                if self.descendantOf(lnode, items, ancestor) ^ \
                   self.descendantOf(rnode, items, ancestor):
                    return True
        return False

    def addBinding(self, node, value):
        """
        Called when a binding is altered.

        - `node` is the statement responsible for the change
        - `value` is the new value, a Binding instance
        """
        # assert value.source in (node, node.parent):
        for scope in self.scopeStack[::-1]:
            if value.name in scope:
                break
        existing = scope.get(value.name)

        if existing and not self.differentForks(node, existing.source):

            parent_stmt = self.getParent(value.source)
            if isinstance(existing, Importation) and isinstance(parent_stmt, ast.For):
                self.report(messages.ImportShadowedByLoopVar,
                            node, value.name, existing.source)

            elif scope is self.scope:
                if (isinstance(parent_stmt, ast.comprehension) and
                        not isinstance(self.getParent(existing.source),
                                       (ast.For, ast.comprehension))):
                    self.report(messages.RedefinedInListComp,
                                node, value.name, existing.source)
                elif not existing.used and value.redefines(existing):
                    self.report(messages.RedefinedWhileUnused,
                                node, value.name, existing.source)

            elif isinstance(existing, Importation) and value.redefines(existing):
                existing.redefined.append(node)

        if value.name in self.scope:
            # then assume the rebound name is used as a global or within a loop
            value.used = self.scope[value.name].used

        self.scope[value.name] = value

    def getNodeHandler(self, node_class):
        try:
            return self._nodeHandlers[node_class]
        except KeyError:
            nodeType = getNodeType(node_class)
        self._nodeHandlers[node_class] = handler = getattr(self, nodeType)
        return handler

    def handleNodeLoad(self, node):
        name = getNodeName(node)
        if not name:
            return

        in_generators = None
        importStarred = None

        # try enclosing function scopes and global scope
        for scope in self.scopeStack[-1::-1]:
            # only generators used in a class scope can access the names
            # of the class. this is skipped during the first iteration
            if in_generators is False and isinstance(scope, ClassScope):
                continue

            try:
                scope[name].used = (self.scope, node)
            except KeyError:
                pass
            else:
                return

            importStarred = importStarred or scope.importStarred

            if in_generators is not False:
                in_generators = isinstance(scope, GeneratorScope)

        # look in the built-ins
        if name in self.builtIns:
            return

        if importStarred:
            from_list = []

            for scope in self.scopeStack[-1::-1]:
                for binding in scope.values():
                    if isinstance(binding, StarImportation):
                        # mark '*' imports as used for each scope
                        binding.used = (self.scope, node)
                        from_list.append(binding.fullName)

            # report * usage, with a list of possible sources
            from_list = ', '.join(sorted(from_list))
            self.report(messages.ImportStarUsage, node, name, from_list)
            return

        if name == '__path__' and os.path.basename(self.filename) == '__init__.py':
            # the special name __path__ is valid only in packages
            return

        # protected with a NameError handler?
        if 'NameError' not in self.exceptHandlers[-1]:
            self.report(messages.UndefinedName, node, name)

    def handleNodeStore(self, node):
        name = getNodeName(node)
        if not name:
            return
        # if the name hasn't already been defined in the current scope
        if isinstance(self.scope, FunctionScope) and name not in self.scope:
            # for each function or module scope above us
            for scope in self.scopeStack[:-1]:
                if not isinstance(scope, (FunctionScope, ModuleScope)):
                    continue
                # if the name was defined in that scope, and the name has
                # been accessed already in the current scope, and hasn't
                # been declared global
                used = name in scope and scope[name].used
                if used and used[0] is self.scope and name not in self.scope.globals:
                    # then it's probably a mistake
                    self.report(messages.UndefinedLocal,
                                scope[name].used[1], name, scope[name].source)
                    break

        parent_stmt = self.getParent(node)
        if isinstance(parent_stmt, (ast.For, ast.comprehension)) or (
                parent_stmt != node.parent and
                not self.isLiteralTupleUnpacking(parent_stmt)):
            binding = Binding(name, node)
        elif name == '__all__' and isinstance(self.scope, ModuleScope):
            binding = ExportBinding(name, node.parent, self.scope)
        else:
            binding = Assignment(name, node)
        self.addBinding(node, binding)

    def handleNodeDelete(self, node):

        def on_conditional_branch():
            """
            Return `True` if node is part of a conditional body.
            """
            current = getattr(node, 'parent', None)
            while current:
                if isinstance(current, (ast.If, ast.While, ast.IfExp)):
                    return True
                current = getattr(current, 'parent', None)
            return False

        name = getNodeName(node)
        if not name:
            return

        if on_conditional_branch():
            # We cannot predict if this conditional branch is going to
            # be executed.
            return

        if isinstance(self.scope, FunctionScope) and name in self.scope.globals:
            self.scope.globals.remove(name)
        else:
            try:
                del self.scope[name]
            except KeyError:
                self.report(messages.UndefinedName, node, name)

    def handleChildren(self, tree, omit=None):
        for node in iter_child_nodes(tree, omit=omit):
            self.handleNode(node, tree)

    def isLiteralTupleUnpacking(self, node):
        if isinstance(node, ast.Assign):
            for child in node.targets + [node.value]:
                if not hasattr(child, 'elts'):
                    return False
            return True

    def isDocstring(self, node):
        """
        Determine if the given node is a docstring, as long as it is at the
        correct place in the node tree.
        """
        return isinstance(node, ast.Str) or (isinstance(node, ast.Expr) and
                                             isinstance(node.value, ast.Str))

    def getDocstring(self, node):
        if isinstance(node, ast.Expr):
            node = node.value
        if not isinstance(node, ast.Str):
            return (None, None)

        if PYPY:
            doctest_lineno = node.lineno - 1
        else:
            # Computed incorrectly if the docstring has backslash
            doctest_lineno = node.lineno - node.s.count('\n') - 1

        return (node.s, doctest_lineno)

    def handleNode(self, node, parent):
        if node is None:
            return
        if self.offset and getattr(node, 'lineno', None) is not None:
            node.lineno += self.offset[0]
            node.col_offset += self.offset[1]
        if self.traceTree:
            print('  ' * self.nodeDepth + node.__class__.__name__)
        if self.futuresAllowed and not (isinstance(node, ast.ImportFrom) or
                                        self.isDocstring(node)):
            self.futuresAllowed = False
        self.nodeDepth += 1
        node.depth = self.nodeDepth
        node.parent = parent
        try:
            handler = self.getNodeHandler(node.__class__)
            handler(node)
        finally:
            self.nodeDepth -= 1
        if self.traceTree:
            print('  ' * self.nodeDepth + 'end ' + node.__class__.__name__)

    _getDoctestExamples = doctest.DocTestParser().get_examples

    def handleDoctests(self, node):
        try:
            (docstring, node_lineno) = self.getDocstring(node.body[0])
            examples = docstring and self._getDoctestExamples(docstring)
        except (ValueError, IndexError):
            # e.g. line 6 of the docstring for <string> has inconsistent
            # leading whitespace: ...
            return
        if not examples:
            return

        # Place doctest in module scope
        saved_stack = self.scopeStack
        self.scopeStack = [self.scopeStack[0]]
        node_offset = self.offset or (0, 0)
        self.pushScope(DoctestScope)
        underscore_in_builtins = '_' in self.builtIns
        if not underscore_in_builtins:
            self.builtIns.add('_')
        for example in examples:
            try:
                tree = compile(example.source, "<doctest>", "exec", ast.PyCF_ONLY_AST)
            except SyntaxError:
                e = sys.exc_info()[1]
                if PYPY:
                    e.offset += 1
                position = (node_lineno + example.lineno + e.lineno,
                            example.indent + 4 + (e.offset or 0))
                self.report(messages.DoctestSyntaxError, node, position)
            else:
                self.offset = (node_offset[0] + node_lineno + example.lineno,
                               node_offset[1] + example.indent + 4)
                self.handleChildren(tree)
                self.offset = node_offset
        if not underscore_in_builtins:
            self.builtIns.remove('_')
        self.popScope()
        self.scopeStack = saved_stack

    def ignore(self, node):
        pass

    # "stmt" type nodes
    DELETE = PRINT = FOR = ASYNCFOR = WHILE = IF = WITH = WITHITEM = \
        ASYNCWITH = ASYNCWITHITEM = RAISE = TRYFINALLY = EXEC = \
        EXPR = ASSIGN = handleChildren

    PASS = ignore

    # "expr" type nodes
    BOOLOP = BINOP = UNARYOP = IFEXP = SET = \
        COMPARE = CALL = REPR = ATTRIBUTE = SUBSCRIPT = \
        STARRED = NAMECONSTANT = handleChildren

    NUM = STR = BYTES = ELLIPSIS = ignore

    # "slice" type nodes
    SLICE = EXTSLICE = INDEX = handleChildren

    # expression contexts are node instances too, though being constants
    LOAD = STORE = DEL = AUGLOAD = AUGSTORE = PARAM = ignore

    # same for operators
    AND = OR = ADD = SUB = MULT = DIV = MOD = POW = LSHIFT = RSHIFT = \
        BITOR = BITXOR = BITAND = FLOORDIV = INVERT = NOT = UADD = USUB = \
        EQ = NOTEQ = LT = LTE = GT = GTE = IS = ISNOT = IN = NOTIN = \
        MATMULT = ignore

    # additional node types
    COMPREHENSION = KEYWORD = FORMATTEDVALUE = JOINEDSTR = handleChildren

    def DICT(self, node):
        # Complain if there are duplicate keys with different values
        # If they have the same value it's not going to cause potentially
        # unexpected behaviour so we'll not complain.
        keys = [
            convert_to_value(key) for key in node.keys
        ]

        key_counts = counter(keys)
        duplicate_keys = [
            key for key, count in key_counts.items()
            if count > 1
        ]

        for key in duplicate_keys:
            key_indices = [i for i, i_key in enumerate(keys) if i_key == key]

            values = counter(
                convert_to_value(node.values[index])
                for index in key_indices
            )
            if any(count == 1 for value, count in values.items()):
                for key_index in key_indices:
                    key_node = node.keys[key_index]
                    if isinstance(key, VariableKey):
                        self.report(messages.MultiValueRepeatedKeyVariable,
                                    key_node,
                                    key.name)
                    else:
                        self.report(
                            messages.MultiValueRepeatedKeyLiteral,
                            key_node,
                            key,
                        )
        self.handleChildren(node)

    def ASSERT(self, node):
        if isinstance(node.test, ast.Tuple) and node.test.elts != []:
            self.report(messages.AssertTuple, node)
        self.handleChildren(node)

    def GLOBAL(self, node):
        """
        Keep track of globals declarations.
        """
        global_scope_index = 1 if self._in_doctest() else 0
        global_scope = self.scopeStack[global_scope_index]

        # Ignore 'global' statement in global scope.
        if self.scope is not global_scope:

            # One 'global' statement can bind multiple (comma-delimited) names.
            for node_name in node.names:
                node_value = Assignment(node_name, node)

                # Remove UndefinedName messages already reported for this name.
                # TODO: if the global is not used in this scope, it does not
                # become a globally defined name.  See test_unused_global.
                self.messages = [
                    m for m in self.messages if not
                    isinstance(m, messages.UndefinedName) or
                    m.message_args[0] != node_name]

                # Bind name to global scope if it doesn't exist already.
                global_scope.setdefault(node_name, node_value)

                # Bind name to non-global scopes, but as already "used".
                node_value.used = (global_scope, node)
                for scope in self.scopeStack[global_scope_index + 1:]:
                    scope[node_name] = node_value

    NONLOCAL = GLOBAL

    def GENERATOREXP(self, node):
        self.pushScope(GeneratorScope)
        self.handleChildren(node)
        self.popScope()

    LISTCOMP = handleChildren if PY2 else GENERATOREXP

    DICTCOMP = SETCOMP = GENERATOREXP

    def NAME(self, node):
        """
        Handle occurrence of Name (which can be a load/store/delete access.)
        """
        # Locate the name in locals / function / globals scopes.
        if isinstance(node.ctx, (ast.Load, ast.AugLoad)):
            self.handleNodeLoad(node)
            if (node.id == 'locals' and isinstance(self.scope, FunctionScope)
                    and isinstance(node.parent, ast.Call)):
                # we are doing locals() call in current scope
                self.scope.usesLocals = True
        elif isinstance(node.ctx, (ast.Store, ast.AugStore)):
            self.handleNodeStore(node)
        elif isinstance(node.ctx, ast.Del):
            self.handleNodeDelete(node)
        else:
            # must be a Param context -- this only happens for names in function
            # arguments, but these aren't dispatched through here
            raise RuntimeError("Got impossible expression context: %r" % (node.ctx,))

    def CONTINUE(self, node):
        # Walk the tree up until we see a loop (OK), a function or class
        # definition (not OK), for 'continue', a finally block (not OK), or
        # the top module scope (not OK)
        n = node
        while hasattr(n, 'parent'):
            n, n_child = n.parent, n
            if isinstance(n, LOOP_TYPES):
                # Doesn't apply unless it's in the loop itself
                if n_child not in n.orelse:
                    return
            if isinstance(n, (ast.FunctionDef, ast.ClassDef)):
                break
            # Handle Try/TryFinally difference in Python < and >= 3.3
            if hasattr(n, 'finalbody') and isinstance(node, ast.Continue):
                if n_child in n.finalbody:
                    self.report(messages.ContinueInFinally, node)
                    return
        if isinstance(node, ast.Continue):
            self.report(messages.ContinueOutsideLoop, node)
        else:  # ast.Break
            self.report(messages.BreakOutsideLoop, node)

    BREAK = CONTINUE

    def RETURN(self, node):
        if isinstance(self.scope, (ClassScope, ModuleScope)):
            self.report(messages.ReturnOutsideFunction, node)
            return

        if (
            node.value and
            hasattr(self.scope, 'returnValue') and
            not self.scope.returnValue
        ):
            self.scope.returnValue = node.value
        self.handleNode(node.value, node)

    def YIELD(self, node):
        if isinstance(self.scope, (ClassScope, ModuleScope)):
            self.report(messages.YieldOutsideFunction, node)
            return

        self.scope.isGenerator = True
        self.handleNode(node.value, node)

    AWAIT = YIELDFROM = YIELD

    def FUNCTIONDEF(self, node):
        for deco in node.decorator_list:
            self.handleNode(deco, node)
        self.LAMBDA(node)
        self.addBinding(node, FunctionDefinition(node.name, node))
        # doctest does not process doctest within a doctest,
        # or in nested functions.
        if (self.withDoctest and
                not self._in_doctest() and
                not isinstance(self.scope, FunctionScope)):
            self.deferFunction(lambda: self.handleDoctests(node))

    ASYNCFUNCTIONDEF = FUNCTIONDEF

    def LAMBDA(self, node):
        args = []
        annotations = []

        if PY2:
            def addArgs(arglist):
                for arg in arglist:
                    if isinstance(arg, ast.Tuple):
                        addArgs(arg.elts)
                    else:
                        args.append(arg.id)
            addArgs(node.args.args)
            defaults = node.args.defaults
        else:
            for arg in node.args.args + node.args.kwonlyargs:
                args.append(arg.arg)
                annotations.append(arg.annotation)
            defaults = node.args.defaults + node.args.kw_defaults

        # Only for Python3 FunctionDefs
        is_py3_func = hasattr(node, 'returns')

        for arg_name in ('vararg', 'kwarg'):
            wildcard = getattr(node.args, arg_name)
            if not wildcard:
                continue
            args.append(wildcard if PY33 else wildcard.arg)
            if is_py3_func:
                if PY33:  # Python 2.5 to 3.3
                    argannotation = arg_name + 'annotation'
                    annotations.append(getattr(node.args, argannotation))
                else:     # Python >= 3.4
                    annotations.append(wildcard.annotation)

        if is_py3_func:
            annotations.append(node.returns)

        if len(set(args)) < len(args):
            for (idx, arg) in enumerate(args):
                if arg in args[:idx]:
                    self.report(messages.DuplicateArgument, node, arg)

        for child in annotations + defaults:
            if child:
                self.handleNode(child, node)

        def runFunction():

            self.pushScope()
            for name in args:
                self.addBinding(node, Argument(name, node))
            if isinstance(node.body, list):
                # case for FunctionDefs
                for stmt in node.body:
                    self.handleNode(stmt, node)
            else:
                # case for Lambdas
                self.handleNode(node.body, node)

            def checkUnusedAssignments():
                """
                Check to see if any assignments have not been used.
                """
                for name, binding in self.scope.unusedAssignments():
                    self.report(messages.UnusedVariable, binding.source, name)
            self.deferAssignment(checkUnusedAssignments)

            if PY32:
                def checkReturnWithArgumentInsideGenerator():
                    """
                    Check to see if there is any return statement with
                    arguments but the function is a generator.
                    """
                    if self.scope.isGenerator and self.scope.returnValue:
                        self.report(messages.ReturnWithArgsInsideGenerator,
                                    self.scope.returnValue)
                self.deferAssignment(checkReturnWithArgumentInsideGenerator)
            self.popScope()

        self.deferFunction(runFunction)

    def CLASSDEF(self, node):
        """
        Check names used in a class definition, including its decorators, base
        classes, and the body of its definition.  Additionally, add its name to
        the current scope.
        """
        for deco in node.decorator_list:
            self.handleNode(deco, node)
        for baseNode in node.bases:
            self.handleNode(baseNode, node)
        if not PY2:
            for keywordNode in node.keywords:
                self.handleNode(keywordNode, node)
        self.pushScope(ClassScope)
        # doctest does not process doctest within a doctest
        # classes within classes are processed.
        if (self.withDoctest and
                not self._in_doctest() and
                not isinstance(self.scope, FunctionScope)):
            self.deferFunction(lambda: self.handleDoctests(node))
        for stmt in node.body:
            self.handleNode(stmt, node)
        self.popScope()
        self.addBinding(node, ClassDefinition(node.name, node))

    def AUGASSIGN(self, node):
        self.handleNodeLoad(node.target)
        self.handleNode(node.value, node)
        self.handleNode(node.target, node)

    def TUPLE(self, node):
        if not PY2 and isinstance(node.ctx, ast.Store):
            # Python 3 advanced tuple unpacking: a, *b, c = d.
            # Only one starred expression is allowed, and no more than 1<<8
            # assignments are allowed before a stared expression. There is
            # also a limit of 1<<24 expressions after the starred expression,
            # which is impossible to test due to memory restrictions, but we
            # add it here anyway
            has_starred = False
            star_loc = -1
            for i, n in enumerate(node.elts):
                if isinstance(n, ast.Starred):
                    if has_starred:
                        self.report(messages.TwoStarredExpressions, node)
                        # The SyntaxError doesn't distinguish two from more
                        # than two.
                        break
                    has_starred = True
                    star_loc = i
            if star_loc >= 1 << 8 or len(node.elts) - star_loc - 1 >= 1 << 24:
                self.report(messages.TooManyExpressionsInStarredAssignment, node)
        self.handleChildren(node)

    LIST = TUPLE

    def IMPORT(self, node):
        for alias in node.names:
            if '.' in alias.name and not alias.asname:
                importation = SubmoduleImportation(alias.name, node)
            else:
                name = alias.asname or alias.name
                importation = Importation(name, node, alias.name)
            self.addBinding(node, importation)

    def IMPORTFROM(self, node):
        if node.module == '__future__':
            if not self.futuresAllowed:
                self.report(messages.LateFutureImport,
                            node, [n.name for n in node.names])
        else:
            self.futuresAllowed = False

        module = ('.' * node.level) + (node.module or '')

        for alias in node.names:
            name = alias.asname or alias.name
            if node.module == '__future__':
                importation = FutureImportation(name, node, self.scope)
                if alias.name not in __future__.all_feature_names:
                    self.report(messages.FutureFeatureNotDefined,
                                node, alias.name)
            elif alias.name == '*':
                # Only Python 2, local import * is a SyntaxWarning
                if not PY2 and not isinstance(self.scope, ModuleScope):
                    self.report(messages.ImportStarNotPermitted,
                                node, module)
                    continue

                self.scope.importStarred = True
                self.report(messages.ImportStarUsed, node, module)
                importation = StarImportation(module, node)
            else:
                importation = ImportationFrom(name, node,
                                              module, alias.name)
            self.addBinding(node, importation)

    def TRY(self, node):
        handler_names = []
        # List the exception handlers
        for i, handler in enumerate(node.handlers):
            if isinstance(handler.type, ast.Tuple):
                for exc_type in handler.type.elts:
                    handler_names.append(getNodeName(exc_type))
            elif handler.type:
                handler_names.append(getNodeName(handler.type))

            if handler.type is None and i < len(node.handlers) - 1:
                self.report(messages.DefaultExceptNotLast, handler)
        # Memorize the except handlers and process the body
        self.exceptHandlers.append(handler_names)
        for child in node.body:
            self.handleNode(child, node)
        self.exceptHandlers.pop()
        # Process the other nodes: "except:", "else:", "finally:"
        self.handleChildren(node, omit='body')

    TRYEXCEPT = TRY

    def EXCEPTHANDLER(self, node):
        if PY2 or node.name is None:
            self.handleChildren(node)
            return

        # 3.x: the name of the exception, which is not a Name node, but
        # a simple string, creates a local that is only bound within the scope
        # of the except: block.

        for scope in self.scopeStack[::-1]:
            if node.name in scope:
                is_name_previously_defined = True
                break
        else:
            is_name_previously_defined = False

        self.handleNodeStore(node)
        self.handleChildren(node)
        if not is_name_previously_defined:
            # See discussion on https://github.com/PyCQA/pyflakes/pull/59

            # We're removing the local name since it's being unbound
            # after leaving the except: block and it's always unbound
            # if the except: block is never entered. This will cause an
            # "undefined name" error raised if the checked code tries to
            # use the name afterwards.
            #
            # Unless it's been removed already. Then do nothing.

            try:
                del self.scope[node.name]
            except KeyError:
                pass

    def ANNASSIGN(self, node):
        """
        Annotated assignments don't have annotations evaluated on function
        scope, hence the custom implementation.

        See: PEP 526.
        """
        if node.value:
            # Only bind the *targets* if the assignment has a value.
            # Otherwise it's not really ast.Store and shouldn't silence
            # UndefinedLocal warnings.
            self.handleNode(node.target, node)
        if not isinstance(self.scope, FunctionScope):
            self.handleNode(node.annotation, node)
        if node.value:
            # If the assignment has value, handle the *value* now.
            self.handleNode(node.value, node)
