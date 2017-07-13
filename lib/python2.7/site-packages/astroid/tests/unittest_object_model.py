# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>
# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import unittest
import xml

import six

import astroid
from astroid import builder
from astroid import exceptions
from astroid import MANAGER
from astroid import test_utils
from astroid import objects


BUILTINS = MANAGER.astroid_cache[six.moves.builtins.__name__]


class InstanceModelTest(unittest.TestCase):

    def test_instance_special_model(self):
        ast_nodes = builder.extract_node('''
        class A:
            "test"
            def __init__(self):
                self.a = 42
        a = A()
        a.__class__ #@
        a.__module__ #@
        a.__doc__ #@
        a.__dict__ #@
        ''', module_name='fake_module')

        cls = next(ast_nodes[0].infer())
        self.assertIsInstance(cls, astroid.ClassDef)
        self.assertEqual(cls.name, 'A')

        module = next(ast_nodes[1].infer())
        self.assertIsInstance(module, astroid.Const)
        self.assertEqual(module.value, 'fake_module')

        doc = next(ast_nodes[2].infer())
        self.assertIsInstance(doc, astroid.Const)
        self.assertEqual(doc.value, 'test')

        dunder_dict = next(ast_nodes[3].infer())
        self.assertIsInstance(dunder_dict, astroid.Dict)
        attr = next(dunder_dict.getitem(astroid.Const('a')).infer())
        self.assertIsInstance(attr, astroid.Const)
        self.assertEqual(attr.value, 42)

    @unittest.expectedFailure
    def test_instance_local_attributes_overrides_object_model(self):
        # The instance lookup needs to be changed in order for this to work.
        ast_node = builder.extract_node('''
        class A:
            @property
            def __dict__(self):
                  return []
        A().__dict__
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, astroid.List)
        self.assertEqual(inferred.elts, [])


class BoundMethodModelTest(unittest.TestCase):

    def test_bound_method_model(self):
        ast_nodes = builder.extract_node('''
        class A:
            def test(self): pass
        a = A()
        a.test.__func__ #@
        a.test.__self__ #@
        ''')

        func = next(ast_nodes[0].infer())
        self.assertIsInstance(func, astroid.FunctionDef)
        self.assertEqual(func.name, 'test')

        self_ = next(ast_nodes[1].infer())
        self.assertIsInstance(self_, astroid.Instance)
        self.assertEqual(self_.name, 'A')


class UnboundMethodModelTest(unittest.TestCase):

    def test_unbound_method_model(self):
        ast_nodes = builder.extract_node('''
        class A:
            def test(self): pass
        t = A.test
        t.__class__ #@
        t.__func__ #@
        t.__self__ #@
        t.im_class #@
        t.im_func #@
        t.im_self #@
        ''')

        cls = next(ast_nodes[0].infer())
        self.assertIsInstance(cls, astroid.ClassDef)
        if six.PY2:
            unbound_name = 'instancemethod'
        else:
            unbound_name = 'function'

        self.assertEqual(cls.name, unbound_name)

        func = next(ast_nodes[1].infer())
        self.assertIsInstance(func, astroid.FunctionDef)
        self.assertEqual(func.name, 'test')

        self_ = next(ast_nodes[2].infer())
        self.assertIsInstance(self_, astroid.Const)
        self.assertIsNone(self_.value)

        self.assertEqual(cls.name, next(ast_nodes[3].infer()).name)
        self.assertEqual(func, next(ast_nodes[4].infer()))
        self.assertIsNone(next(ast_nodes[5].infer()).value)


class ClassModelTest(unittest.TestCase):

    def test_priority_to_local_defined_values(self):
        ast_node = builder.extract_node('''
        class A:
            __doc__ = "first"
        A.__doc__ #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, astroid.Const)
        self.assertEqual(inferred.value, "first")

    @test_utils.require_version(maxver='3.0')
    def test__mro__old_style(self):
        ast_node = builder.extract_node('''
        class A:
            pass
        A.__mro__
        ''')
        with self.assertRaises(exceptions.InferenceError):
            next(ast_node.infer())

    @test_utils.require_version(maxver='3.0')
    def test__subclasses__old_style(self):
        ast_node = builder.extract_node('''
        class A:
            pass
        A.__subclasses__
        ''')
        with self.assertRaises(exceptions.InferenceError):
            next(ast_node.infer())

    def test_class_model_correct_mro_subclasses_proxied(self):
        ast_nodes = builder.extract_node('''
        class A(object):
            pass
        A.mro #@
        A.__subclasses__ #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, astroid.BoundMethod)
            self.assertIsInstance(inferred._proxied, astroid.FunctionDef)
            self.assertIsInstance(inferred.bound, astroid.ClassDef)
            self.assertEqual(inferred.bound.name, 'type')

    @unittest.skipUnless(six.PY2, "Needs old style classes")
    def test_old_style_classes_no_mro(self):
        ast_node = builder.extract_node('''
        class A:
            pass
        A.mro #@
        ''')
        with self.assertRaises(exceptions.InferenceError):
            next(ast_node.infer())

    def test_class_model(self):
        ast_nodes = builder.extract_node('''
        class A(object):
            "test"

        class B(A): pass
        class C(A): pass

        A.__module__ #@
        A.__name__ #@
        A.__qualname__ #@
        A.__doc__ #@
        A.__mro__ #@
        A.mro() #@
        A.__bases__ #@
        A.__class__ #@
        A.__dict__ #@
        A.__subclasses__() #@
        ''', module_name='fake_module')

        module = next(ast_nodes[0].infer())
        self.assertIsInstance(module, astroid.Const)
        self.assertEqual(module.value, 'fake_module')

        name = next(ast_nodes[1].infer())
        self.assertIsInstance(name, astroid.Const)
        self.assertEqual(name.value, 'A')

        qualname = next(ast_nodes[2].infer())
        self.assertIsInstance(qualname, astroid.Const)
        self.assertEqual(qualname.value, 'fake_module.A')

        doc = next(ast_nodes[3].infer())
        self.assertIsInstance(doc, astroid.Const)
        self.assertEqual(doc.value, 'test')

        mro = next(ast_nodes[4].infer())
        self.assertIsInstance(mro, astroid.Tuple)
        self.assertEqual([cls.name for cls in mro.elts],
                         ['A', 'object'])

        called_mro = next(ast_nodes[5].infer())
        self.assertEqual(called_mro.elts, mro.elts)

        bases = next(ast_nodes[6].infer())
        self.assertIsInstance(bases, astroid.Tuple)
        self.assertEqual([cls.name for cls in bases.elts],
                         ['object'])

        cls = next(ast_nodes[7].infer())
        self.assertIsInstance(cls, astroid.ClassDef)
        self.assertEqual(cls.name, 'type')

        cls_dict = next(ast_nodes[8].infer())
        self.assertIsInstance(cls_dict, astroid.Dict)

        subclasses = next(ast_nodes[9].infer())
        self.assertIsInstance(subclasses, astroid.List)
        self.assertEqual([cls.name for cls in subclasses.elts], ['B', 'C'])


class ModuleModelTest(unittest.TestCase):

    def test_priority_to_local_defined_values(self):
        ast_node = astroid.parse('''
        __file__ = "mine"
        ''')
        file_value = next(ast_node.igetattr('__file__'))
        self.assertIsInstance(file_value, astroid.Const)
        self.assertEqual(file_value.value, "mine")

    def test__path__not_a_package(self):
        ast_node = builder.extract_node('''
        import sys
        sys.__path__ #@
        ''')
        with self.assertRaises(exceptions.InferenceError):
            next(ast_node.infer())

    def test_module_model(self):
        ast_nodes = builder.extract_node('''
        import xml
        xml.__path__ #@
        xml.__name__ #@
        xml.__doc__ #@
        xml.__file__ #@
        xml.__spec__ #@
        xml.__loader__ #@
        xml.__cached__ #@
        xml.__package__ #@
        xml.__dict__ #@
        ''')

        path = next(ast_nodes[0].infer())
        self.assertIsInstance(path, astroid.List)
        self.assertIsInstance(path.elts[0], astroid.Const)
        self.assertEqual(path.elts[0].value, xml.__path__[0])

        name = next(ast_nodes[1].infer())
        self.assertIsInstance(name, astroid.Const)
        self.assertEqual(name.value, 'xml')

        doc = next(ast_nodes[2].infer())
        self.assertIsInstance(doc, astroid.Const)
        self.assertEqual(doc.value, xml.__doc__)

        file_ = next(ast_nodes[3].infer())
        self.assertIsInstance(file_, astroid.Const)
        self.assertEqual(file_.value, xml.__file__.replace(".pyc", ".py"))

        for ast_node in ast_nodes[4:7]:
            inferred = next(ast_node.infer())
            self.assertIs(inferred, astroid.Uninferable)

        package = next(ast_nodes[7].infer())
        self.assertIsInstance(package, astroid.Const)
        self.assertEqual(package.value, 'xml')

        dict_ = next(ast_nodes[8].infer())
        self.assertIsInstance(dict_, astroid.Dict)


class FunctionModelTest(unittest.TestCase):

    def test_partial_descriptor_support(self):
        bound, result = builder.extract_node('''
        class A(object): pass
        def test(self): return 42
        f = test.__get__(A(), A)
        f #@
        f() #@
        ''')
        bound = next(bound.infer())
        self.assertIsInstance(bound, astroid.BoundMethod)
        self.assertEqual(bound._proxied._proxied.name, 'test')
        result = next(result.infer())
        self.assertIsInstance(result, astroid.Const)
        self.assertEqual(result.value, 42)

    @unittest.expectedFailure
    def test_descriptor_not_inferrring_self(self):
        # We can't infer __get__(X, Y)() when the bounded function
        # uses self, because of the tree's parent not being propagating good enough.
        result = builder.extract_node('''
        class A(object):
            x = 42
        def test(self): return self.x
        f = test.__get__(A(), A)
        f() #@
        ''')
        result = next(result.infer())
        self.assertIsInstance(result, astroid.Const)
        self.assertEqual(result.value, 42)

    def test_descriptors_binding_invalid(self):
        ast_nodes = builder.extract_node('''
        class A: pass
        def test(self): return 42
        test.__get__()() #@
        test.__get__(1)() #@
        test.__get__(2, 3, 4) #@
        ''')
        for node in ast_nodes:
            with self.assertRaises(exceptions.InferenceError):
                next(node.infer())

    def test_function_model(self):
        ast_nodes = builder.extract_node('''
        def func(a=1, b=2):
            """test"""
        func.__name__ #@
        func.__doc__ #@
        func.__qualname__ #@
        func.__module__  #@
        func.__defaults__ #@
        func.__dict__ #@
        func.__globals__ #@
        func.__code__ #@
        func.__closure__ #@
        ''', module_name='fake_module')

        name = next(ast_nodes[0].infer())
        self.assertIsInstance(name, astroid.Const)
        self.assertEqual(name.value, 'func')

        doc = next(ast_nodes[1].infer())
        self.assertIsInstance(doc, astroid.Const)
        self.assertEqual(doc.value, 'test')

        qualname = next(ast_nodes[2].infer())
        self.assertIsInstance(qualname, astroid.Const)
        self.assertEqual(qualname.value, 'fake_module.func')

        module = next(ast_nodes[3].infer())
        self.assertIsInstance(module, astroid.Const)
        self.assertEqual(module.value, 'fake_module')

        defaults = next(ast_nodes[4].infer())
        self.assertIsInstance(defaults, astroid.Tuple)
        self.assertEqual([default.value for default in defaults.elts], [1, 2])

        dict_ = next(ast_nodes[5].infer())
        self.assertIsInstance(dict_, astroid.Dict)

        globals_ = next(ast_nodes[6].infer())
        self.assertIsInstance(globals_, astroid.Dict)

        for ast_node in ast_nodes[7:9]:
            self.assertIs(next(ast_node.infer()), astroid.Uninferable)

    @test_utils.require_version(minver='3.0')
    def test_empty_return_annotation(self):
        ast_node = builder.extract_node('''
        def test(): pass
        test.__annotations__
        ''')
        annotations = next(ast_node.infer())
        self.assertIsInstance(annotations, astroid.Dict)
        self.assertEqual(len(annotations.items), 0)

    @test_utils.require_version(minver='3.0')
    def test_annotations_kwdefaults(self):
        ast_node = builder.extract_node('''
        def test(a: 1, *args: 2, f:4='lala', **kwarg:3)->2: pass
        test.__annotations__ #@
        test.__kwdefaults__ #@
        ''')
        annotations = next(ast_node[0].infer())
        self.assertIsInstance(annotations, astroid.Dict)
        self.assertIsInstance(annotations.getitem(astroid.Const('return')), astroid.Const)
        self.assertEqual(annotations.getitem(astroid.Const('return')).value, 2)
        self.assertIsInstance(annotations.getitem(astroid.Const('a')), astroid.Const)
        self.assertEqual(annotations.getitem(astroid.Const('a')).value, 1)
        self.assertEqual(annotations.getitem(astroid.Const('args')).value, 2)
        self.assertEqual(annotations.getitem(astroid.Const('kwarg')).value, 3)

        self.assertEqual(annotations.getitem(astroid.Const('f')).value, 4)

        kwdefaults = next(ast_node[1].infer())
        self.assertIsInstance(kwdefaults, astroid.Dict)
        # self.assertEqual(kwdefaults.getitem('f').value, 'lala')

    @test_utils.require_version(maxver='3.0')
    def test_function_model_for_python2(self):
        ast_nodes = builder.extract_node('''
        def test(a=1):
          "a"

        test.func_name #@
        test.func_doc #@
        test.func_dict #@
        test.func_globals #@
        test.func_defaults #@
        test.func_code #@
        test.func_closure #@
        ''')
        name = next(ast_nodes[0].infer())
        self.assertIsInstance(name, astroid.Const)
        self.assertEqual(name.value, 'test')
        doc = next(ast_nodes[1].infer())
        self.assertIsInstance(doc, astroid.Const)
        self.assertEqual(doc.value, 'a')
        pydict = next(ast_nodes[2].infer())
        self.assertIsInstance(pydict, astroid.Dict)
        pyglobals = next(ast_nodes[3].infer())
        self.assertIsInstance(pyglobals, astroid.Dict)
        defaults = next(ast_nodes[4].infer())
        self.assertIsInstance(defaults, astroid.Tuple)
        for node in ast_nodes[5:]:
            self.assertIs(next(node.infer()), astroid.Uninferable)


class GeneratorModelTest(unittest.TestCase):

    def test_model(self):
        ast_nodes = builder.extract_node('''
        def test():
           "a"
           yield

        gen = test()
        gen.__name__ #@
        gen.__doc__ #@
        gen.gi_code #@
        gen.gi_frame #@
        gen.send #@
        ''')

        name = next(ast_nodes[0].infer())
        self.assertEqual(name.value, 'test')

        doc = next(ast_nodes[1].infer())
        self.assertEqual(doc.value, 'a')

        gi_code = next(ast_nodes[2].infer())
        self.assertIsInstance(gi_code, astroid.ClassDef)
        self.assertEqual(gi_code.name, 'gi_code')

        gi_frame = next(ast_nodes[3].infer())
        self.assertIsInstance(gi_frame, astroid.ClassDef)
        self.assertEqual(gi_frame.name, 'gi_frame')

        send = next(ast_nodes[4].infer())
        self.assertIsInstance(send, astroid.BoundMethod)


class ExceptionModelTest(unittest.TestCase):

    @unittest.skipIf(six.PY2, "needs Python 3")
    def test_model_py3(self):
        ast_nodes = builder.extract_node('''
        try:
            x[42]
        except ValueError as err:
           err.args #@
           err.__traceback__ #@

           err.message #@
        ''')
        args = next(ast_nodes[0].infer())
        self.assertIsInstance(args, astroid.Tuple)
        tb = next(ast_nodes[1].infer())
        self.assertIsInstance(tb, astroid.Instance)
        self.assertEqual(tb.name, 'traceback')

        with self.assertRaises(exceptions.InferenceError):
            next(ast_nodes[2].infer())

    @unittest.skipUnless(six.PY2, "needs Python 2")
    def test_model_py2(self):
        ast_nodes = builder.extract_node('''
        try:
            x[42]
        except ValueError as err:
           err.args #@
           err.message #@

           err.__traceback__ #@
        ''')
        args = next(ast_nodes[0].infer())
        self.assertIsInstance(args, astroid.Tuple)
        message = next(ast_nodes[1].infer())
        self.assertIsInstance(message, astroid.Const)

        with self.assertRaises(exceptions.InferenceError):
            next(ast_nodes[2].infer())


class DictObjectModelTest(unittest.TestCase):

    def test__class__(self):
        ast_node = builder.extract_node('{}.__class__')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, astroid.ClassDef)
        self.assertEqual(inferred.name, 'dict')

    def test_attributes_inferred_as_methods(self):
        ast_nodes = builder.extract_node('''
        {}.values #@
        {}.items #@
        {}.keys #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, astroid.BoundMethod)

    @unittest.skipUnless(six.PY2, "needs Python 2")
    def test_concrete_objects_for_dict_methods(self):
        ast_nodes = builder.extract_node('''
        {1:1, 2:3}.values() #@
        {1:1, 2:3}.keys() #@
        {1:1, 2:3}.items() #@
        ''')
        values = next(ast_nodes[0].infer())
        self.assertIsInstance(values, astroid.List)
        self.assertEqual([value.value for value in values.elts], [1, 3])

        keys = next(ast_nodes[1].infer())
        self.assertIsInstance(keys, astroid.List)
        self.assertEqual([key.value for key in keys.elts], [1, 2])

        items = next(ast_nodes[2].infer())
        self.assertIsInstance(items, astroid.List)
        for expected, elem in zip([(1, 1), (2, 3)], items.elts):
            self.assertIsInstance(elem, astroid.Tuple)
            self.assertEqual(list(expected), [elt.value for elt in elem.elts])

    @unittest.skipIf(six.PY2, "needs Python 3")
    def test_wrapper_objects_for_dict_methods_python3(self):
        ast_nodes = builder.extract_node('''
        {1:1, 2:3}.values() #@
        {1:1, 2:3}.keys() #@
        {1:1, 2:3}.items() #@
        ''')
        values = next(ast_nodes[0].infer())
        self.assertIsInstance(values, objects.DictValues)
        self.assertEqual([elt.value for elt in values.elts], [1, 3])
        keys = next(ast_nodes[1].infer())
        self.assertIsInstance(keys, objects.DictKeys)
        self.assertEqual([elt.value for elt in keys.elts], [1, 2])
        items = next(ast_nodes[2].infer())
        self.assertIsInstance(items, objects.DictItems)


class LruCacheModelTest(unittest.TestCase):

    @unittest.skipIf(six.PY2, "needs Python 3")
    def test_lru_cache(self):
        ast_nodes = builder.extract_node('''
        import functools
        class Foo(object):
            @functools.lru_cache()
            def foo():
                pass
        f = Foo()
        f.foo.cache_clear #@
        f.foo.__wrapped__ #@
        f.foo.cache_info() #@
        ''')
        cache_clear = next(ast_nodes[0].infer())
        self.assertIsInstance(cache_clear, astroid.BoundMethod)
        wrapped = next(ast_nodes[1].infer())
        self.assertIsInstance(wrapped, astroid.FunctionDef)
        self.assertEqual(wrapped.name, 'foo')
        cache_info = next(ast_nodes[2].infer())
        self.assertIsInstance(cache_info, astroid.Instance)


if __name__ == '__main__':
    unittest.main()
