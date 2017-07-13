# Copyright (c) 2006-2008, 2010-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import sys
import unittest
import textwrap

import six

from astroid import MANAGER, Instance, nodes
from astroid.bases import BUILTINS
from astroid.builder import AstroidBuilder, extract_node
from astroid import exceptions
from astroid.raw_building import build_module
from astroid.manager import AstroidManager
from astroid.test_utils import require_version
from astroid.tests import resources
from astroid import transforms


class NonRegressionTests(resources.AstroidCacheSetupMixin,
                         unittest.TestCase):

    def setUp(self):
        sys.path.insert(0, resources.find('data'))
        MANAGER.always_load_extensions = True
        MANAGER.astroid_cache[BUILTINS] = self._builtins

    def tearDown(self):
        # Since we may have created a brainless manager, leading
        # to a new cache builtin module and proxy classes in the constants,
        # clear out the global manager cache.
        MANAGER.clear_cache(self._builtins)
        MANAGER.always_load_extensions = False
        sys.path.pop(0)
        sys.path_importer_cache.pop(resources.find('data'), None)

    def brainless_manager(self):
        manager = AstroidManager()
        # avoid caching into the AstroidManager borg since we get problems
        # with other tests :
        manager.__dict__ = {}
        manager._failed_import_hooks = []
        manager.astroid_cache = {}
        manager._mod_file_cache = {}
        manager._transform = transforms.TransformVisitor()
        manager.clear_cache() # trigger proper bootstraping
        return manager

    def test_module_path(self):
        man = self.brainless_manager()
        mod = man.ast_from_module_name('package.import_package_subpackage_module')
        package = next(mod.igetattr('package'))
        self.assertEqual(package.name, 'package')
        subpackage = next(package.igetattr('subpackage'))
        self.assertIsInstance(subpackage, nodes.Module)
        self.assertTrue(subpackage.package)
        self.assertEqual(subpackage.name, 'package.subpackage')
        module = next(subpackage.igetattr('module'))
        self.assertEqual(module.name, 'package.subpackage.module')


    def test_package_sidepackage(self):
        manager = self.brainless_manager()
        assert 'package.sidepackage' not in MANAGER.astroid_cache
        package = manager.ast_from_module_name('absimp')
        self.assertIsInstance(package, nodes.Module)
        self.assertTrue(package.package)
        subpackage = next(package.getattr('sidepackage')[0].infer())
        self.assertIsInstance(subpackage, nodes.Module)
        self.assertTrue(subpackage.package)
        self.assertEqual(subpackage.name, 'absimp.sidepackage')


    def test_living_property(self):
        builder = AstroidBuilder()
        builder._done = {}
        builder._module = sys.modules[__name__]
        builder.object_build(build_module('module_name', ''), Whatever)


    def test_new_style_class_detection(self):
        try:
            import pygtk # pylint: disable=unused-variable
        except ImportError:
            self.skipTest('test skipped: pygtk is not available')
        # XXX may fail on some pygtk version, because objects in
        # gobject._gobject have __module__ set to gobject :(
        builder = AstroidBuilder()
        data = """
import pygtk
pygtk.require("2.6")
import gobject

class A(gobject.GObject):
    pass
"""
        astroid = builder.string_build(data, __name__, __file__)
        a = astroid['A']
        self.assertTrue(a.newstyle)

    def test_numpy_crash(self):
        """test don't crash on numpy"""
        #a crash occurred somewhere in the past, and an
        # InferenceError instead of a crash was better, but now we even infer!
        try:
            import numpy # pylint: disable=unused-variable
        except ImportError:
            self.skipTest('test skipped: numpy is not available')
        builder = AstroidBuilder()
        data = """
from numpy import multiply

multiply(1, 2, 3)
"""
        astroid = builder.string_build(data, __name__, __file__)
        callfunc = astroid.body[1].value.func
        inferred = callfunc.inferred()
        self.assertEqual(len(inferred), 1)

    @require_version('3.0')
    def test_nameconstant(self):
        # used to fail for Python 3.4
        builder = AstroidBuilder()
        astroid = builder.string_build("def test(x=True): pass")
        default = astroid.body[0].args.args[0]
        self.assertEqual(default.name, 'x')
        self.assertEqual(next(default.infer()).value, True)

    @require_version('2.7')
    def test_with_infer_assignnames(self):
        builder = AstroidBuilder()
        data = """
with open('a.txt') as stream, open('b.txt'):
    stream.read()
"""
        astroid = builder.string_build(data, __name__, __file__)
        # Used to crash due to the fact that the second
        # context manager didn't use an assignment name.
        list(astroid.nodes_of_class(nodes.Call))[-1].inferred()

    def test_recursion_regression_issue25(self):
        builder = AstroidBuilder()
        data = """
import recursion as base

_real_Base = base.Base

class Derived(_real_Base):
    pass

def run():
    base.Base = Derived
"""
        astroid = builder.string_build(data, __name__, __file__)
        # Used to crash in _is_metaclass, due to wrong
        # ancestors chain
        classes = astroid.nodes_of_class(nodes.ClassDef)
        for klass in classes:
            # triggers the _is_metaclass call
            klass.type # pylint: disable=pointless-statement

    def test_decorator_callchain_issue42(self):
        builder = AstroidBuilder()
        data = """

def test():
    def factory(func):
        def newfunc():
            func()
        return newfunc
    return factory

@test()
def crash():
    pass
"""
        astroid = builder.string_build(data, __name__, __file__)
        self.assertEqual(astroid['crash'].type, 'function')

    def test_filter_stmts_scoping(self):
        builder = AstroidBuilder()
        data = """
def test():
    compiler = int()
    class B(compiler.__class__):
        pass
    compiler = B()
    return compiler
"""
        astroid = builder.string_build(data, __name__, __file__)
        test = astroid['test']
        result = next(test.infer_call_result(astroid))
        self.assertIsInstance(result, Instance)
        base = next(result._proxied.bases[0].infer())
        self.assertEqual(base.name, 'int')

    def test_ancestors_patching_class_recursion(self):
        node = AstroidBuilder().string_build(textwrap.dedent("""
        import string
        Template = string.Template

        class A(Template):
            pass

        class B(A):
            pass

        def test(x=False):
            if x:
                string.Template = A
            else:
                string.Template = B
        """))
        klass = node['A']
        ancestors = list(klass.ancestors())
        self.assertEqual(ancestors[0].qname(), 'string.Template')

    def test_ancestors_yes_in_bases(self):
        # Test for issue https://bitbucket.org/logilab/astroid/issue/84
        # This used to crash astroid with a TypeError, because an Uninferable
        # node was present in the bases
        node = extract_node("""
        def with_metaclass(meta, *bases):
            class metaclass(meta):
                def __new__(cls, name, this_bases, d):
                    return meta(name, bases, d)
        return type.__new__(metaclass, 'temporary_class', (), {})

        import lala

        class A(with_metaclass(object, lala.lala)): #@
            pass
        """)
        ancestors = list(node.ancestors())
        if six.PY3:
            self.assertEqual(len(ancestors), 1)
            self.assertEqual(ancestors[0].qname(),
                             "{}.object".format(BUILTINS))
        else:
            self.assertEqual(len(ancestors), 0)

    def test_ancestors_missing_from_function(self):
        # Test for https://www.logilab.org/ticket/122793
        node = extract_node('''
        def gen(): yield
        GEN = gen()
        next(GEN)
        ''')
        self.assertRaises(exceptions.InferenceError, next, node.infer())

    def test_unicode_in_docstring(self):
        # Crashed for astroid==1.4.1
        # Test for https://bitbucket.org/logilab/astroid/issues/273/

        # In a regular file, "coding: utf-8" would have been used.
        node = extract_node(u'''
        from __future__ import unicode_literals

        class MyClass(object):
            def method(self):
                "With unicode : %s "

        instance = MyClass()
        ''' % u"\u2019")

        next(node.value.infer()).as_string()

    def test_binop_generates_nodes_with_parents(self):
        node = extract_node('''
        def no_op(*args):
            pass
        def foo(*args):
            def inner(*more_args):
                args + more_args #@
            return inner
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Tuple)
        self.assertIsNotNone(inferred.parent)
        self.assertIsInstance(inferred.parent, nodes.BinOp)

    def test_decorator_names_inference_error_leaking(self):
        node = extract_node('''
        class Parent(object):
            @property
            def foo(self):
                pass

        class Child(Parent):
            @Parent.foo.getter
            def foo(self): #@
                return super(Child, self).foo + ['oink']
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred.decoratornames(), set())

    def test_ssl_protocol(self):
        node = extract_node('''
        import ssl
        ssl.PROTOCOL_TLSv1
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Const)

    def test_recursive_property_method(self):
        node = extract_node('''
        class APropert():
            @property
            def property(self):
                return self
        APropert().property
        ''')
        next(node.infer())

    def test_uninferable_string_argument_of_namedtuple(self):
        node = extract_node('''
        import collections
        collections.namedtuple('{}'.format("a"), '')()
        ''')
        next(node.infer())

    @require_version(maxver='3.0')
    def test_reassignment_in_except_handler(self):
        node = extract_node('''
        import exceptions
        try:
            {}["a"]
        except KeyError, exceptions.IndexError:
            pass

        IndexError #@
        ''')
        self.assertEqual(len(node.inferred()), 1)


class Whatever(object):
    a = property(lambda x: x, lambda x: x)

if __name__ == '__main__':
    unittest.main()
