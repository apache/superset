# Copyright (c) 2007-2013 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""tests for the astroid variable lookup capabilities
"""
import functools
import sys
import unittest

from astroid import builder
from astroid import exceptions
from astroid import nodes
from astroid import scoped_nodes
from astroid import util
from astroid.tests import resources


class LookupTest(resources.SysPathSetup, unittest.TestCase):

    def setUp(self):
        super(LookupTest, self).setUp()
        self.module = resources.build_file('data/module.py', 'data.module')
        self.module2 = resources.build_file('data/module2.py', 'data.module2')
        self.nonregr = resources.build_file('data/nonregr.py', 'data.nonregr')

    def test_limit(self):
        code = '''
            l = [a
                 for a,b in list]

            a = 1
            b = a
            a = None

            def func():
                c = 1
        '''
        astroid = builder.parse(code, __name__)
        # a & b
        a = next(astroid.nodes_of_class(nodes.Name))
        self.assertEqual(a.lineno, 2)
        if sys.version_info < (3, 0):
            self.assertEqual(len(astroid.lookup('b')[1]), 1)
            self.assertEqual(len(astroid.lookup('a')[1]), 1)
            b = astroid.locals['b'][1]
        else:
            self.assertEqual(len(astroid.lookup('b')[1]), 1)
            self.assertEqual(len(astroid.lookup('a')[1]), 1)
            b = astroid.locals['b'][0]
        stmts = a.lookup('a')[1]
        self.assertEqual(len(stmts), 1)
        self.assertEqual(b.lineno, 6)
        b_infer = b.infer()
        b_value = next(b_infer)
        self.assertEqual(b_value.value, 1)
        # c
        self.assertRaises(StopIteration, functools.partial(next, b_infer))
        func = astroid.locals['func'][0]
        self.assertEqual(len(func.lookup('c')[1]), 1)

    def test_module(self):
        astroid = builder.parse('pass', __name__)
        # built-in objects
        none = next(astroid.ilookup('None'))
        self.assertIsNone(none.value)
        obj = next(astroid.ilookup('object'))
        self.assertIsInstance(obj, nodes.ClassDef)
        self.assertEqual(obj.name, 'object')
        self.assertRaises(exceptions.InferenceError,
                          functools.partial(next, astroid.ilookup('YOAA')))

        # XXX
        self.assertEqual(len(list(self.nonregr.ilookup('enumerate'))), 2)

    def test_class_ancestor_name(self):
        code = '''
            class A:
                pass

            class A(A):
                pass
        '''
        astroid = builder.parse(code, __name__)
        cls1 = astroid.locals['A'][0]
        cls2 = astroid.locals['A'][1]
        name = next(cls2.nodes_of_class(nodes.Name))
        self.assertEqual(next(name.infer()), cls1)

    ### backport those test to inline code
    def test_method(self):
        method = self.module['YOUPI']['method']
        my_dict = next(method.ilookup('MY_DICT'))
        self.assertTrue(isinstance(my_dict, nodes.Dict), my_dict)
        none = next(method.ilookup('None'))
        self.assertIsNone(none.value)
        self.assertRaises(exceptions.InferenceError,
                          functools.partial(next, method.ilookup('YOAA')))

    def test_function_argument_with_default(self):
        make_class = self.module2['make_class']
        base = next(make_class.ilookup('base'))
        self.assertTrue(isinstance(base, nodes.ClassDef), base.__class__)
        self.assertEqual(base.name, 'YO')
        self.assertEqual(base.root().name, 'data.module')

    def test_class(self):
        klass = self.module['YOUPI']
        my_dict = next(klass.ilookup('MY_DICT'))
        self.assertIsInstance(my_dict, nodes.Dict)
        none = next(klass.ilookup('None'))
        self.assertIsNone(none.value)
        obj = next(klass.ilookup('object'))
        self.assertIsInstance(obj, nodes.ClassDef)
        self.assertEqual(obj.name, 'object')
        self.assertRaises(exceptions.InferenceError,
                          functools.partial(next, klass.ilookup('YOAA')))

    def test_inner_classes(self):
        ddd = list(self.nonregr['Ccc'].ilookup('Ddd'))
        self.assertEqual(ddd[0].name, 'Ddd')

    def test_loopvar_hiding(self):
        astroid = builder.parse("""
            x = 10
            for x in range(5):
                print (x)

            if x > 0:
                print ('#' * x)
        """, __name__)
        xnames = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == 'x']
        # inside the loop, only one possible assignment
        self.assertEqual(len(xnames[0].lookup('x')[1]), 1)
        # outside the loop, two possible assignments
        self.assertEqual(len(xnames[1].lookup('x')[1]), 2)
        self.assertEqual(len(xnames[2].lookup('x')[1]), 2)

    def test_list_comps(self):
        astroid = builder.parse("""
            print ([ i for i in range(10) ])
            print ([ i for i in range(10) ])
            print ( list( i for i in range(10) ) )
        """, __name__)
        xnames = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == 'i']
        self.assertEqual(len(xnames[0].lookup('i')[1]), 1)
        self.assertEqual(xnames[0].lookup('i')[1][0].lineno, 2)
        self.assertEqual(len(xnames[1].lookup('i')[1]), 1)
        self.assertEqual(xnames[1].lookup('i')[1][0].lineno, 3)
        self.assertEqual(len(xnames[2].lookup('i')[1]), 1)
        self.assertEqual(xnames[2].lookup('i')[1][0].lineno, 4)

    def test_list_comp_target(self):
        """test the list comprehension target"""
        astroid = builder.parse("""
            ten = [ var for var in range(10) ]
            var
        """)
        var = astroid.body[1].value
        if sys.version_info < (3, 0):
            self.assertEqual(var.inferred(), [util.Uninferable])
        else:
            self.assertRaises(exceptions.NameInferenceError, var.inferred)

    def test_dict_comps(self):
        astroid = builder.parse("""
            print ({ i: j for i in range(10) for j in range(10) })
            print ({ i: j for i in range(10) for j in range(10) })
        """, __name__)
        xnames = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == 'i']
        self.assertEqual(len(xnames[0].lookup('i')[1]), 1)
        self.assertEqual(xnames[0].lookup('i')[1][0].lineno, 2)
        self.assertEqual(len(xnames[1].lookup('i')[1]), 1)
        self.assertEqual(xnames[1].lookup('i')[1][0].lineno, 3)

        xnames = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == 'j']
        self.assertEqual(len(xnames[0].lookup('i')[1]), 1)
        self.assertEqual(xnames[0].lookup('i')[1][0].lineno, 2)
        self.assertEqual(len(xnames[1].lookup('i')[1]), 1)
        self.assertEqual(xnames[1].lookup('i')[1][0].lineno, 3)

    def test_set_comps(self):
        astroid = builder.parse("""
            print ({ i for i in range(10) })
            print ({ i for i in range(10) })
        """, __name__)
        xnames = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == 'i']
        self.assertEqual(len(xnames[0].lookup('i')[1]), 1)
        self.assertEqual(xnames[0].lookup('i')[1][0].lineno, 2)
        self.assertEqual(len(xnames[1].lookup('i')[1]), 1)
        self.assertEqual(xnames[1].lookup('i')[1][0].lineno, 3)

    def test_set_comp_closure(self):
        astroid = builder.parse("""
            ten = { var for var in range(10) }
            var
        """)
        var = astroid.body[1].value
        self.assertRaises(exceptions.NameInferenceError, var.inferred)

    def test_generator_attributes(self):
        tree = builder.parse("""
            def count():
                "test"
                yield 0

            iterer = count()
            num = iterer.next()
        """)
        next_node = tree.body[2].value.func
        gener = next_node.expr.inferred()[0]
        if sys.version_info < (3, 0):
            self.assertIsInstance(gener.getattr('next')[0], nodes.FunctionDef)
        else:
            self.assertIsInstance(gener.getattr('__next__')[0], nodes.FunctionDef)
        self.assertIsInstance(gener.getattr('send')[0], nodes.FunctionDef)
        self.assertIsInstance(gener.getattr('throw')[0], nodes.FunctionDef)
        self.assertIsInstance(gener.getattr('close')[0], nodes.FunctionDef)

    def test_explicit___name__(self):
        code = '''
            class Pouet:
                __name__ = "pouet"
            p1 = Pouet()

            class PouetPouet(Pouet): pass
            p2 = Pouet()

            class NoName: pass
            p3 = NoName()
        '''
        astroid = builder.parse(code, __name__)
        p1 = next(astroid['p1'].infer())
        self.assertTrue(p1.getattr('__name__'))
        p2 = next(astroid['p2'].infer())
        self.assertTrue(p2.getattr('__name__'))
        self.assertTrue(astroid['NoName'].getattr('__name__'))
        p3 = next(astroid['p3'].infer())
        self.assertRaises(exceptions.AttributeInferenceError, p3.getattr, '__name__')

    def test_function_module_special(self):
        astroid = builder.parse('''
        def initialize(linter):
            """initialize linter with checkers in this package """
            package_load(linter, __path__[0])
        ''', 'data.__init__')
        path = [n for n in astroid.nodes_of_class(nodes.Name) if n.name == '__path__'][0]
        self.assertEqual(len(path.lookup('__path__')[1]), 1)

    def test_builtin_lookup(self):
        self.assertEqual(scoped_nodes.builtin_lookup('__dict__')[1], ())
        intstmts = scoped_nodes.builtin_lookup('int')[1]
        self.assertEqual(len(intstmts), 1)
        self.assertIsInstance(intstmts[0], nodes.ClassDef)
        self.assertEqual(intstmts[0].name, 'int')
        # pylint: disable=no-member; union type in const_factory, this shouldn't happen
        self.assertIs(intstmts[0], nodes.const_factory(1)._proxied)

    def test_decorator_arguments_lookup(self):
        code = '''
            def decorator(value):
                def wrapper(function):
                    return function
                return wrapper

            class foo:
                member = 10  #@

                @decorator(member) #This will cause pylint to complain
                def test(self):
                    pass
        '''
        member = builder.extract_node(code, __name__).targets[0]
        it = member.infer()
        obj = next(it)
        self.assertIsInstance(obj, nodes.Const)
        self.assertEqual(obj.value, 10)
        self.assertRaises(StopIteration, functools.partial(next, it))

    def test_inner_decorator_member_lookup(self):
        code = '''
            class FileA:
                def decorator(bla):
                    return bla

                @__(decorator)
                def funcA():
                    return 4
        '''
        decname = builder.extract_node(code, __name__)
        it = decname.infer()
        obj = next(it)
        self.assertIsInstance(obj, nodes.FunctionDef)
        self.assertRaises(StopIteration, functools.partial(next, it))

    def test_static_method_lookup(self):
        code = '''
            class FileA:
                @staticmethod
                def funcA():
                    return 4


            class Test:
                FileA = [1,2,3]

                def __init__(self):
                    print (FileA.funcA())
        '''
        astroid = builder.parse(code, __name__)
        it = astroid['Test']['__init__'].ilookup('FileA')
        obj = next(it)
        self.assertIsInstance(obj, nodes.ClassDef)
        self.assertRaises(StopIteration, functools.partial(next, it))

    def test_global_delete(self):
        code = '''
            def run2():
                f = Frobble()

            class Frobble:
                pass
            Frobble.mumble = True

            del Frobble

            def run1():
                f = Frobble()
        '''
        astroid = builder.parse(code, __name__)
        stmts = astroid['run2'].lookup('Frobbel')[1]
        self.assertEqual(len(stmts), 0)
        stmts = astroid['run1'].lookup('Frobbel')[1]
        self.assertEqual(len(stmts), 0)


if __name__ == '__main__':
    unittest.main()
