# Copyright (c) 2006-2007, 2009-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""tests for specific behaviour of astroid nodes
"""
import os
import sys
import textwrap
import unittest
import warnings

import six

import astroid
from astroid import bases
from astroid import builder
from astroid import context as contextmod
from astroid import exceptions
from astroid import node_classes
from astroid import nodes
from astroid import parse
from astroid import util
from astroid import test_utils
from astroid import transforms
from astroid.tests import resources


abuilder = builder.AstroidBuilder()
BUILTINS = six.moves.builtins.__name__


class AsStringTest(resources.SysPathSetup, unittest.TestCase):

    def test_tuple_as_string(self):
        def build(string):
            return abuilder.string_build(string).body[0].value

        self.assertEqual(build('1,').as_string(), '(1, )')
        self.assertEqual(build('1, 2, 3').as_string(), '(1, 2, 3)')
        self.assertEqual(build('(1, )').as_string(), '(1, )')
        self.assertEqual(build('1, 2, 3').as_string(), '(1, 2, 3)')

    @test_utils.require_version(minver='3.0')
    def test_func_signature_issue_185(self):
        code = textwrap.dedent('''
        def test(a, b, c=42, *, x=42, **kwargs):
            print(a, b, c, args)
        ''')
        node = parse(code)
        self.assertEqual(node.as_string().strip(), code.strip())

    def test_as_string_for_list_containing_uninferable(self):
        node = builder.extract_node('''
        def foo():
            bar = [arg] * 1
        ''')
        binop = node.body[0].value
        inferred = next(binop.infer())
        self.assertEqual(inferred.as_string(), '[Uninferable]')
        self.assertEqual(binop.as_string(), '([arg]) * (1)')

    def test_frozenset_as_string(self):
        ast_nodes = builder.extract_node('''
        frozenset((1, 2, 3)) #@
        frozenset({1, 2, 3}) #@
        frozenset([1, 2, 3,]) #@

        frozenset(None) #@
        frozenset(1) #@
        ''')
        ast_nodes = [next(node.infer()) for node in ast_nodes]

        self.assertEqual(ast_nodes[0].as_string(), 'frozenset((1, 2, 3))')
        self.assertEqual(ast_nodes[1].as_string(), 'frozenset({1, 2, 3})')
        self.assertEqual(ast_nodes[2].as_string(), 'frozenset([1, 2, 3])')

        self.assertNotEqual(ast_nodes[3].as_string(), 'frozenset(None)')
        self.assertNotEqual(ast_nodes[4].as_string(), 'frozenset(1)')

    def test_varargs_kwargs_as_string(self):
        ast = abuilder.string_build('raise_string(*args, **kwargs)').body[0]
        self.assertEqual(ast.as_string(), 'raise_string(*args, **kwargs)')

    def test_module_as_string(self):
        """check as_string on a whole module prepared to be returned identically
        """
        module = resources.build_file('data/module.py', 'data.module')
        with open(resources.find('data/module.py'), 'r') as fobj:
            self.assertMultiLineEqual(module.as_string(), fobj.read())

    def test_module2_as_string(self):
        """check as_string on a whole module prepared to be returned identically
        """
        module2 = resources.build_file('data/module2.py', 'data.module2')
        with open(resources.find('data/module2.py'), 'r') as fobj:
            self.assertMultiLineEqual(module2.as_string(), fobj.read())

    def test_as_string(self):
        """check as_string for python syntax >= 2.7"""
        code = '''one_two = {1, 2}
b = {v: k for (k, v) in enumerate('string')}
cdd = {k for k in b}\n\n'''
        ast = abuilder.string_build(code)
        self.assertMultiLineEqual(ast.as_string(), code)

    @test_utils.require_version('3.0')
    def test_3k_as_string(self):
        """check as_string for python 3k syntax"""
        code = '''print()

def function(var):
    nonlocal counter
    try:
        hello
    except NameError as nexc:
        (*hell, o) = b'hello'
        raise AttributeError from nexc
\n'''
        ast = abuilder.string_build(code)
        self.assertEqual(ast.as_string(), code)

    @test_utils.require_version('3.0')
    @unittest.expectedFailure
    def test_3k_annotations_and_metaclass(self):
        code_annotations = textwrap.dedent('''
        def function(var:int):
            nonlocal counter

        class Language(metaclass=Natural):
            """natural language"""
        ''')

        ast = abuilder.string_build(code_annotations)
        self.assertEqual(ast.as_string(), code_annotations)

    def test_ellipsis(self):
        ast = abuilder.string_build('a[...]').body[0]
        self.assertEqual(ast.as_string(), 'a[...]')

    def test_slices(self):
        for code in ('a[0]', 'a[1:3]', 'a[:-1:step]', 'a[:,newaxis]',
                     'a[newaxis,:]', 'del L[::2]', 'del A[1]', 'del Br[:]'):
            ast = abuilder.string_build(code).body[0]
            self.assertEqual(ast.as_string(), code)

    def test_slice_and_subscripts(self):
        code = """a[:1] = bord[2:]
a[:1] = bord[2:]
del bree[3:d]
bord[2:]
del av[d::f], a[df:]
a[:1] = bord[2:]
del SRC[::1,newaxis,1:]
tous[vals] = 1010
del thousand[key]
del a[::2], a[:-1:step]
del Fee.form[left:]
aout.vals = miles.of_stuff
del (ccok, (name.thing, foo.attrib.value)), Fee.form[left:]
if all[1] == bord[0:]:
    pass\n\n"""
        ast = abuilder.string_build(code)
        self.assertEqual(ast.as_string(), code)


class _NodeTest(unittest.TestCase):
    """test transformation of If Node"""
    CODE = None

    @property
    def astroid(self):
        try:
            return self.__class__.__dict__['CODE_Astroid']
        except KeyError:
            module = builder.parse(self.CODE)
            self.__class__.CODE_Astroid = module
            return module


class IfNodeTest(_NodeTest):
    """test transformation of If Node"""
    CODE = """
        if 0:
            print()

        if True:
            print()
        else:
            pass

        if "":
            print()
        elif []:
            raise

        if 1:
            print()
        elif True:
            print()
        elif func():
            pass
        else:
            raise
    """

    def test_if_elif_else_node(self):
        """test transformation for If node"""
        self.assertEqual(len(self.astroid.body), 4)
        for stmt in self.astroid.body:
            self.assertIsInstance(stmt, nodes.If)
        self.assertFalse(self.astroid.body[0].orelse)  # simple If
        self.assertIsInstance(self.astroid.body[1].orelse[0], nodes.Pass)  # If / else
        self.assertIsInstance(self.astroid.body[2].orelse[0], nodes.If)  # If / elif
        self.assertIsInstance(self.astroid.body[3].orelse[0].orelse[0], nodes.If)

    def test_block_range(self):
        # XXX ensure expected values
        self.assertEqual(self.astroid.block_range(1), (0, 22))
        self.assertEqual(self.astroid.block_range(10), (0, 22))  # XXX (10, 22) ?
        self.assertEqual(self.astroid.body[1].block_range(5), (5, 6))
        self.assertEqual(self.astroid.body[1].block_range(6), (6, 6))
        self.assertEqual(self.astroid.body[1].orelse[0].block_range(7), (7, 8))
        self.assertEqual(self.astroid.body[1].orelse[0].block_range(8), (8, 8))


class TryExceptNodeTest(_NodeTest):
    CODE = """
        try:
            print ('pouet')
        except IOError:
            pass
        except UnicodeError:
            print()
        else:
            print()
    """

    def test_block_range(self):
        # XXX ensure expected values
        self.assertEqual(self.astroid.body[0].block_range(1), (1, 8))
        self.assertEqual(self.astroid.body[0].block_range(2), (2, 2))
        self.assertEqual(self.astroid.body[0].block_range(3), (3, 8))
        self.assertEqual(self.astroid.body[0].block_range(4), (4, 4))
        self.assertEqual(self.astroid.body[0].block_range(5), (5, 5))
        self.assertEqual(self.astroid.body[0].block_range(6), (6, 6))
        self.assertEqual(self.astroid.body[0].block_range(7), (7, 7))
        self.assertEqual(self.astroid.body[0].block_range(8), (8, 8))


class TryFinallyNodeTest(_NodeTest):
    CODE = """
        try:
            print ('pouet')
        finally:
            print ('pouet')
    """

    def test_block_range(self):
        # XXX ensure expected values
        self.assertEqual(self.astroid.body[0].block_range(1), (1, 4))
        self.assertEqual(self.astroid.body[0].block_range(2), (2, 2))
        self.assertEqual(self.astroid.body[0].block_range(3), (3, 4))
        self.assertEqual(self.astroid.body[0].block_range(4), (4, 4))


class TryExceptFinallyNodeTest(_NodeTest):
    CODE = """
        try:
            print('pouet')
        except Exception:
            print ('oops')
        finally:
            print ('pouet')
    """

    def test_block_range(self):
        # XXX ensure expected values
        self.assertEqual(self.astroid.body[0].block_range(1), (1, 6))
        self.assertEqual(self.astroid.body[0].block_range(2), (2, 2))
        self.assertEqual(self.astroid.body[0].block_range(3), (3, 4))
        self.assertEqual(self.astroid.body[0].block_range(4), (4, 4))
        self.assertEqual(self.astroid.body[0].block_range(5), (5, 5))
        self.assertEqual(self.astroid.body[0].block_range(6), (6, 6))


@unittest.skipIf(six.PY3, "Python 2 specific test.")
class TryExcept2xNodeTest(_NodeTest):
    CODE = """
        try:
            hello
        except AttributeError, (retval, desc):
            pass
    """


    def test_tuple_attribute(self):
        handler = self.astroid.body[0].handlers[0]
        self.assertIsInstance(handler.name, nodes.Tuple)


class ImportNodeTest(resources.SysPathSetup, unittest.TestCase):
    def setUp(self):
        super(ImportNodeTest, self).setUp()
        self.module = resources.build_file('data/module.py', 'data.module')
        self.module2 = resources.build_file('data/module2.py', 'data.module2')

    def test_import_self_resolve(self):
        myos = next(self.module2.igetattr('myos'))
        self.assertTrue(isinstance(myos, nodes.Module), myos)
        self.assertEqual(myos.name, 'os')
        self.assertEqual(myos.qname(), 'os')
        self.assertEqual(myos.pytype(), '%s.module' % BUILTINS)

    def test_from_self_resolve(self):
        namenode = next(self.module.igetattr('NameNode'))
        self.assertTrue(isinstance(namenode, nodes.ClassDef), namenode)
        self.assertEqual(namenode.root().name, 'astroid.node_classes')
        self.assertEqual(namenode.qname(), 'astroid.node_classes.Name')
        self.assertEqual(namenode.pytype(), '%s.type' % BUILTINS)
        abspath = next(self.module2.igetattr('abspath'))
        self.assertTrue(isinstance(abspath, nodes.FunctionDef), abspath)
        self.assertEqual(abspath.root().name, 'os.path')
        self.assertEqual(abspath.qname(), 'os.path.abspath')
        self.assertEqual(abspath.pytype(), '%s.function' % BUILTINS)

    def test_real_name(self):
        from_ = self.module['NameNode']
        self.assertEqual(from_.real_name('NameNode'), 'Name')
        imp_ = self.module['os']
        self.assertEqual(imp_.real_name('os'), 'os')
        self.assertRaises(exceptions.AttributeInferenceError, imp_.real_name, 'os.path')
        imp_ = self.module['NameNode']
        self.assertEqual(imp_.real_name('NameNode'), 'Name')
        self.assertRaises(exceptions.AttributeInferenceError, imp_.real_name, 'Name')
        imp_ = self.module2['YO']
        self.assertEqual(imp_.real_name('YO'), 'YO')
        self.assertRaises(exceptions.AttributeInferenceError, imp_.real_name, 'data')

    def test_as_string(self):
        ast = self.module['modutils']
        self.assertEqual(ast.as_string(), "from astroid import modutils")
        ast = self.module['NameNode']
        self.assertEqual(ast.as_string(), "from astroid.node_classes import Name as NameNode")
        ast = self.module['os']
        self.assertEqual(ast.as_string(), "import os.path")
        code = """from . import here
from .. import door
from .store import bread
from ..cave import wine\n\n"""
        ast = abuilder.string_build(code)
        self.assertMultiLineEqual(ast.as_string(), code)

    def test_bad_import_inference(self):
        # Explication of bug
        '''When we import PickleError from nonexistent, a call to the infer
        method of this From node will be made by unpack_infer.
        inference.infer_from will try to import this module, which will fail and
        raise a InferenceException (by mixins.do_import_module). The infer_name
        will catch this exception and yield and Uninferable instead.
        '''

        code = '''
            try:
                from pickle import PickleError
            except ImportError:
                from nonexistent import PickleError

            try:
                pass
            except PickleError:
                pass
        '''
        module = builder.parse(code)
        handler_type = module.body[1].handlers[0].type

        excs = list(node_classes.unpack_infer(handler_type))
        # The number of returned object can differ on Python 2
        # and Python 3. In one version, an additional item will
        # be returned, from the _pickle module, which is not
        # present in the other version.
        self.assertIsInstance(excs[0], nodes.ClassDef)
        self.assertEqual(excs[0].name, 'PickleError')
        self.assertIs(excs[-1], util.Uninferable)

    def test_absolute_import(self):
        module = resources.build_file('data/absimport.py')
        ctx = contextmod.InferenceContext()
        # will fail if absolute import failed
        ctx.lookupname = 'message'
        next(module['message'].infer(ctx))
        ctx.lookupname = 'email'
        m = next(module['email'].infer(ctx))
        self.assertFalse(m.file.startswith(os.path.join('data', 'email.py')))

    def test_more_absolute_import(self):
        module = resources.build_file('data/module1abs/__init__.py', 'data.module1abs')
        self.assertIn('sys', module.locals)


class CmpNodeTest(unittest.TestCase):
    def test_as_string(self):
        ast = abuilder.string_build("a == 2").body[0]
        self.assertEqual(ast.as_string(), "a == 2")


class ConstNodeTest(unittest.TestCase):

    def _test(self, value):
        # pylint: disable=no-member; union type in const_factory, this shouldn't happen
        node = nodes.const_factory(value)
        self.assertIsInstance(node._proxied, nodes.ClassDef)
        self.assertEqual(node._proxied.name, value.__class__.__name__)
        self.assertIs(node.value, value)
        self.assertTrue(node._proxied.parent)
        self.assertEqual(node._proxied.root().name, value.__class__.__module__)

    def test_none(self):
        self._test(None)

    def test_bool(self):
        self._test(True)

    def test_int(self):
        self._test(1)

    def test_float(self):
        self._test(1.0)

    def test_complex(self):
        self._test(1.0j)

    def test_str(self):
        self._test('a')

    def test_unicode(self):
        self._test(u'a')


class NameNodeTest(unittest.TestCase):
    def test_assign_to_True(self):
        """test that True and False assignments don't crash"""
        code = """
            True = False
            def hello(False):
                pass
            del True
        """
        if sys.version_info >= (3, 0):
            with self.assertRaises(exceptions.AstroidBuildingError):
                builder.parse(code)
        else:
            ast = builder.parse(code)
            assign_true = ast['True']
            self.assertIsInstance(assign_true, nodes.AssignName)
            self.assertEqual(assign_true.name, "True")
            del_true = ast.body[2].targets[0]
            self.assertIsInstance(del_true, nodes.DelName)
            self.assertEqual(del_true.name, "True")


class AnnAssignNodeTest(unittest.TestCase):
    @test_utils.require_version(minver='3.6')
    def test_primitive(self):
        code = textwrap.dedent("""
            test: int = 5
        """)
        assign = builder.extract_node(code)
        self.assertIsInstance(assign, nodes.AnnAssign)
        self.assertEqual(assign.target.name, "test")
        self.assertEqual(assign.annotation.name, "int")
        self.assertEqual(assign.value.value, 5)
        self.assertEqual(assign.simple, 1)

    @test_utils.require_version(minver='3.6')
    def test_primitive_without_initial_value(self):
        code = textwrap.dedent("""
            test: str
        """)
        assign = builder.extract_node(code)
        self.assertIsInstance(assign, nodes.AnnAssign)
        self.assertEqual(assign.target.name, "test")
        self.assertEqual(assign.annotation.name, "str")
        self.assertEqual(assign.value, None)

    @test_utils.require_version(minver='3.6')
    def test_complex(self):
        code = textwrap.dedent("""
            test: Dict[List[str]] = {}
        """)
        assign = builder.extract_node(code)
        self.assertIsInstance(assign, nodes.AnnAssign)
        self.assertEqual(assign.target.name, "test")
        self.assertIsInstance(assign.annotation, astroid.Subscript)
        self.assertIsInstance(assign.value, astroid.Dict)

    @test_utils.require_version(minver='3.6')
    def test_as_string(self):
        code = textwrap.dedent("""
            print()
            test: int = 5
            test2: str
            test3: List[Dict[(str, str)]] = []
        """)
        ast = abuilder.string_build(code)
        self.assertEqual(ast.as_string().strip(), code.strip())


class ArgumentsNodeTC(unittest.TestCase):
    def test_linenumbering(self):
        ast = builder.parse('''
            def func(a,
                b): pass
            x = lambda x: None
        ''')
        self.assertEqual(ast['func'].args.fromlineno, 2)
        self.assertFalse(ast['func'].args.is_statement)
        xlambda = next(ast['x'].infer())
        self.assertEqual(xlambda.args.fromlineno, 4)
        self.assertEqual(xlambda.args.tolineno, 4)
        self.assertFalse(xlambda.args.is_statement)
        if sys.version_info < (3, 0):
            self.assertEqual(ast['func'].args.tolineno, 3)
        else:
            self.skipTest('FIXME  http://bugs.python.org/issue10445 '
                          '(no line number on function args)')

    @test_utils.require_version(minver='3.0')
    def test_kwoargs(self):
        ast = builder.parse('''
            def func(*, x):
                pass
        ''')
        args = ast['func'].args
        self.assertTrue(args.is_argument('x'))


class UnboundMethodNodeTest(unittest.TestCase):

    def test_no_super_getattr(self):
        # This is a test for issue
        # https://bitbucket.org/logilab/astroid/issue/91, which tests
        # that UnboundMethod doesn't call super when doing .getattr.

        ast = builder.parse('''
        class A(object):
            def test(self):
                pass
        meth = A.test
        ''')
        node = next(ast['meth'].infer())
        with self.assertRaises(exceptions.AttributeInferenceError):
            node.getattr('__missssing__')
        name = node.getattr('__name__')[0]
        self.assertIsInstance(name, nodes.Const)
        self.assertEqual(name.value, 'test')


class BoundMethodNodeTest(unittest.TestCase):

    def test_is_property(self):
        ast = builder.parse('''
        import abc

        def cached_property():
            # Not a real decorator, but we don't care
            pass
        def reify():
            # Same as cached_property
            pass
        def lazy_property():
            pass
        def lazyproperty():
            pass
        def lazy(): pass
        class A(object):
            @property
            def builtin_property(self):
                return 42
            @abc.abstractproperty
            def abc_property(self):
                return 42
            @cached_property
            def cached_property(self): return 42
            @reify
            def reified(self): return 42
            @lazy_property
            def lazy_prop(self): return 42
            @lazyproperty
            def lazyprop(self): return 42
            def not_prop(self): pass
            @lazy
            def decorated_with_lazy(self): return 42

        cls = A()
        builtin_property = cls.builtin_property
        abc_property = cls.abc_property
        cached_p = cls.cached_property
        reified = cls.reified
        not_prop = cls.not_prop
        lazy_prop = cls.lazy_prop
        lazyprop = cls.lazyprop
        decorated_with_lazy = cls.decorated_with_lazy
        ''')
        for prop in ('builtin_property', 'abc_property', 'cached_p', 'reified',
                     'lazy_prop', 'lazyprop', 'decorated_with_lazy'):
            inferred = next(ast[prop].infer())
            self.assertIsInstance(inferred, nodes.Const, prop)
            self.assertEqual(inferred.value, 42, prop)

        inferred = next(ast['not_prop'].infer())
        self.assertIsInstance(inferred, bases.BoundMethod)


class AliasesTest(unittest.TestCase):

    def setUp(self):
        self.transformer = transforms.TransformVisitor()

    def parse_transform(self, code):
        module = parse(code, apply_transforms=False)
        return self.transformer.visit(module)

    def test_aliases(self):
        def test_from(node):
            node.names = node.names + [('absolute_import', None)]
            return node

        def test_class(node):
            node.name = 'Bar'
            return node

        def test_function(node):
            node.name = 'another_test'
            return node

        def test_callfunc(node):
            if node.func.name == 'Foo':
                node.func.name = 'Bar'
                return node

        def test_assname(node):
            if node.name == 'foo':
                return nodes.AssignName('bar', node.lineno, node.col_offset,
                                        node.parent)
        def test_assattr(node):
            if node.attrname == 'a':
                node.attrname = 'b'
                return node

        def test_getattr(node):
            if node.attrname == 'a':
                node.attrname = 'b'
                return node

        def test_genexpr(node):
            if node.elt.value == 1:
                node.elt = nodes.Const(2, node.lineno, node.col_offset,
                                       node.parent)
                return node

        self.transformer.register_transform(nodes.From, test_from)
        self.transformer.register_transform(nodes.Class, test_class)
        self.transformer.register_transform(nodes.Function, test_function)
        self.transformer.register_transform(nodes.CallFunc, test_callfunc)
        self.transformer.register_transform(nodes.AssName, test_assname)
        self.transformer.register_transform(nodes.AssAttr, test_assattr)
        self.transformer.register_transform(nodes.Getattr, test_getattr)
        self.transformer.register_transform(nodes.GenExpr, test_genexpr)

        string = '''
        from __future__ import print_function

        class Foo: pass

        def test(a): return a

        foo = Foo()
        foo.a = test(42)
        foo.a
        (1 for _ in range(0, 42))
        '''

        module = self.parse_transform(string)

        self.assertEqual(len(module.body[0].names), 2)
        self.assertIsInstance(module.body[0], nodes.ImportFrom)
        self.assertEqual(module.body[1].name, 'Bar')
        self.assertIsInstance(module.body[1], nodes.ClassDef)
        self.assertEqual(module.body[2].name, 'another_test')
        self.assertIsInstance(module.body[2], nodes.FunctionDef)
        self.assertEqual(module.body[3].targets[0].name, 'bar')
        self.assertIsInstance(module.body[3].targets[0], nodes.AssignName)
        self.assertEqual(module.body[3].value.func.name, 'Bar')
        self.assertIsInstance(module.body[3].value, nodes.Call)
        self.assertEqual(module.body[4].targets[0].attrname, 'b')
        self.assertIsInstance(module.body[4].targets[0], nodes.AssignAttr)
        self.assertIsInstance(module.body[5], nodes.Expr)
        self.assertEqual(module.body[5].value.attrname, 'b')
        self.assertIsInstance(module.body[5].value, nodes.Attribute)
        self.assertEqual(module.body[6].value.elt.value, 2)
        self.assertIsInstance(module.body[6].value, nodes.GeneratorExp)

    @unittest.skipIf(six.PY3, "Python 3 doesn't have Repr nodes.")
    def test_repr(self):
        def test_backquote(node):
            node.value.name = 'bar'
            return node

        self.transformer.register_transform(nodes.Backquote, test_backquote)

        module = self.parse_transform('`foo`')

        self.assertEqual(module.body[0].value.value.name, 'bar')
        self.assertIsInstance(module.body[0].value, nodes.Repr)


class DeprecationWarningsTest(unittest.TestCase):
    def test_asstype_warnings(self):
        string = '''
        class C: pass
        c = C()
        with warnings.catch_warnings(record=True) as w:
            pass
        '''
        module = parse(string)
        filter_stmts_mixin = module.body[0]
        assign_type_mixin = module.body[1].targets[0]
        parent_assign_type_mixin = module.body[2]

        with warnings.catch_warnings(record=True) as w:
            with test_utils.enable_warning(PendingDeprecationWarning):
                filter_stmts_mixin.ass_type()
                self.assertIsInstance(w[0].message, PendingDeprecationWarning)
        with warnings.catch_warnings(record=True) as w:
            with test_utils.enable_warning(PendingDeprecationWarning):
                assign_type_mixin.ass_type()
                self.assertIsInstance(w[0].message, PendingDeprecationWarning)
        with warnings.catch_warnings(record=True) as w:
            with test_utils.enable_warning(PendingDeprecationWarning):
                parent_assign_type_mixin.ass_type()
                self.assertIsInstance(w[0].message, PendingDeprecationWarning)

    def test_isinstance_warnings(self):
        msg_format = ("%r is deprecated and slated for removal in astroid "
                      "2.0, use %r instead")
        for cls in (nodes.Discard, nodes.Backquote, nodes.AssName,
                    nodes.AssAttr, nodes.Getattr, nodes.CallFunc, nodes.From):
            with warnings.catch_warnings(record=True) as w:
                with test_utils.enable_warning(PendingDeprecationWarning):
                    isinstance(42, cls)
            self.assertIsInstance(w[0].message, PendingDeprecationWarning)
            actual_msg = msg_format % (cls.__class__.__name__, cls.__wrapped__.__name__)
            self.assertEqual(str(w[0].message), actual_msg)


@test_utils.require_version('3.5')
class Python35AsyncTest(unittest.TestCase):

    def test_async_await_keywords(self):
        async_def, async_for, async_with, await_node = builder.extract_node('''
        async def func(): #@
            async for i in range(10): #@
                f = __(await i)
            async with test(): #@
                pass
        ''')
        self.assertIsInstance(async_def, nodes.AsyncFunctionDef)
        self.assertIsInstance(async_for, nodes.AsyncFor)
        self.assertIsInstance(async_with, nodes.AsyncWith)
        self.assertIsInstance(await_node, nodes.Await)
        self.assertIsInstance(await_node.value, nodes.Name)

    def _test_await_async_as_string(self, code):
        ast_node = parse(code)
        self.assertEqual(ast_node.as_string().strip(), code.strip())

    def test_await_as_string(self):
        code = textwrap.dedent('''
        async def function():
            await 42
        ''')
        self._test_await_async_as_string(code)

    def test_asyncwith_as_string(self):
        code = textwrap.dedent('''
        async def function():
            async with (42):
                pass
        ''')
        self._test_await_async_as_string(code)

    def test_asyncfor_as_string(self):
        code = textwrap.dedent('''
        async def function():
            async for i in range(10):
                await 42
        ''')
        self._test_await_async_as_string(code)


class ContextTest(unittest.TestCase):

    def test_subscript_load(self):
        node = builder.extract_node('f[1]')
        self.assertIs(node.ctx, astroid.Load)

    def test_subscript_del(self):
        node = builder.extract_node('del f[1]')
        self.assertIs(node.targets[0].ctx, astroid.Del)

    def test_subscript_store(self):
        node = builder.extract_node('f[1] = 2')
        subscript = node.targets[0]
        self.assertIs(subscript.ctx, astroid.Store)

    def test_list_load(self):
        node = builder.extract_node('[]')
        self.assertIs(node.ctx, astroid.Load)

    def test_list_del(self):
        node = builder.extract_node('del []')
        self.assertIs(node.targets[0].ctx, astroid.Del)

    def test_list_store(self):
        with self.assertRaises(exceptions.AstroidSyntaxError):
            builder.extract_node('[0] = 2')

    def test_tuple_load(self):
        node = builder.extract_node('(1, )')
        self.assertIs(node.ctx, astroid.Load)

    def test_tuple_store(self):
        with self.assertRaises(exceptions.AstroidSyntaxError):
            builder.extract_node('(1, ) = 3')

    @test_utils.require_version(minver='3.5')
    def test_starred_load(self):
        node = builder.extract_node('a = *b')
        starred = node.value
        self.assertIs(starred.ctx, astroid.Load)

    @test_utils.require_version(minver='3.0')
    def test_starred_store(self):
        node = builder.extract_node('a, *b = 1, 2')
        starred = node.targets[0].elts[1]
        self.assertIs(starred.ctx, astroid.Store)


if __name__ == '__main__':
    unittest.main()
