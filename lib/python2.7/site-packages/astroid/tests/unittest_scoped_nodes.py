# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2011, 2013-2015 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015 Philip Lorenz <philip@bithub.de>
# Copyright (c) 2015 Rene Zhang <rz99@cornell.edu>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""tests for specific behaviour of astroid scoped nodes (i.e. module, class and
function)
"""
import os
import sys
from functools import partial
import unittest
import warnings

from astroid import builder
from astroid import nodes
from astroid import scoped_nodes
from astroid import util
from astroid.exceptions import (
    InferenceError, AttributeInferenceError,
    NoDefault, ResolveError, MroError,
    InconsistentMroError, DuplicateBasesError,
    TooManyLevelsError,
)
from astroid.bases import (
    BUILTINS, Instance,
    BoundMethod, UnboundMethod, Generator
)
from astroid import __pkginfo__
from astroid import test_utils
from astroid.tests import resources


def _test_dict_interface(self, node, test_attr):
    self.assertIs(node[test_attr], node[test_attr])
    self.assertIn(test_attr, node)
    node.keys()
    node.values()
    node.items()
    iter(node)


class ModuleLoader(resources.SysPathSetup):
    def setUp(self):
        super(ModuleLoader, self).setUp()
        self.module = resources.build_file('data/module.py', 'data.module')
        self.module2 = resources.build_file('data/module2.py', 'data.module2')
        self.nonregr = resources.build_file('data/nonregr.py', 'data.nonregr')
        self.pack = resources.build_file('data/__init__.py', 'data')


class ModuleNodeTest(ModuleLoader, unittest.TestCase):

    def test_special_attributes(self):
        self.assertEqual(len(self.module.getattr('__name__')), 1)
        self.assertIsInstance(self.module.getattr('__name__')[0], nodes.Const)
        self.assertEqual(self.module.getattr('__name__')[0].value, 'data.module')
        self.assertEqual(len(self.module.getattr('__doc__')), 1)
        self.assertIsInstance(self.module.getattr('__doc__')[0], nodes.Const)
        self.assertEqual(self.module.getattr('__doc__')[0].value, 'test module for astroid\n')
        self.assertEqual(len(self.module.getattr('__file__')), 1)
        self.assertIsInstance(self.module.getattr('__file__')[0], nodes.Const)
        self.assertEqual(self.module.getattr('__file__')[0].value,
                         os.path.abspath(resources.find('data/module.py')))
        self.assertEqual(len(self.module.getattr('__dict__')), 1)
        self.assertIsInstance(self.module.getattr('__dict__')[0], nodes.Dict)
        self.assertRaises(AttributeInferenceError, self.module.getattr, '__path__')
        self.assertEqual(len(self.pack.getattr('__path__')), 1)
        self.assertIsInstance(self.pack.getattr('__path__')[0], nodes.List)

    def test_dict_interface(self):
        _test_dict_interface(self, self.module, 'YO')

    def test_getattr(self):
        yo = self.module.getattr('YO')[0]
        self.assertIsInstance(yo, nodes.ClassDef)
        self.assertEqual(yo.name, 'YO')
        red = next(self.module.igetattr('redirect'))
        self.assertIsInstance(red, nodes.FunctionDef)
        self.assertEqual(red.name, 'four_args')
        namenode = next(self.module.igetattr('NameNode'))
        self.assertIsInstance(namenode, nodes.ClassDef)
        self.assertEqual(namenode.name, 'Name')
        # resolve packageredirection
        mod = resources.build_file('data/appl/myConnection.py',
                                   'data.appl.myConnection')
        ssl = next(mod.igetattr('SSL1'))
        cnx = next(ssl.igetattr('Connection'))
        self.assertEqual(cnx.__class__, nodes.ClassDef)
        self.assertEqual(cnx.name, 'Connection')
        self.assertEqual(cnx.root().name, 'data.SSL1.Connection1')
        self.assertEqual(len(self.nonregr.getattr('enumerate')), 2)
        self.assertRaises(InferenceError, self.nonregr.igetattr, 'YOAA')

    def test_wildcard_import_names(self):
        m = resources.build_file('data/all.py', 'all')
        self.assertEqual(m.wildcard_import_names(), ['Aaa', '_bla', 'name'])
        m = resources.build_file('data/notall.py', 'notall')
        res = sorted(m.wildcard_import_names())
        self.assertEqual(res, ['Aaa', 'func', 'name', 'other'])

    def test_public_names(self):
        m = builder.parse('''
        name = 'a'
        _bla = 2
        other = 'o'
        class Aaa: pass
        def func(): print('yo')
        __all__ = 'Aaa', '_bla', 'name'
        ''')
        values = sorted(['Aaa', 'name', 'other', 'func'])
        self.assertEqual(sorted(m.public_names()), values)
        m = builder.parse('''
        name = 'a'
        _bla = 2
        other = 'o'
        class Aaa: pass

        def func(): return 'yo'
        ''')
        res = sorted(m.public_names())
        self.assertEqual(res, values)

        m = builder.parse('''
            from missing import tzop
            trop = "test"
            __all__ = (trop, "test1", tzop, 42)
        ''')
        res = sorted(m.public_names())
        self.assertEqual(res, ["trop", "tzop"])

        m = builder.parse('''
            test = tzop = 42
            __all__ = ('test', ) + ('tzop', )
        ''')
        res = sorted(m.public_names())
        self.assertEqual(res, ['test', 'tzop'])

    def test_module_getattr(self):
        data = '''
            appli = application
            appli += 2
            del appli
        '''
        astroid = builder.parse(data, __name__)
        # test del statement not returned by getattr
        self.assertEqual(len(astroid.getattr('appli')), 2,
                         astroid.getattr('appli'))

    def test_relative_to_absolute_name(self):
        # package
        mod = nodes.Module('very.multi.package', 'doc')
        mod.package = True
        modname = mod.relative_to_absolute_name('utils', 1)
        self.assertEqual(modname, 'very.multi.package.utils')
        modname = mod.relative_to_absolute_name('utils', 2)
        self.assertEqual(modname, 'very.multi.utils')
        modname = mod.relative_to_absolute_name('utils', 0)
        self.assertEqual(modname, 'very.multi.package.utils')
        modname = mod.relative_to_absolute_name('', 1)
        self.assertEqual(modname, 'very.multi.package')
        # non package
        mod = nodes.Module('very.multi.module', 'doc')
        mod.package = False
        modname = mod.relative_to_absolute_name('utils', 0)
        self.assertEqual(modname, 'very.multi.utils')
        modname = mod.relative_to_absolute_name('utils', 1)
        self.assertEqual(modname, 'very.multi.utils')
        modname = mod.relative_to_absolute_name('utils', 2)
        self.assertEqual(modname, 'very.utils')
        modname = mod.relative_to_absolute_name('', 1)
        self.assertEqual(modname, 'very.multi')

    def test_relative_to_absolute_name_beyond_top_level(self):
        mod = nodes.Module('a.b.c', '')
        mod.package = True
        for level in (5, 4):
            with self.assertRaises(TooManyLevelsError) as cm:
                mod.relative_to_absolute_name('test', level)

            expected = ("Relative import with too many levels "
                        "({level}) for module {name!r}".format(
                            level=level - 1, name=mod.name))
            self.assertEqual(expected, str(cm.exception))

    def test_import_1(self):
        data = '''from . import subpackage'''
        sys.path.insert(0, resources.find('data'))
        astroid = builder.parse(data, 'package', 'data/package/__init__.py')
        try:
            m = astroid.import_module('', level=1)
            self.assertEqual(m.name, 'package')
            inferred = list(astroid.igetattr('subpackage'))
            self.assertEqual(len(inferred), 1)
            self.assertEqual(inferred[0].name, 'package.subpackage')
        finally:
            del sys.path[0]


    def test_import_2(self):
        data = '''from . import subpackage as pouet'''
        astroid = builder.parse(data, 'package', 'data/package/__init__.py')
        sys.path.insert(0, resources.find('data'))
        try:
            m = astroid.import_module('', level=1)
            self.assertEqual(m.name, 'package')
            inferred = list(astroid.igetattr('pouet'))
            self.assertEqual(len(inferred), 1)
            self.assertEqual(inferred[0].name, 'package.subpackage')
        finally:
            del sys.path[0]


    def test_file_stream_in_memory(self):
        data = '''irrelevant_variable is irrelevant'''
        astroid = builder.parse(data, 'in_memory')
        with warnings.catch_warnings(record=True):
            self.assertEqual(astroid.file_stream.read().decode(), data)

    def test_file_stream_physical(self):
        path = resources.find('data/all.py')
        astroid = builder.AstroidBuilder().file_build(path, 'all')
        with open(path, 'rb') as file_io:
            with warnings.catch_warnings(record=True):
                self.assertEqual(astroid.file_stream.read(), file_io.read())

    def test_file_stream_api(self):
        path = resources.find('data/all.py')
        astroid = builder.AstroidBuilder().file_build(path, 'all')
        if __pkginfo__.numversion >= (1, 6):
            # file_stream is slated for removal in astroid 1.6.
            with self.assertRaises(AttributeError):
                # pylint: disable=pointless-statement
                astroid.file_stream
        else:
            # Until astroid 1.6, Module.file_stream will emit
            # PendingDeprecationWarning in 1.4, DeprecationWarning
            # in 1.5 and finally it will be removed in 1.6, leaving
            # only Module.stream as the recommended way to retrieve
            # its file stream.
            with warnings.catch_warnings(record=True) as cm:
                with test_utils.enable_warning(PendingDeprecationWarning):
                    self.assertIsNot(astroid.file_stream, astroid.file_stream)
            self.assertGreater(len(cm), 1)
            self.assertEqual(cm[0].category, PendingDeprecationWarning)

    def test_stream_api(self):
        path = resources.find('data/all.py')
        astroid = builder.AstroidBuilder().file_build(path, 'all')
        stream = astroid.stream()
        self.assertTrue(hasattr(stream, 'close'))
        with stream:
            with open(path, 'rb') as file_io:
                self.assertEqual(stream.read(), file_io.read())


class FunctionNodeTest(ModuleLoader, unittest.TestCase):

    def test_special_attributes(self):
        func = self.module2['make_class']
        self.assertEqual(len(func.getattr('__name__')), 1)
        self.assertIsInstance(func.getattr('__name__')[0], nodes.Const)
        self.assertEqual(func.getattr('__name__')[0].value, 'make_class')
        self.assertEqual(len(func.getattr('__doc__')), 1)
        self.assertIsInstance(func.getattr('__doc__')[0], nodes.Const)
        self.assertEqual(func.getattr('__doc__')[0].value,
                         'check base is correctly resolved to Concrete0')
        self.assertEqual(len(self.module.getattr('__dict__')), 1)
        self.assertIsInstance(self.module.getattr('__dict__')[0], nodes.Dict)

    def test_dict_interface(self):
        _test_dict_interface(self, self.module['global_access'], 'local')

    def test_default_value(self):
        func = self.module2['make_class']
        self.assertIsInstance(func.args.default_value('base'), nodes.Attribute)
        self.assertRaises(NoDefault, func.args.default_value, 'args')
        self.assertRaises(NoDefault, func.args.default_value, 'kwargs')
        self.assertRaises(NoDefault, func.args.default_value, 'any')
        #self.assertIsInstance(func.mularg_class('args'), nodes.Tuple)
        #self.assertIsInstance(func.mularg_class('kwargs'), nodes.Dict)
        #self.assertIsNone(func.mularg_class('base'))

    def test_navigation(self):
        function = self.module['global_access']
        self.assertEqual(function.statement(), function)
        l_sibling = function.previous_sibling()
        # check taking parent if child is not a stmt
        self.assertIsInstance(l_sibling, nodes.Assign)
        child = function.args.args[0]
        self.assertIs(l_sibling, child.previous_sibling())
        r_sibling = function.next_sibling()
        self.assertIsInstance(r_sibling, nodes.ClassDef)
        self.assertEqual(r_sibling.name, 'YO')
        self.assertIs(r_sibling, child.next_sibling())
        last = r_sibling.next_sibling().next_sibling().next_sibling()
        self.assertIsInstance(last, nodes.Assign)
        self.assertIsNone(last.next_sibling())
        first = l_sibling.root().body[0]
        self.assertIsNone(first.previous_sibling())

    def test_nested_args(self):
        if sys.version_info >= (3, 0):
            self.skipTest("nested args has been removed in py3.x")
        code = '''
            def nested_args(a, (b, c, d)):
                "nested arguments test"
        '''
        tree = builder.parse(code)
        func = tree['nested_args']
        self.assertEqual(sorted(func.locals), ['a', 'b', 'c', 'd'])
        self.assertEqual(func.args.format_args(), 'a, (b, c, d)')

    def test_four_args(self):
        func = self.module['four_args']
        local = sorted(func.keys())
        self.assertEqual(local, ['a', 'b', 'c', 'd'])
        self.assertEqual(func.type, 'function')

    def test_format_args(self):
        func = self.module2['make_class']
        self.assertEqual(func.args.format_args(),
                         'any, base=data.module.YO, *args, **kwargs')
        func = self.module['four_args']
        self.assertEqual(func.args.format_args(), 'a, b, c, d')

    @test_utils.require_version('3.0')
    def test_format_args_keyword_only_args(self):
        node = builder.parse('''
        def test(a: int, *, b: dict):
            pass
        ''').body[-1].args
        formatted = node.format_args()
        self.assertEqual(formatted, 'a:int, *, b:dict')

    def test_is_generator(self):
        self.assertTrue(self.module2['generator'].is_generator())
        self.assertFalse(self.module2['not_a_generator'].is_generator())
        self.assertFalse(self.module2['make_class'].is_generator())

    def test_is_abstract(self):
        method = self.module2['AbstractClass']['to_override']
        self.assertTrue(method.is_abstract(pass_is_abstract=False))
        self.assertEqual(method.qname(), 'data.module2.AbstractClass.to_override')
        self.assertEqual(method.pytype(), '%s.instancemethod' % BUILTINS)
        method = self.module2['AbstractClass']['return_something']
        self.assertFalse(method.is_abstract(pass_is_abstract=False))
        # non regression : test raise "string" doesn't cause an exception in is_abstract
        func = self.module2['raise_string']
        self.assertFalse(func.is_abstract(pass_is_abstract=False))

    def test_is_abstract_decorated(self):
        methods = builder.extract_node("""
            import abc

            class Klass(object):
                @abc.abstractproperty
                def prop(self):  #@
                   pass

                @abc.abstractmethod
                def method1(self):  #@
                   pass

                some_other_decorator = lambda x: x
                @some_other_decorator
                def method2(self):  #@
                   pass
         """)
        self.assertTrue(methods[0].is_abstract(pass_is_abstract=False))
        self.assertTrue(methods[1].is_abstract(pass_is_abstract=False))
        self.assertFalse(methods[2].is_abstract(pass_is_abstract=False))

##     def test_raises(self):
##         method = self.module2['AbstractClass']['to_override']
##         self.assertEqual([str(term) for term in method.raises()],
##                           ["Call(Name('NotImplementedError'), [], None, None)"] )

##     def test_returns(self):
##         method = self.module2['AbstractClass']['return_something']
##         # use string comp since Node doesn't handle __cmp__
##         self.assertEqual([str(term) for term in method.returns()],
##                           ["Const('toto')", "Const(None)"])

    def test_lambda_pytype(self):
        data = '''
            def f():
                g = lambda: None
        '''
        astroid = builder.parse(data)
        g = list(astroid['f'].ilookup('g'))[0]
        self.assertEqual(g.pytype(), '%s.function' % BUILTINS)

    def test_lambda_qname(self):
        astroid = builder.parse('lmbd = lambda: None', __name__)
        self.assertEqual('%s.<lambda>' % __name__, astroid['lmbd'].parent.value.qname())

    def test_is_method(self):
        data = '''
            class A:
                def meth1(self):
                    return 1
                @classmethod
                def meth2(cls):
                    return 2
                @staticmethod
                def meth3():
                    return 3

            def function():
                return 0

            @staticmethod
            def sfunction():
                return -1
        '''
        astroid = builder.parse(data)
        self.assertTrue(astroid['A']['meth1'].is_method())
        self.assertTrue(astroid['A']['meth2'].is_method())
        self.assertTrue(astroid['A']['meth3'].is_method())
        self.assertFalse(astroid['function'].is_method())
        self.assertFalse(astroid['sfunction'].is_method())

    def test_argnames(self):
        if sys.version_info < (3, 0):
            code = 'def f(a, (b, c), *args, **kwargs): pass'
        else:
            code = 'def f(a, b, c, *args, **kwargs): pass'
        astroid = builder.parse(code, __name__)
        self.assertEqual(astroid['f'].argnames(), ['a', 'b', 'c', 'args', 'kwargs'])

    def test_return_nothing(self):
        """test inferred value on a function with empty return"""
        data = '''
            def func():
                return

            a = func()
        '''
        astroid = builder.parse(data)
        call = astroid.body[1].value
        func_vals = call.inferred()
        self.assertEqual(len(func_vals), 1)
        self.assertIsInstance(func_vals[0], nodes.Const)
        self.assertIsNone(func_vals[0].value)

    def test_func_instance_attr(self):
        """test instance attributes for functions"""
        data = """
            def test():
                print(test.bar)

            test.bar = 1
            test()
        """
        astroid = builder.parse(data, 'mod')
        func = astroid.body[2].value.func.inferred()[0]
        self.assertIsInstance(func, nodes.FunctionDef)
        self.assertEqual(func.name, 'test')
        one = func.getattr('bar')[0].inferred()[0]
        self.assertIsInstance(one, nodes.Const)
        self.assertEqual(one.value, 1)

    def test_type_builtin_descriptor_subclasses(self):
        astroid = builder.parse("""
            class classonlymethod(classmethod):
                pass
            class staticonlymethod(staticmethod):
                pass

            class Node:
                @classonlymethod
                def clsmethod_subclass(cls):
                    pass
                @classmethod
                def clsmethod(cls):
                    pass
                @staticonlymethod
                def staticmethod_subclass(cls):
                    pass
                @staticmethod
                def stcmethod(cls):
                    pass
        """)
        node = astroid.locals['Node'][0]
        self.assertEqual(node.locals['clsmethod_subclass'][0].type,
                         'classmethod')
        self.assertEqual(node.locals['clsmethod'][0].type,
                         'classmethod')
        self.assertEqual(node.locals['staticmethod_subclass'][0].type,
                         'staticmethod')
        self.assertEqual(node.locals['stcmethod'][0].type,
                         'staticmethod')

    def test_decorator_builtin_descriptors(self):
        astroid = builder.parse("""
            def static_decorator(platform=None, order=50):
                def wrapper(f):
                    f.cgm_module = True
                    f.cgm_module_order = order
                    f.cgm_module_platform = platform
                    return staticmethod(f)
                return wrapper

            def long_classmethod_decorator(platform=None, order=50):
                def wrapper(f):
                    def wrapper2(f):
                        def wrapper3(f):
                            f.cgm_module = True
                            f.cgm_module_order = order
                            f.cgm_module_platform = platform
                            return classmethod(f)
                        return wrapper3(f)
                    return wrapper2(f)
                return wrapper

            def classmethod_decorator(platform=None):
                def wrapper(f):
                    f.platform = platform
                    return classmethod(f)
                return wrapper

            def classmethod_wrapper(fn):
                def wrapper(cls, *args, **kwargs):
                    result = fn(cls, *args, **kwargs)
                    return result

                return classmethod(wrapper)

            def staticmethod_wrapper(fn):
                def wrapper(*args, **kwargs):
                    return fn(*args, **kwargs)
                return staticmethod(wrapper)

            class SomeClass(object):
                @static_decorator()
                def static(node, cfg):
                    pass
                @classmethod_decorator()
                def classmethod(cls):
                    pass
                @static_decorator
                def not_so_static(node):
                    pass
                @classmethod_decorator
                def not_so_classmethod(node):
                    pass
                @classmethod_wrapper
                def classmethod_wrapped(cls):
                    pass
                @staticmethod_wrapper
                def staticmethod_wrapped():
                    pass
                @long_classmethod_decorator()
                def long_classmethod(cls): 
                    pass
        """)
        node = astroid.locals['SomeClass'][0]
        self.assertEqual(node.locals['static'][0].type,
                         'staticmethod')
        self.assertEqual(node.locals['classmethod'][0].type,
                         'classmethod')
        self.assertEqual(node.locals['not_so_static'][0].type,
                         'method')
        self.assertEqual(node.locals['not_so_classmethod'][0].type,
                         'method')
        self.assertEqual(node.locals['classmethod_wrapped'][0].type,
                         'classmethod')
        self.assertEqual(node.locals['staticmethod_wrapped'][0].type,
                         'staticmethod')
        self.assertEqual(node.locals['long_classmethod'][0].type,
                         'classmethod')

    def test_igetattr(self):
        func = builder.extract_node('''
        def test():
            pass
        ''')
        func.instance_attrs['value'] = [nodes.Const(42)]
        value = func.getattr('value')
        self.assertEqual(len(value), 1)
        self.assertIsInstance(value[0], nodes.Const)
        self.assertEqual(value[0].value, 42)
        inferred = next(func.igetattr('value'))
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    @test_utils.require_version(minver='3.0')
    def test_return_annotation_is_not_the_last(self):
        func = builder.extract_node('''
        def test() -> bytes:
            pass
            pass
            return
        ''')
        last_child = func.last_child()
        self.assertIsInstance(last_child, nodes.Return)
        self.assertEqual(func.tolineno, 5)

    @test_utils.require_version(minver='3.6')
    def test_method_init_subclass(self):
        klass = builder.extract_node('''
        class MyClass:
            def __init_subclass__(cls):
                pass
        ''')
        method = klass['__init_subclass__']
        self.assertEqual([n.name for n in method.args.args], ['cls'])
        self.assertEqual(method.type, 'classmethod')


class ClassNodeTest(ModuleLoader, unittest.TestCase):

    def test_dict_interface(self):
        _test_dict_interface(self, self.module['YOUPI'], 'method')

    def test_cls_special_attributes_1(self):
        cls = self.module['YO']
        self.assertEqual(len(cls.getattr('__bases__')), 1)
        self.assertEqual(len(cls.getattr('__name__')), 1)
        self.assertIsInstance(cls.getattr('__name__')[0], nodes.Const)
        self.assertEqual(cls.getattr('__name__')[0].value, 'YO')
        self.assertEqual(len(cls.getattr('__doc__')), 1)
        self.assertIsInstance(cls.getattr('__doc__')[0], nodes.Const)
        self.assertEqual(cls.getattr('__doc__')[0].value, 'hehe')
        self.assertEqual(len(cls.getattr('__module__')), 1)
        self.assertIsInstance(cls.getattr('__module__')[0], nodes.Const)
        self.assertEqual(cls.getattr('__module__')[0].value, 'data.module')
        self.assertEqual(len(cls.getattr('__dict__')), 1)
        if not cls.newstyle:
            self.assertRaises(AttributeInferenceError, cls.getattr, '__mro__')
        for cls in (nodes.List._proxied, nodes.Const(1)._proxied):
            self.assertEqual(len(cls.getattr('__bases__')), 1)
            self.assertEqual(len(cls.getattr('__name__')), 1)
            self.assertEqual(len(cls.getattr('__doc__')), 1, (cls, cls.getattr('__doc__')))
            self.assertEqual(cls.getattr('__doc__')[0].value, cls.doc)
            self.assertEqual(len(cls.getattr('__module__')), 1)
            self.assertEqual(len(cls.getattr('__dict__')), 1)
            self.assertEqual(len(cls.getattr('__mro__')), 1)

    def test__mro__attribute(self):
        node = builder.extract_node('''
        class A(object): pass
        class B(object): pass
        class C(A, B): pass        
        ''')
        mro = node.getattr('__mro__')[0]
        self.assertIsInstance(mro, nodes.Tuple)
        self.assertEqual(mro.elts, node.mro())

    def test__bases__attribute(self):
        node = builder.extract_node('''
        class A(object): pass
        class B(object): pass
        class C(A, B): pass
        class D(C): pass
        ''')
        bases = node.getattr('__bases__')[0]
        self.assertIsInstance(bases, nodes.Tuple)
        self.assertEqual(len(bases.elts), 1)
        self.assertIsInstance(bases.elts[0], nodes.ClassDef)
        self.assertEqual(bases.elts[0].name, 'C')

    def test_cls_special_attributes_2(self):
        astroid = builder.parse('''
            class A(object): pass
            class B(object): pass

            A.__bases__ += (B,)
        ''', __name__)
        self.assertEqual(len(astroid['A'].getattr('__bases__')), 2)
        self.assertIsInstance(astroid['A'].getattr('__bases__')[1], nodes.Tuple)
        self.assertIsInstance(astroid['A'].getattr('__bases__')[0], nodes.AssignAttr)

    def test_instance_special_attributes(self):
        for inst in (Instance(self.module['YO']), nodes.List(), nodes.Const(1)):
            self.assertRaises(AttributeInferenceError, inst.getattr, '__mro__')
            self.assertRaises(AttributeInferenceError, inst.getattr, '__bases__')
            self.assertRaises(AttributeInferenceError, inst.getattr, '__name__')
            self.assertEqual(len(inst.getattr('__dict__')), 1)
            self.assertEqual(len(inst.getattr('__doc__')), 1)

    def test_navigation(self):
        klass = self.module['YO']
        self.assertEqual(klass.statement(), klass)
        l_sibling = klass.previous_sibling()
        self.assertTrue(isinstance(l_sibling, nodes.FunctionDef), l_sibling)
        self.assertEqual(l_sibling.name, 'global_access')
        r_sibling = klass.next_sibling()
        self.assertIsInstance(r_sibling, nodes.ClassDef)
        self.assertEqual(r_sibling.name, 'YOUPI')

    def test_local_attr_ancestors(self):
        module = builder.parse('''
        class A():
            def __init__(self): pass
        class B(A): pass
        class C(B): pass
        class D(object): pass
        class F(): pass
        class E(F, D): pass
        ''')
        # Test old-style (Python 2) / new-style (Python 3+) ancestors lookups
        klass2 = module['C']
        it = klass2.local_attr_ancestors('__init__')
        anc_klass = next(it)
        self.assertIsInstance(anc_klass, nodes.ClassDef)
        self.assertEqual(anc_klass.name, 'A')
        if sys.version_info[0] == 2:
            self.assertRaises(StopIteration, partial(next, it))
        else:
            anc_klass = next(it)
            self.assertIsInstance(anc_klass, nodes.ClassDef)
            self.assertEqual(anc_klass.name, 'object')
            self.assertRaises(StopIteration, partial(next, it))

        it = klass2.local_attr_ancestors('method')
        self.assertRaises(StopIteration, partial(next, it))

        # Test mixed-style ancestor lookups
        klass2 = module['E']
        it = klass2.local_attr_ancestors('__init__')
        anc_klass = next(it)
        self.assertIsInstance(anc_klass, nodes.ClassDef)
        self.assertEqual(anc_klass.name, 'object')
        self.assertRaises(StopIteration, partial(next, it))

    def test_local_attr_mro(self):
        module = builder.parse('''
        class A(object):
            def __init__(self): pass
        class B(A):
            def __init__(self, arg, arg2): pass
        class C(A): pass
        class D(C, B): pass
        ''')
        dclass = module['D']
        init = dclass.local_attr('__init__')[0]
        self.assertIsInstance(init, nodes.FunctionDef)
        self.assertEqual(init.parent.name, 'B')

        cclass = module['C']
        init = cclass.local_attr('__init__')[0]
        self.assertIsInstance(init, nodes.FunctionDef)
        self.assertEqual(init.parent.name, 'A')

        ancestors = list(dclass.local_attr_ancestors('__init__'))
        self.assertEqual([node.name for node in ancestors], ['B', 'A', 'object'])

    def test_instance_attr_ancestors(self):
        klass2 = self.module['YOUPI']
        it = klass2.instance_attr_ancestors('yo')
        anc_klass = next(it)
        self.assertIsInstance(anc_klass, nodes.ClassDef)
        self.assertEqual(anc_klass.name, 'YO')
        self.assertRaises(StopIteration, partial(next, it))
        klass2 = self.module['YOUPI']
        it = klass2.instance_attr_ancestors('member')
        self.assertRaises(StopIteration, partial(next, it))

    def test_methods(self):
        expected_methods = {'__init__', 'class_method', 'method', 'static_method'}
        klass2 = self.module['YOUPI']
        methods = {m.name for m in klass2.methods()}
        self.assertTrue(
            methods.issuperset(expected_methods))
        methods = {m.name for m in klass2.mymethods()}
        self.assertSetEqual(expected_methods, methods)
        klass2 = self.module2['Specialization']
        methods = {m.name for m in klass2.mymethods()}
        self.assertSetEqual(set([]), methods)
        method_locals = klass2.local_attr('method')
        self.assertEqual(len(method_locals), 1)
        self.assertEqual(method_locals[0].name, 'method')
        self.assertRaises(AttributeInferenceError, klass2.local_attr, 'nonexistent')
        methods = {m.name for m in klass2.methods()}
        self.assertTrue(methods.issuperset(expected_methods))

    #def test_rhs(self):
    #    my_dict = self.module['MY_DICT']
    #    self.assertIsInstance(my_dict.rhs(), nodes.Dict)
    #    a = self.module['YO']['a']
    #    value = a.rhs()
    #    self.assertIsInstance(value, nodes.Const)
    #    self.assertEqual(value.value, 1)

    @unittest.skipIf(sys.version_info[0] >= 3, "Python 2 class semantics required.")
    def test_ancestors(self):
        klass = self.module['YOUPI']
        self.assertEqual(['YO'], [a.name for a in klass.ancestors()])
        klass = self.module2['Specialization']
        self.assertEqual(['YOUPI', 'YO'], [a.name for a in klass.ancestors()])

    @unittest.skipIf(sys.version_info[0] < 3, "Python 3 class semantics required.")
    def test_ancestors_py3(self):
        klass = self.module['YOUPI']
        self.assertEqual(['YO', 'object'], [a.name for a in klass.ancestors()])
        klass = self.module2['Specialization']
        self.assertEqual(['YOUPI', 'YO', 'object'], [a.name for a in klass.ancestors()])

    def test_type(self):
        klass = self.module['YOUPI']
        self.assertEqual(klass.type, 'class')
        klass = self.module2['Metaclass']
        self.assertEqual(klass.type, 'metaclass')
        klass = self.module2['MyException']
        self.assertEqual(klass.type, 'exception')
        klass = self.module2['MyError']
        self.assertEqual(klass.type, 'exception')
        # the following class used to be detected as a metaclass
        # after the fix which used instance._proxied in .ancestors(),
        # when in fact it is a normal class
        klass = self.module2['NotMetaclass']
        self.assertEqual(klass.type, 'class')

    def test_inner_classes(self):
        eee = self.nonregr['Ccc']['Eee']
        self.assertEqual([n.name for n in eee.ancestors()], ['Ddd', 'Aaa', 'object'])


    def test_classmethod_attributes(self):
        data = '''
            class WebAppObject(object):
                def registered(cls, application):
                    cls.appli = application
                    cls.schema = application.schema
                    cls.config = application.config
                    return cls
                registered = classmethod(registered)
        '''
        astroid = builder.parse(data, __name__)
        cls = astroid['WebAppObject']
        self.assertEqual(sorted(cls.locals.keys()),
                         ['appli', 'config', 'registered', 'schema'])

    def test_class_getattr(self):
        data = '''
            class WebAppObject(object):
                appli = application
                appli += 2
                del self.appli
        '''
        astroid = builder.parse(data, __name__)
        cls = astroid['WebAppObject']
        # test del statement not returned by getattr
        self.assertEqual(len(cls.getattr('appli')), 2)


    def test_instance_getattr(self):
        data = '''
            class WebAppObject(object):
                def __init__(self, application):
                    self.appli = application
                    self.appli += 2
                    del self.appli
         '''
        astroid = builder.parse(data)
        inst = Instance(astroid['WebAppObject'])
        # test del statement not returned by getattr
        self.assertEqual(len(inst.getattr('appli')), 2)


    def test_instance_getattr_with_class_attr(self):
        data = '''
            class Parent:
                aa = 1
                cc = 1

            class Klass(Parent):
                aa = 0
                bb = 0

                def incr(self, val):
                    self.cc = self.aa
                    if val > self.aa:
                        val = self.aa
                    if val < self.bb:
                        val = self.bb
                    self.aa += val
        '''
        astroid = builder.parse(data)
        inst = Instance(astroid['Klass'])
        self.assertEqual(len(inst.getattr('aa')), 3, inst.getattr('aa'))
        self.assertEqual(len(inst.getattr('bb')), 1, inst.getattr('bb'))
        self.assertEqual(len(inst.getattr('cc')), 2, inst.getattr('cc'))


    def test_getattr_method_transform(self):
        data = '''
            class Clazz(object):

                def m1(self, value):
                    self.value = value
                m2 = m1

            def func(arg1, arg2):
                "function that will be used as a method"
                return arg1.value + arg2

            Clazz.m3 = func
            inst = Clazz()
            inst.m4 = func
        '''
        astroid = builder.parse(data)
        cls = astroid['Clazz']
        # test del statement not returned by getattr
        for method in ('m1', 'm2', 'm3'):
            inferred = list(cls.igetattr(method))
            self.assertEqual(len(inferred), 1)
            self.assertIsInstance(inferred[0], UnboundMethod)
            inferred = list(Instance(cls).igetattr(method))
            self.assertEqual(len(inferred), 1)
            self.assertIsInstance(inferred[0], BoundMethod)
        inferred = list(Instance(cls).igetattr('m4'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.FunctionDef)

    def test_getattr_from_grandpa(self):
        data = '''
            class Future:
                attr = 1

            class Present(Future):
                pass

            class Past(Present):
                pass
        '''
        astroid = builder.parse(data)
        past = astroid['Past']
        attr = past.getattr('attr')
        self.assertEqual(len(attr), 1)
        attr1 = attr[0]
        self.assertIsInstance(attr1, nodes.AssignName)
        self.assertEqual(attr1.name, 'attr')

    def test_function_with_decorator_lineno(self):
        data = '''
            @f(a=2,
               b=3)
            def g1(x):
                print(x)

            @f(a=2,
               b=3)
            def g2():
                pass
        '''
        astroid = builder.parse(data)
        self.assertEqual(astroid['g1'].fromlineno, 4)
        self.assertEqual(astroid['g1'].tolineno, 5)
        self.assertEqual(astroid['g2'].fromlineno, 9)
        self.assertEqual(astroid['g2'].tolineno, 10)

    @test_utils.require_version(maxver='3.0')
    def test_simple_metaclass(self):
        astroid = builder.parse("""
            class Test(object):
                __metaclass__ = type
        """)
        klass = astroid['Test']
        metaclass = klass.metaclass()
        self.assertIsInstance(metaclass, scoped_nodes.ClassDef)
        self.assertEqual(metaclass.name, 'type')

    def test_metaclass_error(self):
        astroid = builder.parse("""
            class Test(object):
                __metaclass__ = typ
        """)
        klass = astroid['Test']
        self.assertFalse(klass.metaclass())

    @test_utils.require_version(maxver='3.0')
    def test_metaclass_imported(self):
        astroid = builder.parse("""
            from abc import ABCMeta
            class Test(object):
                __metaclass__ = ABCMeta
        """)
        klass = astroid['Test']

        metaclass = klass.metaclass()
        self.assertIsInstance(metaclass, scoped_nodes.ClassDef)
        self.assertEqual(metaclass.name, 'ABCMeta')

    def test_metaclass_yes_leak(self):
        astroid = builder.parse("""
            # notice `ab` instead of `abc`
            from ab import ABCMeta

            class Meta(object):
                __metaclass__ = ABCMeta
        """)
        klass = astroid['Meta']
        self.assertIsNone(klass.metaclass())

    @test_utils.require_version(maxver='3.0')
    def test_newstyle_and_metaclass_good(self):
        astroid = builder.parse("""
            from abc import ABCMeta
            class Test:
                __metaclass__ = ABCMeta
        """)
        klass = astroid['Test']
        self.assertTrue(klass.newstyle)
        self.assertEqual(klass.metaclass().name, 'ABCMeta')
        astroid = builder.parse("""
            from abc import ABCMeta
            __metaclass__ = ABCMeta
            class Test:
                pass
        """)
        klass = astroid['Test']
        self.assertTrue(klass.newstyle)
        self.assertEqual(klass.metaclass().name, 'ABCMeta')

    @test_utils.require_version(maxver='3.0')
    def test_nested_metaclass(self):
        astroid = builder.parse("""
            from abc import ABCMeta
            class A(object):
                __metaclass__ = ABCMeta
                class B: pass

            __metaclass__ = ABCMeta
            class C:
               __metaclass__ = type
               class D: pass
        """)
        a = astroid['A']
        b = a.locals['B'][0]
        c = astroid['C']
        d = c.locals['D'][0]
        self.assertEqual(a.metaclass().name, 'ABCMeta')
        self.assertFalse(b.newstyle)
        self.assertIsNone(b.metaclass())
        self.assertEqual(c.metaclass().name, 'type')
        self.assertEqual(d.metaclass().name, 'ABCMeta')

    @test_utils.require_version(maxver='3.0')
    def test_parent_metaclass(self):
        astroid = builder.parse("""
            from abc import ABCMeta
            class Test:
                __metaclass__ = ABCMeta
            class SubTest(Test): pass
        """)
        klass = astroid['SubTest']
        self.assertTrue(klass.newstyle)
        metaclass = klass.metaclass()
        self.assertIsInstance(metaclass, scoped_nodes.ClassDef)
        self.assertEqual(metaclass.name, 'ABCMeta')

    @test_utils.require_version(maxver='3.0')
    def test_metaclass_ancestors(self):
        astroid = builder.parse("""
            from abc import ABCMeta

            class FirstMeta(object):
                __metaclass__ = ABCMeta

            class SecondMeta(object):
                __metaclass__ = type

            class Simple(object):
                pass

            class FirstImpl(FirstMeta): pass
            class SecondImpl(FirstImpl): pass
            class ThirdImpl(Simple, SecondMeta):
                pass
        """)
        classes = {
            'ABCMeta': ('FirstImpl', 'SecondImpl'),
            'type': ('ThirdImpl', )
        }
        for metaclass, names in classes.items():
            for name in names:
                impl = astroid[name]
                meta = impl.metaclass()
                self.assertIsInstance(meta, nodes.ClassDef)
                self.assertEqual(meta.name, metaclass)

    def test_metaclass_type(self):
        klass = builder.extract_node("""
            def with_metaclass(meta, base=object):
                return meta("NewBase", (base, ), {})

            class ClassWithMeta(with_metaclass(type)): #@
                pass
        """)
        self.assertEqual(
            ['NewBase', 'object'],
            [base.name for base in klass.ancestors()])

    def test_no_infinite_metaclass_loop(self):
        klass = builder.extract_node("""
            class SSS(object):

                class JJJ(object):
                    pass

                @classmethod
                def Init(cls):
                    cls.JJJ = type('JJJ', (cls.JJJ,), {})

            class AAA(SSS):
                pass

            class BBB(AAA.JJJ):
                pass
        """)
        self.assertFalse(scoped_nodes._is_metaclass(klass))
        ancestors = [base.name for base in klass.ancestors()]
        self.assertIn('object', ancestors)
        self.assertIn('JJJ', ancestors)

    def test_no_infinite_metaclass_loop_with_redefine(self):
        ast_nodes = builder.extract_node("""
            import datetime

            class A(datetime.date): #@
                @classmethod
                def now(cls):
                    return cls()

            class B(datetime.date): #@
                pass

            datetime.date = A
            datetime.date = B
        """)
        for klass in ast_nodes:
            self.assertEqual(None, klass.metaclass())

    def test_metaclass_generator_hack(self):
        klass = builder.extract_node("""
            import six

            class WithMeta(six.with_metaclass(type, object)): #@
                pass
        """)
        self.assertEqual(
            ['object'],
            [base.name for base in klass.ancestors()])
        self.assertEqual(
            'type', klass.metaclass().name)

    def test_using_six_add_metaclass(self):
        klass = builder.extract_node('''
        import six
        import abc

        @six.add_metaclass(abc.ABCMeta)
        class WithMeta(object):
            pass
        ''')
        inferred = next(klass.infer())
        metaclass = inferred.metaclass()
        self.assertIsInstance(metaclass, scoped_nodes.ClassDef)
        self.assertEqual(metaclass.qname(), 'abc.ABCMeta')

    def test_using_invalid_six_add_metaclass_call(self):
        klass = builder.extract_node('''
        import six
        @six.add_metaclass()
        class Invalid(object):
            pass
        ''')
        inferred = next(klass.infer())
        self.assertIsNone(inferred.metaclass())

    def test_nonregr_infer_callresult(self):
        astroid = builder.parse("""
            class Delegate(object):
                def __get__(self, obj, cls):
                    return getattr(obj._subject, self.attribute)

            class CompositeBuilder(object):
                __call__ = Delegate()

            builder = CompositeBuilder(result, composite)
            tgts = builder()
        """)
        instance = astroid['tgts']
        # used to raise "'_Yes' object is not iterable", see
        # https://bitbucket.org/logilab/astroid/issue/17
        self.assertEqual(list(instance.infer()), [util.Uninferable])

    def test_slots(self):
        astroid = builder.parse("""
            from collections import deque
            from textwrap import dedent

            class First(object): #@
                __slots__ = ("a", "b", 1)
            class Second(object): #@
                __slots__ = "a"
            class Third(object): #@
                __slots__ = deque(["a", "b", "c"])
            class Fourth(object): #@
                __slots__ = {"a": "a", "b": "b"}
            class Fifth(object): #@
                __slots__ = list
            class Sixth(object): #@
                __slots__ = ""
            class Seventh(object): #@
                __slots__ = dedent.__name__
            class Eight(object): #@
                __slots__ = ("parens")
            class Ninth(object): #@
                pass
            class Ten(object): #@
                __slots__ = dict({"a": "b", "c": "d"})
        """)
        expected = [
            ('First', ('a', 'b')),
            ('Second', ('a', )),
            ('Third', None),
            ('Fourth', ('a', 'b')),
            ('Fifth', None),
            ('Sixth', None),
            ('Seventh', ('dedent', )),
            ('Eight', ('parens', )),
            ('Ninth', None),
            ('Ten', ('a', 'c')),
        ]
        for cls, expected_value in expected:
            slots = astroid[cls].slots()
            if expected_value is None:
                self.assertIsNone(slots)
            else:
                self.assertEqual(list(expected_value),
                                 [node.value for node in slots])

    @test_utils.require_version(maxver='3.0')
    def test_slots_py2(self):
        module = builder.parse("""
        class UnicodeSlots(object):
            __slots__ = (u"a", u"b", "c")
        """)
        slots = module['UnicodeSlots'].slots()
        self.assertEqual(len(slots), 3)
        self.assertEqual(slots[0].value, "a")
        self.assertEqual(slots[1].value, "b")
        self.assertEqual(slots[2].value, "c")

    @test_utils.require_version(maxver='3.0')
    def test_slots_py2_not_implemented(self):
        module = builder.parse("""
        class OldStyle:
            __slots__ = ("a", "b")
        """)
        msg = "The concept of slots is undefined for old-style classes."
        with self.assertRaises(NotImplementedError) as cm:
            module['OldStyle'].slots()
        self.assertEqual(str(cm.exception), msg)

    def test_slots_for_dict_keys(self):
        module = builder.parse('''
        class Issue(object):
          SlotDefaults = {'id': 0, 'id1':1}
          __slots__ = SlotDefaults.keys()
        ''')
        cls = module['Issue']
        slots = cls.slots()
        self.assertEqual(len(slots), 2)
        self.assertEqual(slots[0].value, 'id')
        self.assertEqual(slots[1].value, 'id1')

    def test_slots_empty_list_of_slots(self):
        module = builder.parse("""
        class Klass(object):
            __slots__ = ()
        """)
        cls = module['Klass']
        self.assertEqual(cls.slots(), [])

    def test_slots_taken_from_parents(self):
        module = builder.parse('''
        class FirstParent(object):
            __slots__ = ('a', 'b', 'c')
        class SecondParent(FirstParent):
            __slots__ = ('d', 'e')
        class Third(SecondParent):
            __slots__ = ('d', )
        ''')
        cls = module['Third']
        slots = cls.slots()
        self.assertEqual(sorted(set(slot.value for slot in slots)),
                         ['a', 'b', 'c', 'd', 'e'])

    def test_all_ancestors_need_slots(self):
        module = builder.parse('''
        class A(object):
            __slots__ = ('a', )
        class B(A): pass
        class C(B):
            __slots__ = ('a', )
        ''')
        cls = module['C']
        self.assertIsNone(cls.slots())
        cls = module['B']
        self.assertIsNone(cls.slots())

    def assertEqualMro(self, klass, expected_mro):
        self.assertEqual(
            [member.name for member in klass.mro()],
            expected_mro)

    @test_utils.require_version(maxver='3.0')
    def test_no_mro_for_old_style(self):
        node = builder.extract_node("""
        class Old: pass""")
        with self.assertRaises(NotImplementedError) as cm:
            node.mro()
        self.assertEqual(str(cm.exception), "Could not obtain mro for "
                                            "old-style classes.")

    @test_utils.require_version(maxver='3.0')
    def test_mro_for_classes_with_old_style_in_mro(self):
        node = builder.extract_node('''
        class Factory:
            pass
        class ClientFactory(Factory):
            pass
        class ReconnectingClientFactory(ClientFactory):
            pass
        class WebSocketAdapterFactory(object):
            pass
        class WebSocketClientFactory(WebSocketAdapterFactory, ClientFactory):
            pass
        class WampWebSocketClientFactory(WebSocketClientFactory):
            pass
        class RetryFactory(WampWebSocketClientFactory, ReconnectingClientFactory):
            pas
        ''')
        self.assertEqualMro(
            node,
            ['RetryFactory', 'WampWebSocketClientFactory',
             'WebSocketClientFactory', 'WebSocketAdapterFactory', 'object',
             'ReconnectingClientFactory', 'ClientFactory',
             'Factory']
        )

    @test_utils.require_version(maxver='3.0')
    def test_combined_newstyle_oldstyle_in_mro(self):
        node = builder.extract_node('''
        class Old:
            pass
        class New(object):
            pass
        class New1(object):
            pass
        class New2(New, New1):
            pass
        class NewOld(New2, Old): #@
            pass
        ''')
        self.assertEqualMro(node, ['NewOld', 'New2', 'New', 'New1', 'object', 'Old'])
        self.assertTrue(node.newstyle)

    def test_with_metaclass_mro(self):
        astroid = builder.parse("""
        import six

        class C(object):
            pass
        class B(C):
            pass
        class A(six.with_metaclass(type, B)):
            pass
        """)
        self.assertEqualMro(astroid['A'], ['A', 'B', 'C', 'object'])

    def test_mro(self):
        astroid = builder.parse("""
        class C(object): pass
        class D(dict, C): pass

        class A1(object): pass
        class B1(A1): pass
        class C1(A1): pass
        class D1(B1, C1): pass
        class E1(C1, B1): pass
        class F1(D1, E1): pass
        class G1(E1, D1): pass

        class Boat(object): pass
        class DayBoat(Boat): pass
        class WheelBoat(Boat): pass
        class EngineLess(DayBoat): pass
        class SmallMultihull(DayBoat): pass
        class PedalWheelBoat(EngineLess, WheelBoat): pass
        class SmallCatamaran(SmallMultihull): pass
        class Pedalo(PedalWheelBoat, SmallCatamaran): pass

        class OuterA(object):
            class Inner(object):
                pass
        class OuterB(OuterA):
            class Inner(OuterA.Inner):
                pass
        class OuterC(OuterA):
            class Inner(OuterA.Inner):
                pass
        class OuterD(OuterC):
            class Inner(OuterC.Inner, OuterB.Inner):
                pass
        class Duplicates(str, str): pass
        
        """)
        self.assertEqualMro(astroid['D'], ['D', 'dict', 'C', 'object'])
        self.assertEqualMro(astroid['D1'], ['D1', 'B1', 'C1', 'A1', 'object'])
        self.assertEqualMro(astroid['E1'], ['E1', 'C1', 'B1', 'A1', 'object'])
        with self.assertRaises(InconsistentMroError) as cm:
            astroid['F1'].mro()
        A1 = astroid.getattr('A1')[0]
        B1 = astroid.getattr('B1')[0]
        C1 = astroid.getattr('C1')[0]
        object_ = builder.MANAGER.astroid_cache[BUILTINS].getattr('object')[0]
        self.assertEqual(cm.exception.mros, [[B1, C1, A1, object_],
                                             [C1, B1, A1, object_]])
        with self.assertRaises(InconsistentMroError) as cm:
            astroid['G1'].mro()
        self.assertEqual(cm.exception.mros, [[C1, B1, A1, object_],
                                             [B1, C1, A1, object_]])
        self.assertEqualMro(
            astroid['PedalWheelBoat'],
            ["PedalWheelBoat", "EngineLess",
             "DayBoat", "WheelBoat", "Boat", "object"])

        self.assertEqualMro(
            astroid["SmallCatamaran"],
            ["SmallCatamaran", "SmallMultihull", "DayBoat", "Boat", "object"])

        self.assertEqualMro(
            astroid["Pedalo"],
            ["Pedalo", "PedalWheelBoat", "EngineLess", "SmallCatamaran",
             "SmallMultihull", "DayBoat", "WheelBoat", "Boat", "object"])

        self.assertEqualMro(
            astroid['OuterD']['Inner'],
            ['Inner', 'Inner', 'Inner', 'Inner', 'object'])

        with self.assertRaises(DuplicateBasesError) as cm:
            astroid['Duplicates'].mro()
        Duplicates = astroid.getattr('Duplicates')[0]
        self.assertEqual(cm.exception.cls, Duplicates)
        self.assertIsInstance(cm.exception, MroError)
        self.assertIsInstance(cm.exception, ResolveError)

    def test_generator_from_infer_call_result_parent(self):
        func = builder.extract_node("""
        import contextlib

        @contextlib.contextmanager
        def test(): #@
            yield
        """)
        result = next(func.infer_call_result(func))
        self.assertIsInstance(result, Generator)
        self.assertEqual(result.parent, func)

    def test_type_three_arguments(self):
        classes = builder.extract_node("""
        type('A', (object, ), {"a": 1, "b": 2, missing: 3}) #@
        """)
        first = next(classes.infer())
        self.assertIsInstance(first, nodes.ClassDef)
        self.assertEqual(first.name, "A")
        self.assertEqual(first.basenames, ["object"])
        self.assertIsInstance(first["a"], nodes.Const)
        self.assertEqual(first["a"].value, 1)
        self.assertIsInstance(first["b"], nodes.Const)
        self.assertEqual(first["b"].value, 2)
        with self.assertRaises(AttributeInferenceError):
            first.getattr("missing")

    def test_implicit_metaclass(self):
        cls = builder.extract_node("""
        class A(object):
            pass
        """)
        type_cls = scoped_nodes.builtin_lookup("type")[1][0]
        self.assertEqual(cls.implicit_metaclass(), type_cls)

    def test_implicit_metaclass_lookup(self):
        cls = builder.extract_node('''
        class A(object):
            pass
        ''')
        instance = cls.instantiate_class()
        func = cls.getattr('mro')
        self.assertEqual(len(func), 1)
        self.assertRaises(AttributeInferenceError, instance.getattr, 'mro')

    def test_metaclass_lookup_using_same_class(self):
        # Check that we don't have recursive attribute access for metaclass
        cls = builder.extract_node('''
        class A(object): pass            
        ''')
        self.assertEqual(len(cls.getattr('mro')), 1)

    def test_metaclass_lookup_inferrence_errors(self):
        module = builder.parse('''
        import six

        class Metaclass(type):
            foo = lala

        @six.add_metaclass(Metaclass)
        class B(object): pass 
        ''')
        cls = module['B']
        self.assertEqual(util.Uninferable, next(cls.igetattr('foo')))

    def test_metaclass_lookup(self):
        module = builder.parse('''
        import six
         
        class Metaclass(type):
            foo = 42
            @classmethod
            def class_method(cls):
                pass
            def normal_method(cls):
                pass
            @property
            def meta_property(cls):
                return 42
            @staticmethod
            def static():
                pass

        @six.add_metaclass(Metaclass)
        class A(object):
            pass
        ''')
        acls = module['A']
        normal_attr = next(acls.igetattr('foo'))
        self.assertIsInstance(normal_attr, nodes.Const)
        self.assertEqual(normal_attr.value, 42)

        class_method = next(acls.igetattr('class_method'))
        self.assertIsInstance(class_method, BoundMethod)
        self.assertEqual(class_method.bound, module['Metaclass'])

        normal_method = next(acls.igetattr('normal_method'))
        self.assertIsInstance(normal_method, BoundMethod)
        self.assertEqual(normal_method.bound, module['A'])

        # Attribute access for properties:
        #   from the metaclass is a property object
        #   from the class that uses the metaclass, the value
        #   of the property
        property_meta = next(module['Metaclass'].igetattr('meta_property'))
        self.assertIsInstance(property_meta, UnboundMethod)
        wrapping = scoped_nodes.get_wrapping_class(property_meta)
        self.assertEqual(wrapping, module['Metaclass'])

        property_class = next(acls.igetattr('meta_property'))
        self.assertIsInstance(property_class, nodes.Const)
        self.assertEqual(property_class.value, 42)

        static = next(acls.igetattr('static'))
        self.assertIsInstance(static, scoped_nodes.FunctionDef)

    @test_utils.require_version(maxver='3.0')
    def test_implicit_metaclass_is_none(self):
        cls = builder.extract_node("""
        class A: pass
        """)
        self.assertIsNone(cls.implicit_metaclass())

    def test_local_attr_invalid_mro(self):
        cls = builder.extract_node("""
        # A has an invalid MRO, local_attr should fallback
        # to using .ancestors.
        class A(object, object):
            test = 42
        class B(A): #@
            pass
        """)
        local = cls.local_attr('test')[0]
        inferred = next(local.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_has_dynamic_getattr(self):
        module = builder.parse("""
        class Getattr(object):
            def __getattr__(self, attrname):
                pass

        class Getattribute(object):
            def __getattribute__(self, attrname):
                pass

        class ParentGetattr(Getattr):
            pass
        """)
        self.assertTrue(module['Getattr'].has_dynamic_getattr())
        self.assertTrue(module['Getattribute'].has_dynamic_getattr())
        self.assertTrue(module['ParentGetattr'].has_dynamic_getattr())

        # Test that objects analyzed through the live introspection
        # aren't considered to have dynamic getattr implemented.
        import datetime
        astroid_builder = builder.AstroidBuilder()
        module = astroid_builder.module_build(datetime)
        self.assertFalse(module['timedelta'].has_dynamic_getattr())

    def test_duplicate_bases_namedtuple(self):
        module = builder.parse("""
        import collections
        _A = collections.namedtuple('A', 'a')

        class A(_A): pass

        class B(A): pass
        """)
        self.assertRaises(DuplicateBasesError, module['B'].mro)

    def test_instance_bound_method_lambdas(self):
        ast_nodes = builder.extract_node('''
        class Test(object): #@
            lam = lambda self: self
            not_method = lambda xargs: xargs
        Test() #@
        ''')
        cls = next(ast_nodes[0].infer())
        self.assertIsInstance(next(cls.igetattr('lam')), scoped_nodes.Lambda)
        self.assertIsInstance(next(cls.igetattr('not_method')), scoped_nodes.Lambda)

        instance = next(ast_nodes[1].infer())
        lam = next(instance.igetattr('lam'))
        self.assertIsInstance(lam, BoundMethod)
        not_method = next(instance.igetattr('not_method'))
        self.assertIsInstance(not_method, scoped_nodes.Lambda)

    def test_class_extra_decorators_frame_is_not_class(self):
        ast_node = builder.extract_node('''
        def ala():
            def bala(): #@
                func = 42
        ''')
        self.assertEqual(ast_node.extra_decorators, [])

    def test_class_extra_decorators_only_callfunc_are_considered(self):
        ast_node = builder.extract_node('''
        class Ala(object):
             def func(self): #@
                 pass
             func = 42
        ''')
        self.assertEqual(ast_node.extra_decorators, [])

    def test_class_extra_decorators_only_assignment_names_are_considered(self):
        ast_node = builder.extract_node('''
        class Ala(object):
             def func(self): #@
                 pass
             def __init__(self):
                 self.func = staticmethod(func)

        ''')
        self.assertEqual(ast_node.extra_decorators, [])

    def test_class_extra_decorators_only_same_name_considered(self):
        ast_node = builder.extract_node('''
        class Ala(object):
             def func(self): #@
                pass
             bala = staticmethod(func)
        ''')
        self.assertEqual(ast_node.extra_decorators, [])
        self.assertEqual(ast_node.type, 'method')

    def test_class_extra_decorators(self):
        static_method, clsmethod = builder.extract_node('''
        class Ala(object):
             def static(self): #@
                 pass
             def class_method(self): #@
                 pass
             class_method = classmethod(class_method)
             static = staticmethod(static)              
        ''')
        self.assertEqual(len(clsmethod.extra_decorators), 1)
        self.assertEqual(clsmethod.type, 'classmethod')
        self.assertEqual(len(static_method.extra_decorators), 1)
        self.assertEqual(static_method.type, 'staticmethod')

    def test_extra_decorators_only_class_level_assignments(self):
        node = builder.extract_node('''
        def _bind(arg):
            return arg.bind

        class A(object):
            @property
            def bind(self):
                return 42
            def irelevant(self):
                # This is important, because it used to trigger
                # a maximum recursion error.
                bind = _bind(self)
                return bind 
        A() #@
        ''')
        inferred = next(node.infer())
        bind = next(inferred.igetattr('bind'))
        self.assertIsInstance(bind, nodes.Const)
        self.assertEqual(bind.value, 42)
        parent = bind.scope()
        self.assertEqual(len(parent.extra_decorators), 0)

    @test_utils.require_version(minver='3.0')
    def test_class_keywords(self):
        data = '''
            class TestKlass(object, metaclass=TestMetaKlass,
                    foo=42, bar='baz'):
                pass
        '''
        astroid = builder.parse(data, __name__)
        cls = astroid['TestKlass']
        self.assertEqual(len(cls.keywords), 2)
        self.assertEqual([x.arg for x in cls.keywords], ['foo', 'bar'])


if __name__ == '__main__':
    unittest.main()
