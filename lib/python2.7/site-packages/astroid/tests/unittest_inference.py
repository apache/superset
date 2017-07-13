# Copyright (c) 2006-2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015 Dmitry Pribysh <dmand@yandex.ru>
# Copyright (c) 2015 Rene Zhang <rz99@cornell.edu>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""tests for the astroid inference capabilities
"""
# pylint: disable=too-many-lines
import os
import sys
from functools import partial
import unittest
import warnings

import six

from astroid import InferenceError, builder, nodes
from astroid.builder import parse, extract_node
from astroid.inference import infer_end as inference_infer_end
from astroid.bases import Instance, BoundMethod, UnboundMethod,\
                                BUILTINS
from astroid import arguments
from astroid import decorators as decoratorsmod
from astroid import exceptions
from astroid import helpers
from astroid import objects
from astroid import test_utils
from astroid import util
from astroid.tests import resources


def get_node_of_class(start_from, klass):
    return next(start_from.nodes_of_class(klass))

builder = builder.AstroidBuilder()

if sys.version_info < (3, 0):
    EXC_MODULE = 'exceptions'
    BOOL_SPECIAL_METHOD = '__nonzero__'
else:
    EXC_MODULE = BUILTINS
    BOOL_SPECIAL_METHOD = '__bool__'


class InferenceUtilsTest(unittest.TestCase):

    def test_path_wrapper(self):
        def infer_default(self, *args):
            raise InferenceError
        infer_default = decoratorsmod.path_wrapper(infer_default)
        infer_end = decoratorsmod.path_wrapper(inference_infer_end)
        with self.assertRaises(InferenceError):
            next(infer_default(1))
        self.assertEqual(next(infer_end(1)), 1)


def _assertInferElts(node_type, self, node, elts):
    inferred = next(node.infer())
    self.assertIsInstance(inferred, node_type)
    self.assertEqual(sorted(elt.value for elt in inferred.elts),
                     elts)

def partialmethod(func, arg):
    """similar to functools.partial but return a lambda instead of a class so returned value may be
    turned into a method.
    """
    return lambda *args, **kwargs: func(arg, *args, **kwargs)

class InferenceTest(resources.SysPathSetup, unittest.TestCase):

    # additional assertInfer* method for builtin types

    def assertInferConst(self, node, expected):
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, expected)

    def assertInferDict(self, node, expected):
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Dict)

        elts = set([(key.value, value.value)
                    for (key, value) in inferred.items])
        self.assertEqual(sorted(elts), sorted(expected.items()))

    assertInferTuple = partialmethod(_assertInferElts, nodes.Tuple)
    assertInferList = partialmethod(_assertInferElts, nodes.List)
    assertInferSet = partialmethod(_assertInferElts, nodes.Set)
    assertInferFrozenSet = partialmethod(_assertInferElts, objects.FrozenSet)

    CODE = '''
        class C(object):
            "new style"
            attr = 4

            def meth1(self, arg1, optarg=0):
                var = object()
                print ("yo", arg1, optarg)
                self.iattr = "hop"
                return var

            def meth2(self):
                self.meth1(*self.meth3)

            def meth3(self, d=attr):
                b = self.attr
                c = self.iattr
                return b, c

        ex = Exception("msg")
        v = C().meth1(1)
        m_unbound = C.meth1
        m_bound = C().meth1
        a, b, c = ex, 1, "bonjour"
        [d, e, f] = [ex, 1.0, ("bonjour", v)]
        g, h = f
        i, (j, k) = "glup", f

        a, b= b, a # Gasp !
        '''

    ast = parse(CODE, __name__)

    def test_infer_abstract_property_return_values(self):
        module = parse('''
        import abc

        class A(object):
            @abc.abstractproperty
            def test(self):
                return 42

        a = A()
        x = a.test
        ''')
        inferred = next(module['x'].infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_module_inference(self):
        inferred = self.ast.infer()
        obj = next(inferred)
        self.assertEqual(obj.name, __name__)
        self.assertEqual(obj.root().name, __name__)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_class_inference(self):
        inferred = self.ast['C'].infer()
        obj = next(inferred)
        self.assertEqual(obj.name, 'C')
        self.assertEqual(obj.root().name, __name__)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_function_inference(self):
        inferred = self.ast['C']['meth1'].infer()
        obj = next(inferred)
        self.assertEqual(obj.name, 'meth1')
        self.assertEqual(obj.root().name, __name__)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_builtin_name_inference(self):
        inferred = self.ast['C']['meth1']['var'].infer()
        var = next(inferred)
        self.assertEqual(var.name, 'object')
        self.assertEqual(var.root().name, BUILTINS)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_tupleassign_name_inference(self):
        inferred = self.ast['a'].infer()
        exc = next(inferred)
        self.assertIsInstance(exc, Instance)
        self.assertEqual(exc.name, 'Exception')
        self.assertEqual(exc.root().name, EXC_MODULE)
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['b'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, 1)
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['c'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, "bonjour")
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_listassign_name_inference(self):
        inferred = self.ast['d'].infer()
        exc = next(inferred)
        self.assertIsInstance(exc, Instance)
        self.assertEqual(exc.name, 'Exception')
        self.assertEqual(exc.root().name, EXC_MODULE)
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['e'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, 1.0)
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['f'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Tuple)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_advanced_tupleassign_name_inference1(self):
        inferred = self.ast['g'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, "bonjour")
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['h'].infer()
        var = next(inferred)
        self.assertEqual(var.name, 'object')
        self.assertEqual(var.root().name, BUILTINS)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_advanced_tupleassign_name_inference2(self):
        inferred = self.ast['i'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, u"glup")
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['j'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, "bonjour")
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast['k'].infer()
        var = next(inferred)
        self.assertEqual(var.name, 'object')
        self.assertEqual(var.root().name, BUILTINS)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_swap_assign_inference(self):
        inferred = self.ast.locals['a'][1].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, 1)
        self.assertRaises(StopIteration, partial(next, inferred))
        inferred = self.ast.locals['b'][1].infer()
        exc = next(inferred)
        self.assertIsInstance(exc, Instance)
        self.assertEqual(exc.name, 'Exception')
        self.assertEqual(exc.root().name, EXC_MODULE)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_getattr_inference1(self):
        inferred = self.ast['ex'].infer()
        exc = next(inferred)
        self.assertIsInstance(exc, Instance)
        self.assertEqual(exc.name, 'Exception')
        self.assertEqual(exc.root().name, EXC_MODULE)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_getattr_inference2(self):
        inferred = get_node_of_class(self.ast['C']['meth2'], nodes.Attribute).infer()
        meth1 = next(inferred)
        self.assertEqual(meth1.name, 'meth1')
        self.assertEqual(meth1.root().name, __name__)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_getattr_inference3(self):
        inferred = self.ast['C']['meth3']['b'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, 4)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_getattr_inference4(self):
        inferred = self.ast['C']['meth3']['c'].infer()
        const = next(inferred)
        self.assertIsInstance(const, nodes.Const)
        self.assertEqual(const.value, "hop")
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_callfunc_inference(self):
        inferred = self.ast['v'].infer()
        meth1 = next(inferred)
        self.assertIsInstance(meth1, Instance)
        self.assertEqual(meth1.name, 'object')
        self.assertEqual(meth1.root().name, BUILTINS)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_unbound_method_inference(self):
        inferred = self.ast['m_unbound'].infer()
        meth1 = next(inferred)
        self.assertIsInstance(meth1, UnboundMethod)
        self.assertEqual(meth1.name, 'meth1')
        self.assertEqual(meth1.parent.frame().name, 'C')
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_bound_method_inference(self):
        inferred = self.ast['m_bound'].infer()
        meth1 = next(inferred)
        self.assertIsInstance(meth1, BoundMethod)
        self.assertEqual(meth1.name, 'meth1')
        self.assertEqual(meth1.parent.frame().name, 'C')
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_args_default_inference1(self):
        optarg = test_utils.get_name_node(self.ast['C']['meth1'], 'optarg')
        inferred = optarg.infer()
        obj1 = next(inferred)
        self.assertIsInstance(obj1, nodes.Const)
        self.assertEqual(obj1.value, 0)
        obj1 = next(inferred)
        self.assertIs(obj1, util.Uninferable, obj1)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_args_default_inference2(self):
        inferred = self.ast['C']['meth3'].ilookup('d')
        obj1 = next(inferred)
        self.assertIsInstance(obj1, nodes.Const)
        self.assertEqual(obj1.value, 4)
        obj1 = next(inferred)
        self.assertIs(obj1, util.Uninferable, obj1)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_inference_restrictions(self):
        inferred = test_utils.get_name_node(self.ast['C']['meth1'], 'arg1').infer()
        obj1 = next(inferred)
        self.assertIs(obj1, util.Uninferable, obj1)
        self.assertRaises(StopIteration, partial(next, inferred))

    def test_ancestors_inference(self):
        code = '''
            class A(object):  #@
                pass

            class A(A):  #@
                pass
        '''
        a1, a2 = extract_node(code, __name__)
        a2_ancestors = list(a2.ancestors())
        self.assertEqual(len(a2_ancestors), 2)
        self.assertIs(a2_ancestors[0], a1)

    def test_ancestors_inference2(self):
        code = '''
            class A(object):  #@
                pass

            class B(A):  #@
                pass

            class A(B):  #@
                pass
        '''
        a1, b, a2 = extract_node(code, __name__)
        a2_ancestors = list(a2.ancestors())
        self.assertEqual(len(a2_ancestors), 3)
        self.assertIs(a2_ancestors[0], b)
        self.assertIs(a2_ancestors[1], a1)

    def test_f_arg_f(self):
        code = '''
            def f(f=1):
                return f

            a = f()
        '''
        ast = parse(code, __name__)
        a = ast['a']
        a_inferred = a.inferred()
        self.assertEqual(a_inferred[0].value, 1)
        self.assertEqual(len(a_inferred), 1)

    def test_infered_warning(self):
        code = '''
            def f(f=1):
                return f

            a = f()
        '''
        ast = parse(code, __name__)
        a = ast['a']

        with warnings.catch_warnings(record=True) as w:
            with test_utils.enable_warning(PendingDeprecationWarning):
                a.infered()
            self.assertIsInstance(w[0].message, PendingDeprecationWarning)

    def test_exc_ancestors(self):
        code = '''
        def f():
            raise __(NotImplementedError)
        '''
        error = extract_node(code, __name__)
        nie = error.inferred()[0]
        self.assertIsInstance(nie, nodes.ClassDef)
        nie_ancestors = [c.name for c in nie.ancestors()]
        if sys.version_info < (3, 0):
            expected = ['RuntimeError', 'StandardError',
                        'Exception', 'BaseException', 'object']
            self.assertEqual(nie_ancestors, expected)
        else:
            expected = ['RuntimeError', 'Exception', 'BaseException', 'object']
            self.assertEqual(nie_ancestors, expected)

    def test_except_inference(self):
        code = '''
            try:
                print (hop)
            except NameError as ex:
                ex1 = ex
            except Exception as ex:
                ex2 = ex
                raise
        '''
        ast = parse(code, __name__)
        ex1 = ast['ex1']
        ex1_infer = ex1.infer()
        ex1 = next(ex1_infer)
        self.assertIsInstance(ex1, Instance)
        self.assertEqual(ex1.name, 'NameError')
        self.assertRaises(StopIteration, partial(next, ex1_infer))
        ex2 = ast['ex2']
        ex2_infer = ex2.infer()
        ex2 = next(ex2_infer)
        self.assertIsInstance(ex2, Instance)
        self.assertEqual(ex2.name, 'Exception')
        self.assertRaises(StopIteration, partial(next, ex2_infer))

    def test_del1(self):
        code = '''
            del undefined_attr
        '''
        delete = extract_node(code, __name__)
        self.assertRaises(InferenceError, delete.infer)

    def test_del2(self):
        code = '''
            a = 1
            b = a
            del a
            c = a
            a = 2
            d = a
        '''
        ast = parse(code, __name__)
        n = ast['b']
        n_infer = n.infer()
        inferred = next(n_infer)
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 1)
        self.assertRaises(StopIteration, partial(next, n_infer))
        n = ast['c']
        n_infer = n.infer()
        self.assertRaises(InferenceError, partial(next, n_infer))
        n = ast['d']
        n_infer = n.infer()
        inferred = next(n_infer)
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 2)
        self.assertRaises(StopIteration, partial(next, n_infer))

    def test_builtin_types(self):
        code = '''
            l = [1]
            t = (2,)
            d = {}
            s = ''
            s2 = '_'
        '''
        ast = parse(code, __name__)
        n = ast['l']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.List)
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.getitem(nodes.Const(0)).value, 1)
        self.assertIsInstance(inferred._proxied, nodes.ClassDef)
        self.assertEqual(inferred._proxied.name, 'list')
        self.assertIn('append', inferred._proxied.locals)
        n = ast['t']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.Tuple)
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.getitem(nodes.Const(0)).value, 2)
        self.assertIsInstance(inferred._proxied, nodes.ClassDef)
        self.assertEqual(inferred._proxied.name, 'tuple')
        n = ast['d']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.Dict)
        self.assertIsInstance(inferred, Instance)
        self.assertIsInstance(inferred._proxied, nodes.ClassDef)
        self.assertEqual(inferred._proxied.name, 'dict')
        self.assertIn('get', inferred._proxied.locals)
        n = ast['s']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'str')
        self.assertIn('lower', inferred._proxied.locals)
        n = ast['s2']
        inferred = next(n.infer())
        self.assertEqual(inferred.getitem(nodes.Const(0)).value, '_')

        code = 's = {1}'
        ast = parse(code, __name__)
        n = ast['s']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.Set)
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'set')
        self.assertIn('remove', inferred._proxied.locals)

    @test_utils.require_version(maxver='3.0')
    def test_unicode_type(self):
        code = '''u = u""'''
        ast = parse(code, __name__)
        n = ast['u']
        inferred = next(n.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'unicode')
        self.assertIn('lower', inferred._proxied.locals)

    @unittest.expectedFailure
    def test_descriptor_are_callable(self):
        code = '''
            class A:
                statm = staticmethod(open)
                clsm = classmethod('whatever')
        '''
        ast = parse(code, __name__)
        statm = next(ast['A'].igetattr('statm'))
        self.assertTrue(statm.callable())
        clsm = next(ast['A'].igetattr('clsm'))
        self.assertFalse(clsm.callable())

    def test_bt_ancestor_crash(self):
        code = '''
            class Warning(Warning):
                pass
        '''
        ast = parse(code, __name__)
        w = ast['Warning']
        ancestors = w.ancestors()
        ancestor = next(ancestors)
        self.assertEqual(ancestor.name, 'Warning')
        self.assertEqual(ancestor.root().name, EXC_MODULE)
        ancestor = next(ancestors)
        self.assertEqual(ancestor.name, 'Exception')
        self.assertEqual(ancestor.root().name, EXC_MODULE)
        ancestor = next(ancestors)
        self.assertEqual(ancestor.name, 'BaseException')
        self.assertEqual(ancestor.root().name, EXC_MODULE)
        ancestor = next(ancestors)
        self.assertEqual(ancestor.name, 'object')
        self.assertEqual(ancestor.root().name, BUILTINS)
        self.assertRaises(StopIteration, partial(next, ancestors))

    def test_qqch(self):
        code = '''
            from astroid.modutils import load_module_from_name
            xxx = load_module_from_name('__pkginfo__')
        '''
        ast = parse(code, __name__)
        xxx = ast['xxx']
        self.assertSetEqual({n.__class__ for n in xxx.inferred()},
                            {nodes.Const, util.Uninferable.__class__})

    def test_method_argument(self):
        code = '''
            class ErudiEntitySchema:
                """a entity has a type, a set of subject and or object relations"""
                def __init__(self, e_type, **kwargs):
                    kwargs['e_type'] = e_type.capitalize().encode()

                def meth(self, e_type, *args, **kwargs):
                    kwargs['e_type'] = e_type.capitalize().encode()
                    print(args)
            '''
        ast = parse(code, __name__)
        arg = test_utils.get_name_node(ast['ErudiEntitySchema']['__init__'], 'e_type')
        self.assertEqual([n.__class__ for n in arg.infer()],
                         [util.Uninferable.__class__])
        arg = test_utils.get_name_node(ast['ErudiEntitySchema']['__init__'], 'kwargs')
        self.assertEqual([n.__class__ for n in arg.infer()],
                         [nodes.Dict])
        arg = test_utils.get_name_node(ast['ErudiEntitySchema']['meth'], 'e_type')
        self.assertEqual([n.__class__ for n in arg.infer()],
                         [util.Uninferable.__class__])
        arg = test_utils.get_name_node(ast['ErudiEntitySchema']['meth'], 'args')
        self.assertEqual([n.__class__ for n in arg.infer()],
                         [nodes.Tuple])
        arg = test_utils.get_name_node(ast['ErudiEntitySchema']['meth'], 'kwargs')
        self.assertEqual([n.__class__ for n in arg.infer()],
                         [nodes.Dict])

    def test_tuple_then_list(self):
        code = '''
            def test_view(rql, vid, tags=()):
                tags = list(tags)
                __(tags).append(vid)
        '''
        name = extract_node(code, __name__)
        it = name.infer()
        tags = next(it)
        self.assertIsInstance(tags, nodes.List)
        self.assertEqual(tags.elts, [])
        with self.assertRaises(StopIteration):
            next(it)

    def test_mulassign_inference(self):
        code = '''
            def first_word(line):
                """Return the first word of a line"""

                return line.split()[0]

            def last_word(line):
                """Return last word of a line"""

                return line.split()[-1]

            def process_line(word_pos):
                """Silly function: returns (ok, callable) based on argument.

                   For test purpose only.
                """

                if word_pos > 0:
                    return (True, first_word)
                elif word_pos < 0:
                    return  (True, last_word)
                else:
                    return (False, None)

            if __name__ == '__main__':

                line_number = 0
                for a_line in file('test_callable.py'):
                    tupletest  = process_line(line_number)
                    (ok, fct)  = process_line(line_number)
                    if ok:
                        fct(a_line)
        '''
        ast = parse(code, __name__)
        self.assertEqual(len(list(ast['process_line'].infer_call_result(None))), 3)
        self.assertEqual(len(list(ast['tupletest'].infer())), 3)
        values = ['<FunctionDef.first_word', '<FunctionDef.last_word',
                  '<Const.NoneType']
        self.assertTrue(all(repr(inferred).startswith(value) for inferred, value
                            in zip(ast['fct'].infer(), values)))

    def test_float_complex_ambiguity(self):
        code = '''
            def no_conjugate_member(magic_flag):  #@
                """should not raise E1101 on something.conjugate"""
                if magic_flag:
                    something = 1.0
                else:
                    something = 1.0j
                if isinstance(something, float):
                    return something
                return __(something).conjugate()
        '''
        func, retval = extract_node(code, __name__)
        self.assertEqual(
            [i.value for i in func.ilookup('something')],
            [1.0, 1.0j])
        self.assertEqual(
            [i.value for i in retval.infer()],
            [1.0, 1.0j])

    def test_lookup_cond_branches(self):
        code = '''
            def no_conjugate_member(magic_flag):
                """should not raise E1101 on something.conjugate"""
                something = 1.0
                if magic_flag:
                    something = 1.0j
                return something.conjugate()
        '''
        ast = parse(code, __name__)
        values = [i.value for i in test_utils.get_name_node(ast, 'something', -1).infer()]
        self.assertEqual(values, [1.0, 1.0j])


    def test_simple_subscript(self):
        code = '''
            class A(object):
                def __getitem__(self, index):
                    return index + 42
            [1, 2, 3][0] #@
            (1, 2, 3)[1] #@
            (1, 2, 3)[-1] #@
            [1, 2, 3][0] + (2, )[0] + (3, )[-1] #@
            e = {'key': 'value'}
            e['key'] #@
            "first"[0] #@
            list([1, 2, 3])[-1] #@
            tuple((4, 5, 6))[2] #@
            A()[0] #@
            A()[-1] #@
        '''
        ast_nodes = extract_node(code, __name__)
        expected = [1, 2, 3, 6, 'value', 'f', 3, 6, 42, 41]
        for node, expected_value in zip(ast_nodes, expected):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, expected_value)

    def test_invalid_subscripts(self):
        ast_nodes = extract_node('''
        class NoGetitem(object):
            pass
        class InvalidGetitem(object):
            def __getitem__(self): pass
        class InvalidGetitem2(object):
            __getitem__ = 42
        NoGetitem()[4] #@
        InvalidGetitem()[5] #@
        InvalidGetitem2()[10] #@
        ''')
        for node in ast_nodes[:3]:
            self.assertRaises(InferenceError, next, node.infer())
        for node in ast_nodes[3:]:
            self.assertEqual(next(node.infer()), util.Uninferable)
        ast_nodes = extract_node('''
        [1, 2, 3][None] #@
        'lala'['bala'] #@
        ''')
        for node in ast_nodes:
            self.assertRaises(InferenceError, next, node.infer())

    def test_bytes_subscript(self):
        node = extract_node('''b'a'[0]''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        if six.PY2:
            self.assertEqual(inferred.value, 'a')
        else:
            self.assertEqual(inferred.value, 97)

    def test_simple_tuple(self):
        module = parse("""
        a = (1,)
        b = (22,)
        some = a + b #@
        """)
        ast = next(module['some'].infer())
        self.assertIsInstance(ast, nodes.Tuple)
        self.assertEqual(len(ast.elts), 2)
        self.assertEqual(ast.elts[0].value, 1)
        self.assertEqual(ast.elts[1].value, 22)

    def test_simple_for(self):
        code = '''
            for a in [1, 2, 3]:
                print (a)
            for b,c in [(1,2), (3,4)]:
                print (b)
                print (c)

            print ([(d,e) for e,d in ([1,2], [3,4])])
        '''
        ast = parse(code, __name__)
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'a', -1).infer()], [1, 2, 3])
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'b', -1).infer()], [1, 3])
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'c', -1).infer()], [2, 4])
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'd', -1).infer()], [2, 4])
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'e', -1).infer()], [1, 3])

    def test_simple_for_genexpr(self):
        code = '''
            print ((d,e) for e,d in ([1,2], [3,4]))
        '''
        ast = parse(code, __name__)
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'd', -1).infer()], [2, 4])
        self.assertEqual([i.value for i in
                          test_utils.get_name_node(ast, 'e', -1).infer()], [1, 3])


    def test_builtin_help(self):
        code = '''
            help()
        '''
        # XXX failing since __builtin__.help assignment has
        #     been moved into a function...
        node = extract_node(code, __name__)
        inferred = list(node.func.infer())
        self.assertEqual(len(inferred), 1, inferred)
        self.assertIsInstance(inferred[0], Instance)
        self.assertEqual(inferred[0].name, "_Helper")

    def test_builtin_open(self):
        code = '''
            open("toto.txt")
        '''
        node = extract_node(code, __name__).func
        inferred = list(node.infer())
        self.assertEqual(len(inferred), 1)
        if hasattr(sys, 'pypy_version_info'):
            self.assertIsInstance(inferred[0], nodes.ClassDef)
            self.assertEqual(inferred[0].name, 'file')
        else:
            self.assertIsInstance(inferred[0], nodes.FunctionDef)
            self.assertEqual(inferred[0].name, 'open')

    if os.name == 'java':
        test_builtin_open = unittest.expectedFailure(test_builtin_open)

    def test_callfunc_context_func(self):
        code = '''
            def mirror(arg=None):
                return arg

            un = mirror(1)
        '''
        ast = parse(code, __name__)
        inferred = list(ast.igetattr('un'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Const)
        self.assertEqual(inferred[0].value, 1)

    def test_callfunc_context_lambda(self):
        code = '''
            mirror = lambda x=None: x

            un = mirror(1)
        '''
        ast = parse(code, __name__)
        inferred = list(ast.igetattr('mirror'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Lambda)
        inferred = list(ast.igetattr('un'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Const)
        self.assertEqual(inferred[0].value, 1)

    def test_factory_method(self):
        code = '''
            class Super(object):
                  @classmethod
                  def instance(cls):
                          return cls()

            class Sub(Super):
                  def method(self):
                          print ('method called')

            sub = Sub.instance()
        '''
        ast = parse(code, __name__)
        inferred = list(ast.igetattr('sub'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], Instance)
        self.assertEqual(inferred[0]._proxied.name, 'Sub')


    def test_import_as(self):
        code = '''
            import os.path as osp
            print (osp.dirname(__file__))

            from os.path import exists as e
            assert e(__file__)
        '''
        ast = parse(code, __name__)
        inferred = list(ast.igetattr('osp'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Module)
        self.assertEqual(inferred[0].name, 'os.path')
        inferred = list(ast.igetattr('e'))
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.FunctionDef)
        self.assertEqual(inferred[0].name, 'exists')

    def _test_const_inferred(self, node, value):
        inferred = list(node.infer())
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Const)
        self.assertEqual(inferred[0].value, value)

    def test_unary_not(self):
        for code in ('a = not (1,); b = not ()',
                     'a = not {1:2}; b = not {}',
                     'a = not [1, 2]; b = not []',
                     'a = not {1, 2}; b = not set()',
                     'a = not 1; b = not 0',
                     'a = not "a"; b = not ""',
                     'a = not b"a"; b = not b""'):
            ast = builder.string_build(code, __name__, __file__)
            self._test_const_inferred(ast['a'], False)
            self._test_const_inferred(ast['b'], True)

    def test_unary_op_numbers(self):
        ast_nodes = extract_node('''
        +1 #@
        -1 #@
        ~1 #@
        +2.0 #@
        -2.0 #@
        ''')
        expected = [1, -1, -2, 2.0, -2.0]
        for node, expected_value in zip(ast_nodes, expected):
            inferred = next(node.infer())
            self.assertEqual(inferred.value, expected_value)

    @test_utils.require_version(minver='3.5')
    def test_matmul(self):
        node = extract_node('''
        class Array:
            def __matmul__(self, other):
                return 42
        Array() @ Array() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_binary_op_int_add(self):
        ast = builder.string_build('a = 1 + 2', __name__, __file__)
        self._test_const_inferred(ast['a'], 3)

    def test_binary_op_int_sub(self):
        ast = builder.string_build('a = 1 - 2', __name__, __file__)
        self._test_const_inferred(ast['a'], -1)

    def test_binary_op_float_div(self):
        ast = builder.string_build('a = 1 / 2.', __name__, __file__)
        self._test_const_inferred(ast['a'], 1 / 2.)

    def test_binary_op_str_mul(self):
        ast = builder.string_build('a = "*" * 40', __name__, __file__)
        self._test_const_inferred(ast['a'], "*" * 40)

    def test_binary_op_int_bitand(self):
        ast = builder.string_build('a = 23&20', __name__, __file__)
        self._test_const_inferred(ast['a'], 23&20)

    def test_binary_op_int_bitor(self):
        ast = builder.string_build('a = 23|8', __name__, __file__)
        self._test_const_inferred(ast['a'], 23|8)

    def test_binary_op_int_bitxor(self):
        ast = builder.string_build('a = 23^9', __name__, __file__)
        self._test_const_inferred(ast['a'], 23^9)

    def test_binary_op_int_shiftright(self):
        ast = builder.string_build('a = 23 >>1', __name__, __file__)
        self._test_const_inferred(ast['a'], 23>>1)

    def test_binary_op_int_shiftleft(self):
        ast = builder.string_build('a = 23 <<1', __name__, __file__)
        self._test_const_inferred(ast['a'], 23<<1)

    def test_binary_op_other_type(self):
        ast_nodes = extract_node('''
        class A:
            def __add__(self, other):
                return other + 42
        A() + 1 #@
        1 + A() #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, nodes.Const)
        self.assertEqual(first.value, 43)

        second = next(ast_nodes[1].infer())
        self.assertEqual(second, util.Uninferable)

    def test_binary_op_other_type_using_reflected_operands(self):
        ast_nodes = extract_node('''
        class A(object):
            def __radd__(self, other):
                return other + 42
        A() + 1 #@
        1 + A() #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertEqual(first, util.Uninferable)

        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, nodes.Const)
        self.assertEqual(second.value, 43)

    def test_binary_op_reflected_and_not_implemented_is_type_error(self):
        ast_node = extract_node('''
        class A(object):
            def __radd__(self, other): return NotImplemented

        1 + A() #@
        ''')
        first = next(ast_node.infer())
        self.assertEqual(first, util.Uninferable)

    def test_binary_op_list_mul(self):
        for code in ('a = [[]] * 2', 'a = 2 * [[]]'):
            ast = builder.string_build(code, __name__, __file__)
            inferred = list(ast['a'].infer())
            self.assertEqual(len(inferred), 1)
            self.assertIsInstance(inferred[0], nodes.List)
            self.assertEqual(len(inferred[0].elts), 2)
            self.assertIsInstance(inferred[0].elts[0], nodes.List)
            self.assertIsInstance(inferred[0].elts[1], nodes.List)

    def test_binary_op_list_mul_none(self):
        'test correct handling on list multiplied by None'
        ast = builder.string_build('a = [1] * None\nb = [1] * "r"')
        inferred = ast['a'].inferred()
        self.assertEqual(len(inferred), 1)
        self.assertEqual(inferred[0], util.Uninferable)
        inferred = ast['b'].inferred()
        self.assertEqual(len(inferred), 1)
        self.assertEqual(inferred[0], util.Uninferable)

    def test_binary_op_list_mul_int(self):
        'test correct handling on list multiplied by int when there are more than one'
        code = '''
        from ctypes import c_int
        seq = [c_int()] * 4
        '''
        ast = parse(code, __name__)
        inferred = ast['seq'].inferred()
        self.assertEqual(len(inferred), 1)
        listval = inferred[0]
        self.assertIsInstance(listval, nodes.List)
        self.assertEqual(len(listval.itered()), 4)

    def test_binary_op_on_self(self):
        'test correct handling of applying binary operator to self'
        code = '''
        import sys
        sys.path = ['foo'] + sys.path
        sys.path.insert(0, 'bar')
        path = sys.path
        '''
        ast = parse(code, __name__)
        inferred = ast['path'].inferred()
        self.assertIsInstance(inferred[0], nodes.List)

    def test_binary_op_tuple_add(self):
        ast = builder.string_build('a = (1,) + (2,)', __name__, __file__)
        inferred = list(ast['a'].infer())
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Tuple)
        self.assertEqual(len(inferred[0].elts), 2)
        self.assertEqual(inferred[0].elts[0].value, 1)
        self.assertEqual(inferred[0].elts[1].value, 2)

    def test_binary_op_custom_class(self):
        code = '''
        class myarray:
            def __init__(self, array):
                self.array = array
            def __mul__(self, x):
                return myarray([2,4,6])
            def astype(self):
                return "ASTYPE"

        def randint(maximum):
            if maximum is not None:
                return myarray([1,2,3]) * 2
            else:
                return int(5)

        x = randint(1)
        '''
        ast = parse(code, __name__)
        inferred = list(ast.igetattr('x'))
        self.assertEqual(len(inferred), 2)
        value = [str(v) for v in inferred]
        # The __name__ trick here makes it work when invoked directly
        # (__name__ == '__main__') and through pytest (__name__ ==
        # 'unittest_inference')
        self.assertEqual(value, ['Instance of %s.myarray' % __name__,
                                 'Instance of %s.int' % BUILTINS])

    def test_nonregr_lambda_arg(self):
        code = '''
        def f(g = lambda: None):
                __(g()).x
'''
        callfuncnode = extract_node(code)
        inferred = list(callfuncnode.infer())
        self.assertEqual(len(inferred), 2, inferred)
        inferred.remove(util.Uninferable)
        self.assertIsInstance(inferred[0], nodes.Const)
        self.assertIsNone(inferred[0].value)

    def test_nonregr_getitem_empty_tuple(self):
        code = '''
            def f(x):
                a = ()[x]
        '''
        ast = parse(code, __name__)
        inferred = list(ast['f'].ilookup('a'))
        self.assertEqual(len(inferred), 1)
        self.assertEqual(inferred[0], util.Uninferable)

    def test_nonregr_instance_attrs(self):
        """non regression for instance_attrs infinite loop : pylint / #4"""

        code = """
            class Foo(object):

                def set_42(self):
                    self.attr = 42

            class Bar(Foo):

                def __init__(self):
                    self.attr = 41
        """
        ast = parse(code, __name__)
        foo_class = ast['Foo']
        bar_class = ast['Bar']
        bar_self = ast['Bar']['__init__']['self']
        assattr = bar_class.instance_attrs['attr'][0]
        self.assertEqual(len(foo_class.instance_attrs['attr']), 1)
        self.assertEqual(len(bar_class.instance_attrs['attr']), 1)
        self.assertEqual(bar_class.instance_attrs, {'attr': [assattr]})
        # call 'instance_attr' via 'Instance.getattr' to trigger the bug:
        instance = bar_self.inferred()[0]
        instance.getattr('attr')
        self.assertEqual(len(bar_class.instance_attrs['attr']), 1)
        self.assertEqual(len(foo_class.instance_attrs['attr']), 1)
        self.assertEqual(bar_class.instance_attrs, {'attr': [assattr]})

    def test_python25_no_relative_import(self):
        ast = resources.build_file('data/package/absimport.py')
        self.assertTrue(ast.absolute_import_activated(), True)
        inferred = next(test_utils.get_name_node(ast, 'import_package_subpackage_module').infer())
        # failed to import since absolute_import is activated
        self.assertIs(inferred, util.Uninferable)

    def test_nonregr_absolute_import(self):
        ast = resources.build_file('data/absimp/string.py', 'data.absimp.string')
        self.assertTrue(ast.absolute_import_activated(), True)
        inferred = next(test_utils.get_name_node(ast, 'string').infer())
        self.assertIsInstance(inferred, nodes.Module)
        self.assertEqual(inferred.name, 'string')
        self.assertIn('ascii_letters', inferred.locals)

    def test_mechanize_open(self):
        try:
            import mechanize  # pylint: disable=unused-variable
        except ImportError:
            self.skipTest('require mechanize installed')
        data = '''
            from mechanize import Browser
            print(Browser)
            b = Browser()
        '''
        ast = parse(data, __name__)
        browser = next(test_utils.get_name_node(ast, 'Browser').infer())
        self.assertIsInstance(browser, nodes.ClassDef)
        bopen = list(browser.igetattr('open'))
        self.skipTest('the commit said: "huum, see that later"')
        self.assertEqual(len(bopen), 1)
        self.assertIsInstance(bopen[0], nodes.FunctionDef)
        self.assertTrue(bopen[0].callable())
        b = next(test_utils.get_name_node(ast, 'b').infer())
        self.assertIsInstance(b, Instance)
        bopen = list(b.igetattr('open'))
        self.assertEqual(len(bopen), 1)
        self.assertIsInstance(bopen[0], BoundMethod)
        self.assertTrue(bopen[0].callable())

    def test_property(self):
        code = '''
            from smtplib import SMTP
            class SendMailController(object):

                @property
                def smtp(self):
                    return SMTP(mailhost, port)

                @property
                def me(self):
                    return self

            my_smtp = SendMailController().smtp
            my_me = SendMailController().me
            '''
        decorators = set(['%s.property' % BUILTINS])
        ast = parse(code, __name__)
        self.assertEqual(ast['SendMailController']['smtp'].decoratornames(),
                         decorators)
        propinferred = list(ast.body[2].value.infer())
        self.assertEqual(len(propinferred), 1)
        propinferred = propinferred[0]
        self.assertIsInstance(propinferred, Instance)
        self.assertEqual(propinferred.name, 'SMTP')
        self.assertEqual(propinferred.root().name, 'smtplib')
        self.assertEqual(ast['SendMailController']['me'].decoratornames(),
                         decorators)
        propinferred = list(ast.body[3].value.infer())
        self.assertEqual(len(propinferred), 1)
        propinferred = propinferred[0]
        self.assertIsInstance(propinferred, Instance)
        self.assertEqual(propinferred.name, 'SendMailController')
        self.assertEqual(propinferred.root().name, __name__)

    def test_im_func_unwrap(self):
        code = '''
            class EnvBasedTC:
                def pactions(self):
                    pass
            pactions = EnvBasedTC.pactions.im_func
            print (pactions)

            class EnvBasedTC2:
                pactions = EnvBasedTC.pactions.im_func
                print (pactions)
            '''
        ast = parse(code, __name__)
        pactions = test_utils.get_name_node(ast, 'pactions')
        inferred = list(pactions.infer())
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.FunctionDef)
        pactions = test_utils.get_name_node(ast['EnvBasedTC2'], 'pactions')
        inferred = list(pactions.infer())
        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.FunctionDef)

    def test_augassign(self):
        code = '''
            a = 1
            a += 2
            print (a)
        '''
        ast = parse(code, __name__)
        inferred = list(test_utils.get_name_node(ast, 'a').infer())

        self.assertEqual(len(inferred), 1)
        self.assertIsInstance(inferred[0], nodes.Const)
        self.assertEqual(inferred[0].value, 3)

    def test_nonregr_func_arg(self):
        code = '''
            def foo(self, bar):
                def baz():
                    pass
                def qux():
                    return baz
                spam = bar(None, qux)
                print (spam)
            '''
        ast = parse(code, __name__)
        inferred = list(test_utils.get_name_node(ast['foo'], 'spam').infer())
        self.assertEqual(len(inferred), 1)
        self.assertIs(inferred[0], util.Uninferable)

    def test_nonregr_func_global(self):
        code = '''
            active_application = None

            def get_active_application():
              global active_application
              return active_application

            class Application(object):
              def __init__(self):
                 global active_application
                 active_application = self

            class DataManager(object):
              def __init__(self, app=None):
                 self.app = get_active_application()
              def test(self):
                 p = self.app
                 print (p)
        '''
        ast = parse(code, __name__)
        inferred = list(Instance(ast['DataManager']).igetattr('app'))
        self.assertEqual(len(inferred), 2, inferred) # None / Instance(Application)
        inferred = list(test_utils.get_name_node(ast['DataManager']['test'], 'p').infer())
        self.assertEqual(len(inferred), 2, inferred)
        for node in inferred:
            if isinstance(node, Instance) and node.name == 'Application':
                break
        else:
            self.fail('expected to find an instance of Application in %s' % inferred)

    def test_list_inference(self):
        """#20464"""
        code = '''
            from unknown import Unknown
            A = []
            B = []

            def test():
              xyz = [
                Unknown
              ] + A + B
              return xyz

            Z = test()
        '''
        ast = parse(code, __name__)
        inferred = next(ast['Z'].infer())
        self.assertIsInstance(inferred, nodes.List)
        self.assertEqual(len(inferred.elts), 1)
        self.assertIsInstance(inferred.elts[0], nodes.Unknown)

    def test__new__(self):
        code = '''
            class NewTest(object):
                "doc"
                def __new__(cls, arg):
                    self = object.__new__(cls)
                    self.arg = arg
                    return self

            n = NewTest()
        '''
        ast = parse(code, __name__)
        self.assertRaises(InferenceError, list, ast['NewTest'].igetattr('arg'))
        n = next(ast['n'].infer())
        inferred = list(n.igetattr('arg'))
        self.assertEqual(len(inferred), 1, inferred)

    def test__new__bound_methods(self):
        node = extract_node('''
        class cls(object): pass
        cls().__new__(cls) #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred._proxied, node.root()['cls'])

    def test_two_parents_from_same_module(self):
        code = '''
            from data import nonregr
            class Xxx(nonregr.Aaa, nonregr.Ccc):
                "doc"
        '''
        ast = parse(code, __name__)
        parents = list(ast['Xxx'].ancestors())
        self.assertEqual(len(parents), 3, parents) # Aaa, Ccc, object

    def test_pluggable_inference(self):
        code = '''
            from collections import namedtuple
            A = namedtuple('A', ['a', 'b'])
            B = namedtuple('B', 'a b')
        '''
        ast = parse(code, __name__)
        aclass = ast['A'].inferred()[0]
        self.assertIsInstance(aclass, nodes.ClassDef)
        self.assertIn('a', aclass.instance_attrs)
        self.assertIn('b', aclass.instance_attrs)
        bclass = ast['B'].inferred()[0]
        self.assertIsInstance(bclass, nodes.ClassDef)
        self.assertIn('a', bclass.instance_attrs)
        self.assertIn('b', bclass.instance_attrs)

    def test_infer_arguments(self):
        code = '''
            class A(object):
                def first(self, arg1, arg2):
                    return arg1
                @classmethod
                def method(cls, arg1, arg2):
                    return arg2
                @classmethod
                def empty(cls):
                    return 2
                @staticmethod
                def static(arg1, arg2):
                    return arg1
                def empty_method(self):
                    return []
            x = A().first(1, [])
            y = A.method(1, [])
            z = A.static(1, [])
            empty = A.empty()
            empty_list = A().empty_method()
        '''
        ast = parse(code, __name__)
        int_node = ast['x'].inferred()[0]
        self.assertIsInstance(int_node, nodes.Const)
        self.assertEqual(int_node.value, 1)
        list_node = ast['y'].inferred()[0]
        self.assertIsInstance(list_node, nodes.List)
        int_node = ast['z'].inferred()[0]
        self.assertIsInstance(int_node, nodes.Const)
        self.assertEqual(int_node.value, 1)
        empty = ast['empty'].inferred()[0]
        self.assertIsInstance(empty, nodes.Const)
        self.assertEqual(empty.value, 2)
        empty_list = ast['empty_list'].inferred()[0]
        self.assertIsInstance(empty_list, nodes.List)

    def test_infer_variable_arguments(self):
        code = '''
            def test(*args, **kwargs):
                vararg = args
                kwarg = kwargs
        '''
        ast = parse(code, __name__)
        func = ast['test']
        vararg = func.body[0].value
        kwarg = func.body[1].value

        kwarg_inferred = kwarg.inferred()[0]
        self.assertIsInstance(kwarg_inferred, nodes.Dict)
        self.assertIs(kwarg_inferred.parent, func.args)

        vararg_inferred = vararg.inferred()[0]
        self.assertIsInstance(vararg_inferred, nodes.Tuple)
        self.assertIs(vararg_inferred.parent, func.args)

    def test_infer_nested(self):
        code = """
            def nested():
                from threading import Thread

                class NestedThread(Thread):
                    def __init__(self):
                        Thread.__init__(self)
        """
        # Test that inferring Thread.__init__ looks up in
        # the nested scope.
        ast = parse(code, __name__)
        callfunc = next(ast.nodes_of_class(nodes.Call))
        func = callfunc.func
        inferred = func.inferred()[0]
        self.assertIsInstance(inferred, UnboundMethod)

    def test_instance_binary_operations(self):
        code = """
            class A(object):
                def __mul__(self, other):
                    return 42
            a = A()
            b = A()
            sub = a - b
            mul = a * b
        """
        ast = parse(code, __name__)
        sub = ast['sub'].inferred()[0]
        mul = ast['mul'].inferred()[0]
        self.assertIs(sub, util.Uninferable)
        self.assertIsInstance(mul, nodes.Const)
        self.assertEqual(mul.value, 42)

    def test_instance_binary_operations_parent(self):
        code = """
            class A(object):
                def __mul__(self, other):
                    return 42
            class B(A):
                pass
            a = B()
            b = B()
            sub = a - b
            mul = a * b
        """
        ast = parse(code, __name__)
        sub = ast['sub'].inferred()[0]
        mul = ast['mul'].inferred()[0]
        self.assertIs(sub, util. Uninferable)
        self.assertIsInstance(mul, nodes.Const)
        self.assertEqual(mul.value, 42)

    def test_instance_binary_operations_multiple_methods(self):
        code = """
            class A(object):
                def __mul__(self, other):
                    return 42
            class B(A):
                def __mul__(self, other):
                    return [42]
            a = B()
            b = B()
            sub = a - b
            mul = a * b
        """
        ast = parse(code, __name__)
        sub = ast['sub'].inferred()[0]
        mul = ast['mul'].inferred()[0]
        self.assertIs(sub, util.Uninferable)
        self.assertIsInstance(mul, nodes.List)
        self.assertIsInstance(mul.elts[0], nodes.Const)
        self.assertEqual(mul.elts[0].value, 42)

    def test_infer_call_result_crash(self):
        code = """
            class A(object):
                def __mul__(self, other):
                    return type.__new__()

            a = A()
            b = A()
            c = a * b
        """
        ast = parse(code, __name__)
        node = ast['c']
        self.assertEqual(node.inferred(), [util.Uninferable])

    def test_infer_empty_nodes(self):
        # Should not crash when trying to infer EmptyNodes.
        node = nodes.EmptyNode()
        self.assertEqual(node.inferred(), [util.Uninferable])

    def test_infinite_loop_for_decorators(self):
        # Issue https://bitbucket.org/logilab/astroid/issue/50
        # A decorator that returns itself leads to an infinite loop.
        code = """
            def decorator():
                def wrapper():
                    return decorator()
                return wrapper

            @decorator()
            def do_a_thing():
                pass
        """
        ast = parse(code, __name__)
        node = ast['do_a_thing']
        self.assertEqual(node.type, 'function')

    def test_no_infinite_ancestor_loop(self):
        klass = extract_node("""
            import datetime

            def method(self):
                datetime.datetime = something()

            class something(datetime.datetime):  #@
                pass
        """)
        self.assertIn(
            'object',
            [base.name for base in klass.ancestors()])

    def test_stop_iteration_leak(self):
        code = """
            class Test:
                def __init__(self):
                    self.config = {0: self.config[0]}
                    self.config[0].test() #@
        """
        ast = extract_node(code, __name__)
        expr = ast.func.expr
        self.assertRaises(InferenceError, next, expr.infer())

    def test_tuple_builtin_inference(self):
        code = """
        var = (1, 2)
        tuple() #@
        tuple([1]) #@
        tuple({2}) #@
        tuple("abc") #@
        tuple({1: 2}) #@
        tuple(var) #@
        tuple(tuple([1])) #@
        tuple(frozenset((1, 2))) #@

        tuple(None) #@
        tuple(1) #@
        tuple(1, 2) #@
        """
        ast = extract_node(code, __name__)

        self.assertInferTuple(ast[0], [])
        self.assertInferTuple(ast[1], [1])
        self.assertInferTuple(ast[2], [2])
        self.assertInferTuple(ast[3], ["a", "b", "c"])
        self.assertInferTuple(ast[4], [1])
        self.assertInferTuple(ast[5], [1, 2])
        self.assertInferTuple(ast[6], [1])
        self.assertInferTuple(ast[7], [1, 2])

        for node in ast[8:]:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.tuple".format(BUILTINS))

    @test_utils.require_version('3.5')
    def test_starred_in_tuple_literal(self):
        code = """
        var = (1, 2, 3)
        bar = (5, 6, 7)
        foo = [999, 1000, 1001]
        (0, *var) #@
        (0, *var, 4) #@
        (0, *var, 4, *bar) #@
        (0, *var, 4, *(*bar, 8)) #@
        (0, *var, 4, *(*bar, *foo)) #@
        """
        ast = extract_node(code, __name__)
        self.assertInferTuple(ast[0], [0, 1, 2, 3])
        self.assertInferTuple(ast[1], [0, 1, 2, 3, 4])
        self.assertInferTuple(ast[2], [0, 1, 2, 3, 4, 5, 6, 7])
        self.assertInferTuple(ast[3], [0, 1, 2, 3, 4, 5, 6, 7, 8])
        self.assertInferTuple(ast[4], [0, 1, 2, 3, 4, 5, 6, 7, 999, 1000, 1001])

    @test_utils.require_version('3.5')
    def test_starred_in_list_literal(self):
        code = """
        var = (1, 2, 3)
        bar = (5, 6, 7)
        foo = [999, 1000, 1001]
        [0, *var] #@
        [0, *var, 4] #@
        [0, *var, 4, *bar] #@
        [0, *var, 4, *[*bar, 8]] #@
        [0, *var, 4, *[*bar, *foo]] #@
        """
        ast = extract_node(code, __name__)
        self.assertInferList(ast[0], [0, 1, 2, 3])
        self.assertInferList(ast[1], [0, 1, 2, 3, 4])
        self.assertInferList(ast[2], [0, 1, 2, 3, 4, 5, 6, 7])
        self.assertInferList(ast[3], [0, 1, 2, 3, 4, 5, 6, 7, 8])
        self.assertInferList(ast[4], [0, 1, 2, 3, 4, 5, 6, 7, 999, 1000, 1001])

    @test_utils.require_version('3.5')
    def test_starred_in_set_literal(self):
        code = """
        var = (1, 2, 3)
        bar = (5, 6, 7)
        foo = [999, 1000, 1001]
        {0, *var} #@
        {0, *var, 4} #@
        {0, *var, 4, *bar} #@
        {0, *var, 4, *{*bar, 8}} #@
        {0, *var, 4, *{*bar, *foo}} #@
        """
        ast = extract_node(code, __name__)
        self.assertInferSet(ast[0], [0, 1, 2, 3])
        self.assertInferSet(ast[1], [0, 1, 2, 3, 4])
        self.assertInferSet(ast[2], [0, 1, 2, 3, 4, 5, 6, 7])
        self.assertInferSet(ast[3], [0, 1, 2, 3, 4, 5, 6, 7, 8])
        self.assertInferSet(ast[4], [0, 1, 2, 3, 4, 5, 6, 7, 999, 1000, 1001])

    @test_utils.require_version('3.5')
    def test_starred_in_literals_inference_issues(self):
        code = """
        {0, *var} #@
        {0, *var, 4} #@
        {0, *var, 4, *bar} #@
        {0, *var, 4, *{*bar, 8}} #@
        {0, *var, 4, *{*bar, *foo}} #@
        """
        ast = extract_node(code, __name__)
        for node in ast:
            with self.assertRaises(InferenceError):
                next(node.infer())

    @test_utils.require_version('3.5')
    def test_starred_in_mapping_literal(self):
        code = """
        var = {1: 'b', 2: 'c'}
        bar = {4: 'e', 5: 'f'}
        {0: 'a', **var} #@
        {0: 'a', **var, 3: 'd'} #@
        {0: 'a', **var, 3: 'd', **{**bar, 6: 'g'}} #@
        """
        ast = extract_node(code, __name__)
        self.assertInferDict(ast[0], {0: 'a', 1: 'b', 2: 'c'})
        self.assertInferDict(ast[1], {0: 'a', 1: 'b', 2: 'c', 3: 'd'})
        self.assertInferDict(ast[2], {0: 'a', 1: 'b', 2: 'c', 3: 'd',
                                      4: 'e', 5: 'f', 6: 'g'})

    @test_utils.require_version('3.5')
    def test_starred_in_mapping_inference_issues(self):
        code = """
        {0: 'a', **var} #@
        {0: 'a', **var, 3: 'd'} #@
        {0: 'a', **var, 3: 'd', **{**bar, 6: 'g'}} #@
        """
        ast = extract_node(code, __name__)
        for node in ast:
            with self.assertRaises(InferenceError):
                next(node.infer())

    @test_utils.require_version('3.5')
    def test_starred_in_mapping_literal_non_const_keys_values(self):
        code = """
        a, b, c, d, e, f, g, h, i, j = "ABCDEFGHIJ"
        var = {c: d, e: f}
        bar = {i: j}
        {a: b, **var} #@
        {a: b, **var, **{g: h, **bar}} #@
        """
        ast = extract_node(code, __name__)
        self.assertInferDict(ast[0], {"A": "B", "C": "D", "E": "F"})
        self.assertInferDict(ast[1], {"A": "B", "C": "D", "E": "F", "G": "H", "I": "J"})

    def test_frozenset_builtin_inference(self):
        code = """
        var = (1, 2)
        frozenset() #@
        frozenset([1, 2, 1]) #@
        frozenset({2, 3, 1}) #@
        frozenset("abcab") #@
        frozenset({1: 2}) #@
        frozenset(var) #@
        frozenset(tuple([1])) #@

        frozenset(set(tuple([4, 5, set([2])]))) #@
        frozenset(None) #@
        frozenset(1) #@
        frozenset(1, 2) #@
        """
        ast = extract_node(code, __name__)

        self.assertInferFrozenSet(ast[0], [])
        self.assertInferFrozenSet(ast[1], [1, 2])
        self.assertInferFrozenSet(ast[2], [1, 2, 3])
        self.assertInferFrozenSet(ast[3], ["a", "b", "c"])
        self.assertInferFrozenSet(ast[4], [1])
        self.assertInferFrozenSet(ast[5], [1, 2])
        self.assertInferFrozenSet(ast[6], [1])

        for node in ast[7:]:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.frozenset".format(BUILTINS))

    def test_set_builtin_inference(self):
        code = """
        var = (1, 2)
        set() #@
        set([1, 2, 1]) #@
        set({2, 3, 1}) #@
        set("abcab") #@
        set({1: 2}) #@
        set(var) #@
        set(tuple([1])) #@

        set(set(tuple([4, 5, set([2])]))) #@
        set(None) #@
        set(1) #@
        set(1, 2) #@
        """
        ast = extract_node(code, __name__)

        self.assertInferSet(ast[0], [])
        self.assertInferSet(ast[1], [1, 2])
        self.assertInferSet(ast[2], [1, 2, 3])
        self.assertInferSet(ast[3], ["a", "b", "c"])
        self.assertInferSet(ast[4], [1])
        self.assertInferSet(ast[5], [1, 2])
        self.assertInferSet(ast[6], [1])

        for node in ast[7:]:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.set".format(BUILTINS))

    def test_list_builtin_inference(self):
        code = """
        var = (1, 2)
        list() #@
        list([1, 2, 1]) #@
        list({2, 3, 1}) #@
        list("abcab") #@
        list({1: 2}) #@
        list(var) #@
        list(tuple([1])) #@

        list(list(tuple([4, 5, list([2])]))) #@
        list(None) #@
        list(1) #@
        list(1, 2) #@
        """
        ast = extract_node(code, __name__)
        self.assertInferList(ast[0], [])
        self.assertInferList(ast[1], [1, 1, 2])
        self.assertInferList(ast[2], [1, 2, 3])
        self.assertInferList(ast[3], ["a", "a", "b", "b", "c"])
        self.assertInferList(ast[4], [1])
        self.assertInferList(ast[5], [1, 2])
        self.assertInferList(ast[6], [1])

        for node in ast[7:]:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.list".format(BUILTINS))

    def test_conversion_of_dict_methods(self):
        ast_nodes = extract_node('''
        list({1:2, 2:3}.values()) #@
        list({1:2, 2:3}.keys()) #@
        tuple({1:2, 2:3}.values()) #@
        tuple({1:2, 3:4}.keys()) #@
        set({1:2, 2:4}.keys()) #@
        ''')
        self.assertInferList(ast_nodes[0], [2, 3])
        self.assertInferList(ast_nodes[1], [1, 2])
        self.assertInferTuple(ast_nodes[2], [2, 3])
        self.assertInferTuple(ast_nodes[3], [1, 3])
        self.assertInferSet(ast_nodes[4], [1, 2])

    @test_utils.require_version('3.0')
    def test_builtin_inference_py3k(self):
        code = """
        list(b"abc") #@
        tuple(b"abc") #@
        set(b"abc") #@
        """
        ast = extract_node(code, __name__)
        self.assertInferList(ast[0], [97, 98, 99])
        self.assertInferTuple(ast[1], [97, 98, 99])
        self.assertInferSet(ast[2], [97, 98, 99])

    def test_dict_inference(self):
        code = """
        dict() #@
        dict(a=1, b=2, c=3) #@
        dict([(1, 2), (2, 3)]) #@
        dict([[1, 2], [2, 3]]) #@
        dict([(1, 2), [2, 3]]) #@
        dict([('a', 2)], b=2, c=3) #@
        dict({1: 2}) #@
        dict({'c': 2}, a=4, b=5) #@
        def func():
            return dict(a=1, b=2)
        func() #@
        var = {'x': 2, 'y': 3}
        dict(var, a=1, b=2) #@

        dict([1, 2, 3]) #@
        dict([(1, 2), (1, 2, 3)]) #@
        dict({1: 2}, {1: 2}) #@
        dict({1: 2}, (1, 2)) #@
        dict({1: 2}, (1, 2), a=4) #@
        dict([(1, 2), ([4, 5], 2)]) #@
        dict([None,  None]) #@

        def using_unknown_kwargs(**kwargs):
            return dict(**kwargs)
        using_unknown_kwargs(a=1, b=2) #@
        """
        ast = extract_node(code, __name__)
        self.assertInferDict(ast[0], {})
        self.assertInferDict(ast[1], {'a': 1, 'b': 2, 'c': 3})
        for i in range(2, 5):
            self.assertInferDict(ast[i], {1: 2, 2: 3})
        self.assertInferDict(ast[5], {'a': 2, 'b': 2, 'c': 3})
        self.assertInferDict(ast[6], {1: 2})
        self.assertInferDict(ast[7], {'c': 2, 'a': 4, 'b': 5})
        self.assertInferDict(ast[8], {'a': 1, 'b': 2})
        self.assertInferDict(ast[9], {'x': 2, 'y': 3, 'a': 1, 'b': 2})

        for node in ast[10:]:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.dict".format(BUILTINS))

    def test_dict_inference_kwargs(self):
        ast_node = extract_node('''dict(a=1, b=2, **{'c': 3})''')
        self.assertInferDict(ast_node, {'a': 1, 'b': 2, 'c': 3})

    @test_utils.require_version('3.5')
    def test_dict_inference_for_multiple_starred(self):
        pairs = [
            ('dict(a=1, **{"b": 2}, **{"c":3})', {'a':1, 'b':2, 'c':3}),
            ('dict(a=1, **{"b": 2}, d=4, **{"c":3})', {'a':1, 'b':2, 'c':3, 'd':4}),
            ('dict({"a":1}, b=2, **{"c":3})', {'a':1, 'b':2, 'c':3}),
        ]
        for code, expected_value in pairs:
            node = extract_node(code)
            self.assertInferDict(node, expected_value)

    def test_dict_invalid_args(self):
        invalid_values = [
            'dict(*1)',
            'dict(**lala)',
            'dict(**[])',
        ]
        for invalid in invalid_values:
            ast_node = extract_node(invalid)
            inferred = next(ast_node.infer())
            self.assertIsInstance(inferred, Instance)
            self.assertEqual(inferred.qname(), "{}.dict".format(BUILTINS))

    def test_str_methods(self):
        code = """
        ' '.decode() #@

        ' '.encode() #@
        ' '.join('abcd') #@
        ' '.replace('a', 'b') #@
        ' '.format('a') #@
        ' '.capitalize() #@
        ' '.title() #@
        ' '.lower() #@
        ' '.upper() #@
        ' '.swapcase() #@
        ' '.strip() #@
        ' '.rstrip() #@
        ' '.lstrip() #@
        ' '.rjust() #@
        ' '.ljust() #@
        ' '.center() #@

        ' '.index() #@
        ' '.find() #@
        ' '.count() #@
        """
        ast = extract_node(code, __name__)
        self.assertInferConst(ast[0], u'')
        for i in range(1, 16):
            self.assertInferConst(ast[i], '')
        for i in range(16, 19):
            self.assertInferConst(ast[i], 0)

    def test_unicode_methods(self):
        code = """
        u' '.encode() #@

        u' '.decode() #@
        u' '.join('abcd') #@
        u' '.replace('a', 'b') #@
        u' '.format('a') #@
        u' '.capitalize() #@
        u' '.title() #@
        u' '.lower() #@
        u' '.upper() #@
        u' '.swapcase() #@
        u' '.strip() #@
        u' '.rstrip() #@
        u' '.lstrip() #@
        u' '.rjust() #@
        u' '.ljust() #@
        u' '.center() #@

        u' '.index() #@
        u' '.find() #@
        u' '.count() #@
        """
        ast = extract_node(code, __name__)
        self.assertInferConst(ast[0], '')
        for i in range(1, 16):
            self.assertInferConst(ast[i], u'')
        for i in range(16, 19):
            self.assertInferConst(ast[i], 0)

    def test_scope_lookup_same_attributes(self):
        code = '''
        import collections
        class Second(collections.Counter):
            def collections(self):
                return "second"

        '''
        ast = parse(code, __name__)
        bases = ast['Second'].bases[0]
        inferred = next(bases.infer())
        self.assertTrue(inferred)
        self.assertIsInstance(inferred, nodes.ClassDef)
        self.assertEqual(inferred.qname(), 'collections.Counter')

    def test_inferring_with_statement_failures(self):
        module = parse('''
        class NoEnter(object):
            pass
        class NoMethod(object):
            __enter__ = None
        class NoElts(object):
            def __enter__(self):
                return 42

        with NoEnter() as no_enter:
            pass
        with NoMethod() as no_method:
            pass
        with NoElts() as (no_elts, no_elts1):
            pass
        ''')
        self.assertRaises(InferenceError, next, module['no_enter'].infer())
        self.assertRaises(InferenceError, next, module['no_method'].infer())
        self.assertRaises(InferenceError, next, module['no_elts'].infer())

    def test_inferring_with_statement(self):
        module = parse('''
        class SelfContext(object):
            def __enter__(self):
                return self

        class OtherContext(object):
            def __enter__(self):
                return SelfContext()

        class MultipleReturns(object):
            def __enter__(self):
                return SelfContext(), OtherContext()

        class MultipleReturns2(object):
            def __enter__(self):
                return [1, [2, 3]]

        with SelfContext() as self_context:
            pass
        with OtherContext() as other_context:
            pass
        with MultipleReturns(), OtherContext() as multiple_with:
            pass
        with MultipleReturns2() as (stdout, (stderr, stdin)):
            pass
        ''')
        self_context = module['self_context']
        inferred = next(self_context.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'SelfContext')

        other_context = module['other_context']
        inferred = next(other_context.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'SelfContext')

        multiple_with = module['multiple_with']
        inferred = next(multiple_with.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'SelfContext')

        stdout = module['stdout']
        inferred = next(stdout.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 1)
        stderr = module['stderr']
        inferred = next(stderr.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 2)

    def test_inferring_with_contextlib_contextmanager(self):
        module = parse('''
        import contextlib
        from contextlib import contextmanager

        @contextlib.contextmanager
        def manager_none():
            try:
                yield
            finally:
                pass

        @contextlib.contextmanager
        def manager_something():
            try:
                yield 42
                yield 24 # This should be ignored.
            finally:
                pass

        @contextmanager
        def manager_multiple():
            with manager_none() as foo:
                with manager_something() as bar:
                    yield foo, bar

        with manager_none() as none:
            pass
        with manager_something() as something:
            pass
        with manager_multiple() as (first, second):
            pass
        ''')
        none = module['none']
        inferred = next(none.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertIsNone(inferred.value)

        something = module['something']
        inferred = something.inferred()
        self.assertEqual(len(inferred), 1)
        inferred = inferred[0]
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

        first, second = module['first'], module['second']
        first = next(first.infer())
        second = next(second.infer())
        self.assertIsInstance(first, nodes.Const)
        self.assertIsNone(first.value)
        self.assertIsInstance(second, nodes.Const)
        self.assertEqual(second.value, 42)

    def test_inferring_context_manager_skip_index_error(self):
        # Raise an InferenceError when having multiple 'as' bindings
        # from a context manager, but its result doesn't have those
        # indices. This is the case of contextlib.nested, where the
        # result is a list, which is mutated later on, so it's
        # undetected by astroid.
        module = parse('''
        class Manager(object):
            def __enter__(self):
                return []
        with Manager() as (a, b, c):
            pass
        ''')
        self.assertRaises(InferenceError, next, module['a'].infer())

    def test_inferring_context_manager_unpacking_inference_error(self):
        # https://github.com/PyCQA/pylint/issues/1463
        module = parse('''
        import contextlib

        @contextlib.contextmanager
        def _select_source(a=None):
            with _select_source() as result:
                yield result

        result = _select_source()
        with result as (a, b, c):
            pass
        ''')
        self.assertRaises(InferenceError, next, module['a'].infer())

    def test_inferring_with_contextlib_contextmanager_failures(self):
        module = parse('''
        from contextlib import contextmanager

        def no_decorators_mgr():
            yield
        @no_decorators_mgr
        def other_decorators_mgr():
            yield
        @contextmanager
        def no_yield_mgr():
            pass

        with no_decorators_mgr() as no_decorators:
            pass
        with other_decorators_mgr() as other_decorators:
            pass
        with no_yield_mgr() as no_yield:
            pass
        ''')
        self.assertRaises(InferenceError, next, module['no_decorators'].infer())
        self.assertRaises(InferenceError, next, module['other_decorators'].infer())
        self.assertRaises(InferenceError, next, module['no_yield'].infer())

    def test_unary_op_leaks_stop_iteration(self):
        node = extract_node('+[] #@')
        self.assertEqual(util.Uninferable, next(node.infer()))

    def test_unary_operands(self):
        ast_nodes = extract_node('''
        import os
        def func(): pass
        from missing import missing
        class GoodInstance(object):
            def __pos__(self):
                return 42
            def __neg__(self):
                return +self - 41
            def __invert__(self):
                return 42
        class BadInstance(object):
            def __pos__(self):
                return lala
            def __neg__(self):
                return missing
        class LambdaInstance(object):
            __pos__ = lambda self: self.lala
            __neg__ = lambda self: self.lala + 1
            @property
            def lala(self): return 24
        instance = GoodInstance()
        lambda_instance = LambdaInstance()
        +instance #@
        -instance #@
        ~instance #@
        --instance #@
        +lambda_instance #@
        -lambda_instance #@

        bad_instance = BadInstance()
        +bad_instance #@
        -bad_instance #@
        ~bad_instance #@

        # These should be TypeErrors.
        ~BadInstance #@
        ~os #@
        -func #@
        +BadInstance #@
        ''')
        expected = [42, 1, 42, -1, 24, 25]
        for node, value in zip(ast_nodes[:6], expected):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, value)

        for bad_node in ast_nodes[6:]:
            inferred = next(bad_node.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_unary_op_instance_method_not_callable(self):
        ast_node = extract_node('''
        class A:
            __pos__ = (i for i in range(10))
        +A() #@
        ''')
        self.assertRaises(InferenceError, next, ast_node.infer())

    def test_binary_op_type_errors(self):
        ast_nodes = extract_node('''
        import collections
        1 + "a" #@
        1 - [] #@
        1 * {} #@
        1 / collections #@
        1 ** (lambda x: x) #@
        {} * {} #@
        {} - {} #@
        {} | {} #@
        {} >> {} #@
        [] + () #@
        () + [] #@
        [] * 2.0 #@
        () * 2.0 #@
        2.0 >> 2.0 #@
        class A(object): pass
        class B(object): pass
        A() + B() #@
        class A1(object):
            def __add__(self, other): return NotImplemented
        A1() + A1() #@
        class A(object):
            def __add__(self, other): return NotImplemented
        class B(object):
            def __radd__(self, other): return NotImplemented
        A() + B() #@
        class Parent(object):
            pass
        class Child(Parent):
            def __add__(self, other): return NotImplemented
        Child() + Parent() #@
        class A(object):
            def __add__(self, other): return NotImplemented
        class B(A):
            def __radd__(self, other):
                 return NotImplemented
        A() + B() #@
        # Augmented
        f = 1
        f+=A() #@
        x = 1
        x+=[] #@
        ''')
        msg = "unsupported operand type(s) for {op}: {lhs!r} and {rhs!r}"
        expected = [
            msg.format(op="+", lhs="int", rhs="str"),
            msg.format(op="-", lhs="int", rhs="list"),
            msg.format(op="*", lhs="int", rhs="dict"),
            msg.format(op="/", lhs="int", rhs="module"),
            msg.format(op="**", lhs="int", rhs="function"),
            msg.format(op="*", lhs="dict", rhs="dict"),
            msg.format(op="-", lhs="dict", rhs="dict"),
            msg.format(op="|", lhs="dict", rhs="dict"),
            msg.format(op=">>", lhs="dict", rhs="dict"),
            msg.format(op="+", lhs="list", rhs="tuple"),
            msg.format(op="+", lhs="tuple", rhs="list"),
            msg.format(op="*", lhs="list", rhs="float"),
            msg.format(op="*", lhs="tuple", rhs="float"),
            msg.format(op=">>", lhs="float", rhs="float"),
            msg.format(op="+", lhs="A", rhs="B"),
            msg.format(op="+", lhs="A1", rhs="A1"),
            msg.format(op="+", lhs="A", rhs="B"),
            msg.format(op="+", lhs="Child", rhs="Parent"),
            msg.format(op="+", lhs="A", rhs="B"),
            msg.format(op="+=", lhs="int", rhs="A"),
            msg.format(op="+=", lhs="int", rhs="list"),
        ]
        for node, expected_value in zip(ast_nodes, expected):
            errors = node.type_errors()
            self.assertEqual(len(errors), 1)
            error = errors[0]
            self.assertEqual(str(error), expected_value)

    def test_unary_type_errors(self):
        ast_nodes = extract_node('''
        import collections
        ~[] #@
        ~() #@
        ~dict() #@
        ~{} #@
        ~set() #@
        -set() #@
        -"" #@
        ~"" #@
        +"" #@
        class A(object): pass
        ~(lambda: None) #@
        ~A #@
        ~A() #@
        ~collections #@
        ~2.0 #@
        ''')
        msg = "bad operand type for unary {op}: {type}"
        expected = [
            msg.format(op="~", type='list'),
            msg.format(op="~", type='tuple'),
            msg.format(op="~", type='dict'),
            msg.format(op="~", type='dict'),
            msg.format(op="~", type='set'),
            msg.format(op="-", type='set'),
            msg.format(op="-", type='str'),
            msg.format(op="~", type='str'),
            msg.format(op="+", type='str'),
            msg.format(op="~", type='<lambda>'),
            msg.format(op="~", type='A'),
            msg.format(op="~", type='A'),
            msg.format(op="~", type='collections'),
            msg.format(op="~", type='float'),
        ]
        for node, expected_value in zip(ast_nodes, expected):
            errors = node.type_errors()
            self.assertEqual(len(errors), 1)
            error = errors[0]
            self.assertEqual(str(error), expected_value)

    def test_unary_empty_type_errors(self):
        # These aren't supported right now
        ast_nodes = extract_node('''
        ~(2 and []) #@
        -(0 or {}) #@
        ''')
        expected = [
            "bad operand type for unary ~: list",
            "bad operand type for unary -: dict",
        ]
        for node, expected_value in zip(ast_nodes, expected):
            errors = node.type_errors()
            self.assertEqual(len(errors), 1, (expected, node))
            self.assertEqual(str(errors[0]), expected_value)

    def test_bool_value_recursive(self):
        pairs = [
            ('{}', False),
            ('{1:2}', True),
            ('()', False),
            ('(1, 2)', True),
            ('[]', False),
            ('[1,2]', True),
            ('frozenset()', False),
            ('frozenset((1, 2))', True),
        ]
        for code, expected in pairs:
            node = extract_node(code)
            inferred = next(node.infer())
            self.assertEqual(inferred.bool_value(), expected)

    def test_genexpr_bool_value(self):
        node = extract_node('''(x for x in range(10))''')
        self.assertTrue(node.bool_value())

    def test_name_bool_value(self):
        node = extract_node('''
        x = 42
        y = x
        y
        ''')
        self.assertIs(node.bool_value(), util.Uninferable)

    def test_bool_value(self):
        # Verify the truth value of nodes.
        module = parse('''
        import collections
        collections_module = collections
        def function(): pass
        class Class(object):
            def method(self): pass
        dict_comp = {x:y for (x, y) in ((1, 2), (2, 3))}
        set_comp = {x for x in range(10)}
        list_comp = [x for x in range(10)]
        lambda_func = lambda: None
        unbound_method = Class.method
        instance = Class()
        bound_method = instance.method
        def generator_func():
             yield
        def true_value():
             return True
        generator = generator_func()
        bin_op = 1 + 2
        bool_op = x and y
        callfunc = test()
        good_callfunc = true_value()
        compare = 2 < 3
        const_str_true = 'testconst'
        const_str_false = ''
        ''')
        collections_module = next(module['collections_module'].infer())
        self.assertTrue(collections_module.bool_value())
        function = module['function']
        self.assertTrue(function.bool_value())
        klass = module['Class']
        self.assertTrue(klass.bool_value())
        dict_comp = next(module['dict_comp'].infer())
        self.assertEqual(dict_comp, util.Uninferable)
        set_comp = next(module['set_comp'].infer())
        self.assertEqual(set_comp, util.Uninferable)
        list_comp = next(module['list_comp'].infer())
        self.assertEqual(list_comp, util.Uninferable)
        lambda_func = next(module['lambda_func'].infer())
        self.assertTrue(lambda_func)
        unbound_method = next(module['unbound_method'].infer())
        self.assertTrue(unbound_method)
        bound_method = next(module['bound_method'].infer())
        self.assertTrue(bound_method)
        generator = next(module['generator'].infer())
        self.assertTrue(generator)
        bin_op = module['bin_op'].parent.value
        self.assertIs(bin_op.bool_value(), util.Uninferable)
        bool_op = module['bool_op'].parent.value
        self.assertEqual(bool_op.bool_value(), util.Uninferable)
        callfunc = module['callfunc'].parent.value
        self.assertEqual(callfunc.bool_value(), util.Uninferable)
        good_callfunc = next(module['good_callfunc'].infer())
        self.assertTrue(good_callfunc.bool_value())
        compare = module['compare'].parent.value
        self.assertEqual(compare.bool_value(), util.Uninferable)

    def test_bool_value_instances(self):
        instances = extract_node('''
        class FalseBoolInstance(object):
            def {bool}(self):
                return False
        class TrueBoolInstance(object):
            def {bool}(self):
                return True
        class FalseLenInstance(object):
            def __len__(self):
                return 0
        class TrueLenInstance(object):
            def __len__(self):
                return 14
        class AlwaysTrueInstance(object):
            pass
        class ErrorInstance(object):
            def __bool__(self):
                return lala
            def __len__(self):
                return lala
        class NonMethods(object):
            __bool__ = 1
            __len__ = 2
        FalseBoolInstance() #@
        TrueBoolInstance() #@
        FalseLenInstance() #@
        TrueLenInstance() #@
        AlwaysTrueInstance() #@
        ErrorInstance() #@
        '''.format(bool=BOOL_SPECIAL_METHOD))
        expected = (False, True, False, True, True, util.Uninferable, util.Uninferable)
        for node, expected_value in zip(instances, expected):
            inferred = next(node.infer())
            self.assertEqual(inferred.bool_value(), expected_value)

    def test_bool_value_variable(self):
        instance = extract_node('''
        class VariableBoolInstance(object):
            def __init__(self, value):
                self.value = value
            def {bool}(self):
                return self.value

        not VariableBoolInstance(True)
        '''.format(bool=BOOL_SPECIAL_METHOD))
        inferred = next(instance.infer())
        self.assertIs(inferred.bool_value(), util.Uninferable)

    def test_infer_coercion_rules_for_floats_complex(self):
        ast_nodes = extract_node('''
        1 + 1.0 #@
        1 * 1.0 #@
        2 - 1.0 #@
        2 / 2.0 #@
        1 + 1j #@
        2 * 1j #@
        2 - 1j #@
        3 / 1j #@
        ''')
        expected_values = [2.0, 1.0, 1.0, 1.0, 1 + 1j, 2j, 2 - 1j, -3j]
        for node, expected in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertEqual(inferred.value, expected)

    def test_binop_list_with_elts(self):
        ast_node = extract_node('''
        x = [A] * 1
        [1] + x
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.List)
        self.assertEqual(len(inferred.elts), 2)
        self.assertIsInstance(inferred.elts[0], nodes.Const)
        self.assertIsInstance(inferred.elts[1], nodes.Unknown)

    def test_binop_same_types(self):
        ast_nodes = extract_node('''
        class A(object):
            def __add__(self, other):
                return 42
        1 + 1 #@
        1 - 1 #@
        "a" + "b" #@
        A() + A() #@
        ''')
        expected_values = [2, 0, "ab", 42]
        for node, expected in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, expected)

    def test_binop_different_types_reflected_only(self):
        node = extract_node('''
        class A(object):
            pass
        class B(object):
            def __radd__(self, other):
                return other
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_binop_different_types_unknown_bases(self):
        node = extract_node('''
        from foo import bar

        class A(bar):
            pass
        class B(object):
            def __radd__(self, other):
                return other
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertIs(inferred, util.Uninferable)

    def test_binop_different_types_normal_not_implemented_and_reflected(self):
        node = extract_node('''
        class A(object):
            def __add__(self, other):
                return NotImplemented
        class B(object):
            def __radd__(self, other):
                return other
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_binop_different_types_no_method_implemented(self):
        node = extract_node('''
        class A(object):
            pass
        class B(object): pass
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)

    def test_binop_different_types_reflected_and_normal_not_implemented(self):
        node = extract_node('''
        class A(object):
            def __add__(self, other): return NotImplemented
        class B(object):
            def __radd__(self, other): return NotImplemented
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)

    def test_binop_subtype(self):
        node = extract_node('''
        class A(object): pass
        class B(A):
            def __add__(self, other): return other
        B() + A() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_binop_subtype_implemented_in_parent(self):
        node = extract_node('''
        class A(object):
            def __add__(self, other): return other
        class B(A): pass
        B() + A() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_binop_subtype_not_implemented(self):
        node = extract_node('''
        class A(object):
            pass
        class B(A):
            def __add__(self, other): return NotImplemented
        B() + A() #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)

    def test_binop_supertype(self):
        node = extract_node('''
        class A(object):
            pass
        class B(A):
            def __radd__(self, other):
                 return other
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_binop_supertype_rop_not_implemented(self):
        node = extract_node('''
        class A(object):
            def __add__(self, other):
                return other
        class B(A):
            def __radd__(self, other):
                 return NotImplemented
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'B')

    def test_binop_supertype_both_not_implemented(self):
        node = extract_node('''
        class A(object):
            def __add__(self): return NotImplemented
        class B(A):
            def __radd__(self, other):
                 return NotImplemented
        A() + B() #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)

    def test_binop_inferrence_errors(self):
        ast_nodes = extract_node('''
        from unknown import Unknown
        class A(object):
           def __add__(self, other): return NotImplemented
        class B(object):
           def __add__(self, other): return Unknown
        A() + Unknown #@
        Unknown + A() #@
        B() + A() #@
        A() + B() #@
        ''')
        for node in ast_nodes:
            self.assertEqual(next(node.infer()), util.Uninferable)

    def test_binop_ambiguity(self):
        ast_nodes = extract_node('''
        class A(object):
           def __add__(self, other):
               if isinstance(other, B):
                    return NotImplemented
               if type(other) is type(self):
                    return 42
               return NotImplemented
        class B(A): pass
        class C(object):
           def __radd__(self, other):
               if isinstance(other, B):
                   return 42
               return NotImplemented
        A() + B() #@
        B() + A() #@
        A() + C() #@
        C() + A() #@
        ''')
        for node in ast_nodes:
            self.assertEqual(next(node.infer()), util.Uninferable)

    def test_metaclass__getitem__(self):
        ast_node = extract_node('''
        class Meta(type):
            def __getitem__(cls, arg):
                return 24
        import six
        @six.add_metaclass(Meta)
        class A(object):
            pass

        A['Awesome'] #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 24)

    def test_bin_op_classes(self):
        ast_node = extract_node('''
        class Meta(type):
            def __or__(self, other):
                return 24
        import six
        @six.add_metaclass(Meta)
        class A(object):
            pass

        A | A
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 24)

    def test_bin_op_supertype_more_complicated_example(self):
        ast_node = extract_node('''
        class A(object):
            def __init__(self):
                self.foo = 42
            def __add__(self, other):
                return other.bar + self.foo / 2

        class B(A):
            def __init__(self):
                self.bar = 24
        def __radd__(self, other):
            return NotImplemented

        A() + B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(int(inferred.value), 45)

    def test_aug_op_same_type_not_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return NotImplemented
        A() + A() #@
        ''')
        self.assertEqual(next(ast_node.infer()), util.Uninferable)

    def test_aug_op_same_type_aug_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return other
        f = A()
        f += A() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_aug_op_same_type_aug_not_implemented_normal_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return 42
        f = A()
        f += A() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_aug_op_subtype_both_not_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return NotImplemented
        class B(A):
            pass
        b = B()
        b+=A() #@
        ''')
        self.assertEqual(next(ast_node.infer()), util.Uninferable)

    def test_aug_op_subtype_aug_op_is_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return 42
        class B(A):
            pass
        b = B()
        b+=A() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_aug_op_subtype_normal_op_is_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __add__(self, other): return 42
        class B(A):
            pass
        b = B()
        b+=A() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_aug_different_types_no_method_implemented(self):
        ast_node = extract_node('''
        class A(object): pass
        class B(object): pass
        f = A()
        f += B() #@
        ''')
        self.assertEqual(next(ast_node.infer()), util.Uninferable)

    def test_aug_different_types_augop_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return other
        class B(object): pass
        f = A()
        f += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'B')

    def test_aug_different_types_aug_not_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return other
        class B(object): pass
        f = A()
        f += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'B')

    def test_aug_different_types_aug_not_implemented_rop_fallback(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return NotImplemented
        class B(object):
            def __radd__(self, other): return other
        f = A()
        f += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_augop_supertypes_none_implemented(self):
        ast_node = extract_node('''
        class A(object): pass
        class B(object): pass
        a = A()
        a += B() #@
        ''')
        self.assertEqual(next(ast_node.infer()), util.Uninferable)

    def test_augop_supertypes_not_implemented_returned_for_all(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return NotImplemented
        class B(object):
            def __add__(self, other): return NotImplemented
        a = A()
        a += B() #@
        ''')
        self.assertEqual(next(ast_node.infer()), util.Uninferable)

    def test_augop_supertypes_augop_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return other
        class B(A): pass
        a = A()
        a += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'B')

    def test_augop_supertypes_reflected_binop_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
        class B(A):
            def __radd__(self, other): return other
        a = A()
        a += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'A')

    def test_augop_supertypes_normal_binop_implemented(self):
        ast_node = extract_node('''
        class A(object):
            def __iadd__(self, other): return NotImplemented
            def __add__(self, other): return other
        class B(A):
            def __radd__(self, other): return NotImplemented

        a = A()
        a += B() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'B')

    @unittest.expectedFailure
    def test_string_interpolation(self):
        ast_nodes = extract_node('''
        "a%d%d" % (1, 2) #@
        "a%(x)s" % {"x": 42} #@
        ''')
        expected = ["a12", "a42"]
        for node, expected_value in zip(ast_nodes, expected):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, expected_value)

    def test_mul_list_supports__index__(self):
        ast_nodes = extract_node('''
        class Index(object):
            def __index__(self): return 2
        class NotIndex(object): pass
        class NotIndex2(object):
            def __index__(self): return None
        a = [1, 2]
        a * Index() #@
        a * NotIndex() #@
        a * NotIndex2() #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, nodes.List)
        self.assertEqual([node.value for node in first.itered()],
                         [1, 2, 1, 2])
        for rest in ast_nodes[1:]:
            inferred = next(rest.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_subscript_supports__index__(self):
        ast_nodes = extract_node('''
        class Index(object):
            def __index__(self): return 2
        class LambdaIndex(object):
            __index__ = lambda self: self.foo
            @property
            def foo(self): return 1
        class NonIndex(object):
            __index__ = lambda self: None
        a = [1, 2, 3, 4]
        a[Index()] #@
        a[LambdaIndex()] #@
        a[NonIndex()] #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, nodes.Const)
        self.assertEqual(first.value, 3)
        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, nodes.Const)
        self.assertEqual(second.value, 2)
        self.assertRaises(InferenceError, next, ast_nodes[2].infer())

    def test_special_method_masquerading_as_another(self):
        ast_node = extract_node('''
        class Info(object):
            def __add__(self, other):
                return "lala"
            __or__ = __add__

        f = Info()
        f | Info() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, "lala")

    def test_unary_op_assignment(self):
        ast_node = extract_node('''
        class A(object): pass
        def pos(self):
            return 42
        A.__pos__ = pos
        f = A()
        +f #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def test_unary_op_classes(self):
        ast_node = extract_node('''
        import six
        class Meta(type):
            def __invert__(self):
                return 42
        @six.add_metaclass(Meta)
        class A(object):
            pass
        ~A
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 42)

    def _slicing_test_helper(self, pairs, cls, get_elts):
        for code, expected in pairs:
            ast_node = extract_node(code)
            inferred = next(ast_node.infer())
            self.assertIsInstance(inferred, cls)
            self.assertEqual(get_elts(inferred), expected,
                             ast_node.as_string())

    def test_slicing_list(self):
        pairs = (
            ("[1, 2, 3][:] #@", [1, 2, 3]),
            ("[1, 2, 3][0:] #@", [1, 2, 3]),
            ("[1, 2, 3][None:] #@", [1, 2, 3]),
            ("[1, 2, 3][None:None] #@", [1, 2, 3]),
            ("[1, 2, 3][0:-1] #@", [1, 2]),
            ("[1, 2, 3][0:2] #@", [1, 2]),
            ("[1, 2, 3][0:2:None] #@", [1, 2]),
            ("[1, 2, 3][::] #@", [1, 2, 3]),
            ("[1, 2, 3][::2] #@", [1, 3]),
            ("[1, 2, 3][::-1] #@", [3, 2, 1]),
            ("[1, 2, 3][0:2:2] #@", [1]),
            ("[1, 2, 3, 4, 5, 6][0:4-1:2+0] #@", [1, 3]),
        )
        self._slicing_test_helper(
            pairs, nodes.List,
            lambda inferred: [elt.value for elt in inferred.elts])

    def test_slicing_tuple(self):
        pairs = (
            ("(1, 2, 3)[:] #@", [1, 2, 3]),
            ("(1, 2, 3)[0:] #@", [1, 2, 3]),
            ("(1, 2, 3)[None:] #@", [1, 2, 3]),
            ("(1, 2, 3)[None:None] #@", [1, 2, 3]),
            ("(1, 2, 3)[0:-1] #@", [1, 2]),
            ("(1, 2, 3)[0:2] #@", [1, 2]),
            ("(1, 2, 3)[0:2:None] #@", [1, 2]),
            ("(1, 2, 3)[::] #@", [1, 2, 3]),
            ("(1, 2, 3)[::2] #@", [1, 3]),
            ("(1, 2, 3)[::-1] #@", [3, 2, 1]),
            ("(1, 2, 3)[0:2:2] #@", [1]),
            ("(1, 2, 3, 4, 5, 6)[0:4-1:2+0] #@", [1, 3]),
        )
        self._slicing_test_helper(
            pairs, nodes.Tuple,
            lambda inferred: [elt.value for elt in inferred.elts])

    def test_slicing_str(self):
        pairs = (
            ("'123'[:] #@", "123"),
            ("'123'[0:] #@", "123"),
            ("'123'[None:] #@", "123"),
            ("'123'[None:None] #@", "123"),
            ("'123'[0:-1] #@", "12"),
            ("'123'[0:2] #@", "12"),
            ("'123'[0:2:None] #@", "12"),
            ("'123'[::] #@", "123"),
            ("'123'[::2] #@", "13"),
            ("'123'[::-1] #@", "321"),
            ("'123'[0:2:2] #@", "1"),
            ("'123456'[0:4-1:2+0] #@", "13"),
        )
        self._slicing_test_helper(
            pairs, nodes.Const, lambda inferred: inferred.value)

    def test_invalid_slicing_primaries(self):
        examples = [
            "(lambda x: x)[1:2]",
            "1[2]",
            "(1, 2, 3)[a:]",
            "(1, 2, 3)[object:object]",
            "(1, 2, 3)[1:object]",
            'enumerate[2]'
        ]
        for code in examples:
            node = extract_node(code)
            self.assertRaises(InferenceError, next, node.infer())

    def test_instance_slicing(self):
        ast_nodes = extract_node('''
        class A(object):
            def __getitem__(self, index):
                return [1, 2, 3, 4, 5][index]
        A()[1:] #@
        A()[:2] #@
        A()[1:4] #@
        ''')
        expected_values = [
            [2, 3, 4, 5],
            [1, 2],
            [2, 3, 4],
        ]
        for expected, node in zip(expected_values, ast_nodes):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.List)
            self.assertEqual([elt.value for elt in inferred.elts], expected)

    def test_instance_slicing_slices(self):
        ast_node = extract_node('''
        class A(object):
            def __getitem__(self, index):
                return index
        A()[1:] #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Slice)
        self.assertEqual(inferred.lower.value, 1)
        self.assertIsNone(inferred.upper)

    def test_instance_slicing_fails(self):
        ast_nodes = extract_node('''
        class A(object):
            def __getitem__(self, index):
                return 1[index]
        A()[4:5] #@
        A()[2:] #@
        ''')
        for node in ast_nodes:
            self.assertEqual(next(node.infer()), util.Uninferable)

    def test_type__new__with_metaclass(self):
        ast_node = extract_node('''
        class Metaclass(type):
            pass
        class Entity(object):
             pass
        type.__new__(Metaclass, 'NewClass', (Entity,), {'a': 1}) #@
        ''')
        inferred = next(ast_node.infer())

        self.assertIsInstance(inferred, nodes.ClassDef)
        self.assertEqual(inferred.name, 'NewClass')
        metaclass = inferred.metaclass()
        self.assertEqual(metaclass, inferred.root()['Metaclass'])
        ancestors = list(inferred.ancestors())
        self.assertEqual(len(ancestors), 2)
        self.assertEqual(ancestors[0], inferred.root()['Entity'])
        attributes = inferred.getattr('a')
        self.assertEqual(len(attributes), 1)
        self.assertIsInstance(attributes[0], nodes.Const)
        self.assertEqual(attributes[0].value, 1)

    def test_type__new__not_enough_arguments(self):
        ast_nodes = extract_node('''
        type.__new__(1) #@
        type.__new__(1, 2) #@
        type.__new__(1, 2, 3) #@
        type.__new__(1, 2, 3, 4, 5) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)

    def test_type__new__invalid_mcs_argument(self):
        ast_nodes = extract_node('''
        class Class(object): pass
        type.__new__(1, 2, 3, 4) #@
        type.__new__(Class, 2, 3, 4) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)

    def test_type__new__invalid_name(self):
        ast_nodes = extract_node('''
        class Class(type): pass
        type.__new__(Class, object, 1, 2) #@
        type.__new__(Class, 1, 1, 2) #@
        type.__new__(Class, [], 1, 2) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)

    def test_type__new__invalid_bases(self):
        ast_nodes = extract_node('''
        type.__new__(type, 'a', 1, 2) #@
        type.__new__(type, 'a', [], 2) #@
        type.__new__(type, 'a', {}, 2) #@
        type.__new__(type, 'a', (1, ), 2) #@
        type.__new__(type, 'a', (object, 1), 2) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)

    def test_type__new__invalid_attrs(self):
        ast_nodes = extract_node('''
        type.__new__(type, 'a', (), ()) #@
        type.__new__(type, 'a', (), object) #@
        type.__new__(type, 'a', (), 1) #@
        type.__new__(type, 'a', (), {object: 1}) #@
        type.__new__(type, 'a', (), {1:2, "a":5}) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, Instance)

    def test_type__new__metaclass_lookup(self):
        ast_node = extract_node('''
        class Metaclass(type):
            def test(cls): pass
            @classmethod
            def test1(cls): pass
            attr = 42
        type.__new__(Metaclass, 'A', (), {}) #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)
        test = inferred.getattr('test')
        self.assertEqual(len(test), 1)
        self.assertIsInstance(test[0], BoundMethod)
        self.assertIsInstance(test[0].bound, nodes.ClassDef)
        self.assertEqual(test[0].bound, inferred)
        test1 = inferred.getattr('test1')
        self.assertEqual(len(test1), 1)
        self.assertIsInstance(test1[0], BoundMethod)
        self.assertIsInstance(test1[0].bound, nodes.ClassDef)
        self.assertEqual(test1[0].bound, inferred.metaclass())
        attr = inferred.getattr('attr')
        self.assertEqual(len(attr), 1)
        self.assertIsInstance(attr[0], nodes.Const)
        self.assertEqual(attr[0].value, 42)

    def test_type__new__metaclass_and_ancestors_lookup(self):
        ast_node = extract_node('''
        class Book(object):
             title = 'Ubik'
        class MetaBook(type):
             title = 'Grimus'
        type.__new__(MetaBook, 'book', (Book, ), {'title':'Catch 22'}) #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)
        titles = [title.value for title in inferred.igetattr('title')]
        self.assertEqual(titles, ['Catch 22', 'Ubik', 'Grimus'])

    @unittest.expectedFailure
    def test_function_metaclasses(self):
        # These are not supported right now, although
        # they will be in the future.
        ast_node = extract_node('''
        import six

        class BookMeta(type):
            author = 'Rushdie'

        def metaclass_function(*args):
            return BookMeta

        @six.add_metaclass(metaclass_function)
        class Book(object):
            pass
        Book #@
        ''')
        inferred = next(ast_node.infer())
        metaclass = inferred.metaclass()
        self.assertIsInstance(metaclass, nodes.ClassDef)
        self.assertEqual(metaclass.name, 'BookMeta')
        author = next(inferred.igetattr('author'))
        self.assertIsInstance(author, nodes.Const)
        self.assertEqual(author.value, 'Rushdie')

    def test_subscript_inference_error(self):
        # Used to raise StopIteration
        ast_node = extract_node('''
        class AttributeDict(dict):
            def __getitem__(self, name):
                return self
        flow = AttributeDict()
        flow['app'] = AttributeDict()
        flow['app']['config'] = AttributeDict()
        flow['app']['config']['doffing'] = AttributeDict() #@
        ''')
        self.assertIsNone(helpers.safe_infer(ast_node.targets[0]))

    def test_classmethod_inferred_by_context(self):
        ast_node = extract_node('''
        class Super(object):
           def instance(cls):
              return cls()
           instance = classmethod(instance)

        class Sub(Super):
            def method(self):
                return self

        # should see the Sub.instance() is returning a Sub
        # instance, not a Super instance
        Sub.instance().method() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, Instance)
        self.assertEqual(inferred.name, 'Sub')

    def test_infer_call_result_invalid_dunder_call_on_instance(self):
        ast_nodes = extract_node('''
        class A:
            __call__ = 42
        class B:
            __call__ = A()
        class C:
            __call = None
        A() #@
        B() #@
        C() #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertRaises(InferenceError, next, inferred.infer_call_result(node))

    def test_context_call_for_context_managers(self):
        ast_nodes = extract_node('''
        class A:
            def __enter__(self):
                return self
        class B:
            __enter__ = lambda self: self
        class C:
            @property
            def a(self): return A()
            def __enter__(self):
                return self.a
        with A() as a:
            a #@
        with B() as b:
            b #@
        with C() as c:
            c #@
        ''')
        first_a = next(ast_nodes[0].infer())
        self.assertIsInstance(first_a, Instance)
        self.assertEqual(first_a.name, 'A')
        second_b = next(ast_nodes[1].infer())
        self.assertIsInstance(second_b, Instance)
        self.assertEqual(second_b.name, 'B')
        third_c = next(ast_nodes[2].infer())
        self.assertIsInstance(third_c, Instance)
        self.assertEqual(third_c.name, 'A')

    def test_metaclass_subclasses_arguments_are_classes_not_instances(self):
        ast_node = extract_node('''
        class A(type):
            def test(cls):
                return cls
        import six
        @six.add_metaclass(A)
        class B(object):
            pass

        B.test() #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)
        self.assertEqual(inferred.name, 'B')

    def test_infer_cls_in_class_methods(self):
        ast_nodes = extract_node('''
        class A(type):
            def __call__(cls):
                cls #@
        class B(object):
            def __call__(cls):
                cls #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, nodes.ClassDef)
        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, Instance)

    @unittest.expectedFailure
    def test_metaclass_arguments_are_classes_not_instances(self):
        ast_node = extract_node('''
        class A(type):
            def test(cls): return cls
        A.test() #@
        ''')
        # This is not supported yet
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)
        self.assertEqual(inferred.name, 'A')

    @test_utils.require_version(minver='3.0')
    def test_metaclass_with_keyword_args(self):
        ast_node = extract_node('''
        class TestMetaKlass(type):
            def __new__(mcs, name, bases, ns, kwo_arg):
                return super().__new__(mcs, name, bases, ns)

        class TestKlass(metaclass=TestMetaKlass, kwo_arg=42): #@
            pass
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)

    def test_delayed_attributes_without_slots(self):
        ast_node = extract_node('''
        class A(object):
            __slots__ = ('a', )
        a = A()
        a.teta = 24
        a.a = 24
        a #@
        ''')
        inferred = next(ast_node.infer())
        with self.assertRaises(exceptions.NotFoundError):
            inferred.getattr('teta')
        inferred.getattr('a')

    @test_utils.require_version(maxver='3.0')
    def test_delayed_attributes_with_old_style_classes(self):
        ast_node = extract_node('''
        class A:
            __slots__ = ('a', )
        a = A()
        a.teta = 42
        a #@
        ''')
        next(ast_node.infer()).getattr('teta')

    def test_lambda_as_methods(self):
        ast_node = extract_node('''
        class X:
           m = lambda self, arg: self.z + arg
           z = 24

        X().m(4) #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 28)

    def test_inner_value_redefined_by_subclass(self):
        ast_node = extract_node('''
        class X(object):
            M = lambda self, arg: "a"
            x = 24
            def __init__(self):
                x = 24
                self.m = self.M(x)

        class Y(X):
            M = lambda self, arg: arg + 1
            def blurb(self):
                self.m #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 25)

    @unittest.expectedFailure
    def test_inner_value_redefined_by_subclass_with_mro(self):
        # This might work, but it currently doesn't due to not being able
        # to reuse inference contexts.
        ast_node = extract_node('''
        class X(object):
            M = lambda self, arg: arg + 1
            x = 24
            def __init__(self):
                y = self
                self.m = y.M(1) + y.z

        class C(object):
            z = 24

        class Y(X, C):
            M = lambda self, arg: arg + 1
            def blurb(self):
                self.m #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Const)
        self.assertEqual(inferred.value, 25)

    def test_getitem_of_class_raised_type_error(self):
        # Test that we wrap an AttributeInferenceError
        # and reraise it as a TypeError in Class.getitem
        node = extract_node('''
        def test():
            yield
        test()
        ''')
        inferred = next(node.infer())
        with self.assertRaises(exceptions.AstroidTypeError):
            inferred.getitem(nodes.Const('4'))


class GetattrTest(unittest.TestCase):

    def test_yes_when_unknown(self):
        ast_nodes = extract_node('''
        from missing import Missing
        getattr(1, Unknown) #@
        getattr(Unknown, 'a') #@
        getattr(Unknown, Unknown) #@
        getattr(Unknown, Unknown, Unknown) #@

        getattr(Missing, 'a') #@
        getattr(Missing, Missing) #@
        getattr('a', Missing) #@
        getattr('a', Missing, Missing) #@
        ''')
        for node in ast_nodes[:4]:
            self.assertRaises(InferenceError, next, node.infer())

        for node in ast_nodes[4:]:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable, node)

    def test_attrname_not_string(self):
        ast_nodes = extract_node('''
        getattr(1, 1) #@
        c = int
        getattr(1, c) #@
        ''')
        for node in ast_nodes:
            self.assertRaises(InferenceError, next, node.infer())

    def test_attribute_missing(self):
        ast_nodes = extract_node('''
        getattr(1, 'ala') #@
        getattr(int, 'ala') #@
        getattr(float, 'bala') #@
        getattr({}, 'portocala') #@
        ''')
        for node in ast_nodes:
            self.assertRaises(InferenceError, next, node.infer())

    def test_default(self):
        ast_nodes = extract_node('''
        getattr(1, 'ala', None) #@
        getattr(int, 'bala', int) #@
        getattr(int, 'bala', getattr(int, 'portocala', None)) #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, nodes.Const)
        self.assertIsNone(first.value)

        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, nodes.ClassDef)
        self.assertEqual(second.qname(), "%s.int" % BUILTINS)

        third = next(ast_nodes[2].infer())
        self.assertIsInstance(third, nodes.Const)
        self.assertIsNone(third.value)

    def test_lookup(self):
        ast_nodes = extract_node('''
        class A(object):
            def test(self): pass
        class B(A):
            def test_b(self): pass
        class C(A): pass
        class E(C, B):
            def test_e(self): pass

        getattr(A(), 'test') #@
        getattr(A, 'test') #@
        getattr(E(), 'test_b') #@
        getattr(E(), 'test') #@

        class X(object):
            def test(self):
                getattr(self, 'test') #@
        ''')

        first = next(ast_nodes[0].infer())
        self.assertIsInstance(first, BoundMethod)
        self.assertEqual(first.bound.name, 'A')

        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, UnboundMethod)
        self.assertIsInstance(second.parent, nodes.ClassDef)
        self.assertEqual(second.parent.name, 'A')

        third = next(ast_nodes[2].infer())
        self.assertIsInstance(third, BoundMethod)
        # Bound to E, but the provider is B.
        self.assertEqual(third.bound.name, 'E')
        self.assertEqual(third._proxied._proxied.parent.name, 'B')

        fourth = next(ast_nodes[3].infer())
        self.assertIsInstance(fourth, BoundMethod)
        self.assertEqual(fourth.bound.name, 'E')
        self.assertEqual(third._proxied._proxied.parent.name, 'B')

        fifth = next(ast_nodes[4].infer())
        self.assertIsInstance(fifth, BoundMethod)
        self.assertEqual(fifth.bound.name, 'X')

    def test_lambda(self):
        node = extract_node('''
        getattr(lambda x: x, 'f') #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)


class HasattrTest(unittest.TestCase):

    def test_inference_errors(self):
        ast_nodes = extract_node('''
        from missing import Missing

        hasattr(Unknown, 'ala') #@

        hasattr(Missing, 'bala') #@
        hasattr('portocala', Missing) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_attribute_is_missing(self):
        ast_nodes = extract_node('''
        class A: pass
        hasattr(int, 'ala') #@
        hasattr({}, 'bala') #@
        hasattr(A(), 'portocala') #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertFalse(inferred.value)

    def test_attribute_is_not_missing(self):
        ast_nodes = extract_node('''
        class A(object):
            def test(self): pass
        class B(A):
            def test_b(self): pass
        class C(A): pass
        class E(C, B):
            def test_e(self): pass

        hasattr(A(), 'test') #@
        hasattr(A, 'test') #@
        hasattr(E(), 'test_b') #@
        hasattr(E(), 'test') #@

        class X(object):
            def test(self):
                hasattr(self, 'test') #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertTrue(inferred.value)

    def test_lambda(self):
        node = extract_node('''
        hasattr(lambda x: x, 'f') #@
        ''')
        inferred = next(node.infer())
        self.assertEqual(inferred, util.Uninferable)


class BoolOpTest(unittest.TestCase):

    def test_bool_ops(self):
        expected = [
            ('1 and 2', 2),
            ('0 and 2', 0),
            ('1 or 2', 1),
            ('0 or 2', 2),
            ('0 or 0 or 1', 1),
            ('1 and 2 and 3', 3),
            ('1 and 2 or 3', 2),
            ('1 and 0 or 3', 3),
            ('1 or 0 and 2', 1),
            ('(1 and 2) and (2 and 3)', 3),
            ('not 2 and 3', False),
            ('2 and not 3', False),
            ('not 0 and 3', 3),
            ('True and False', False),
            ('not (True or False) and True', False),
        ]
        for code, expected_value in expected:
            node = extract_node(code)
            inferred = next(node.infer())
            self.assertEqual(inferred.value, expected_value)

    def test_yes_when_unknown(self):
        ast_nodes = extract_node('''
        from unknown import unknown, any, not_any
        0 and unknown #@
        unknown or 0 #@
        any or not_any and unknown #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_other_nodes(self):
        ast_nodes = extract_node('''
        def test(): pass
        test and 0 #@
        1 and test #@
        ''')
        first = next(ast_nodes[0].infer())
        self.assertEqual(first.value, 0)
        second = next(ast_nodes[1].infer())
        self.assertIsInstance(second, nodes.FunctionDef)
        self.assertEqual(second.name, 'test')


class TestCallable(unittest.TestCase):

    def test_callable(self):
        expected = [
            ('callable(len)', True),
            ('callable("a")', False),
            ('callable(callable)', True),
            ('callable(lambda x, y: x+y)', True),
            ('import os; __(callable(os))', False),
            ('callable(int)', True),
            ('''
             def test(): pass
             callable(test) #@''', True),
            ('''
             class C1:
                def meth(self): pass
             callable(C1) #@''', True),
        ]
        for code, expected_value in expected:
            node = extract_node(code)
            inferred = next(node.infer())
            self.assertEqual(inferred.value, expected_value)

    def test_callable_methods(self):
        ast_nodes = extract_node('''
        class C:
            def test(self): pass
            @staticmethod
            def static(): pass
            @classmethod
            def class_method(cls): pass
            def __call__(self): pass
        class D(C):
            pass
        class NotReallyCallableDueToPythonMisfeature(object):
            __call__ = 42
        callable(C.test) #@
        callable(C.static) #@
        callable(C.class_method) #@
        callable(C().test) #@
        callable(C().static) #@
        callable(C().class_method) #@
        C #@
        C() #@
        NotReallyCallableDueToPythonMisfeature() #@
        staticmethod #@
        classmethod #@
        property #@
        D #@
        D() #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertTrue(inferred)

    def test_inference_errors(self):
        ast_nodes = extract_node('''
        from unknown import unknown
        callable(unknown) #@
        def test():
            return unknown
        callable(test()) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_not_callable(self):
        ast_nodes = extract_node('''
        callable("") #@
        callable(1) #@
        callable(True) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertFalse(inferred.value)


class TestBool(unittest.TestCase):

    def test_bool(self):
        pairs = [
            ('bool()', False),
            ('bool(1)', True),
            ('bool(0)', False),
            ('bool([])', False),
            ('bool([1])', True),
            ('bool({})', False),
            ('bool(True)', True),
            ('bool(False)', False),
            ('bool(None)', False),
            ('from unknown import Unknown; __(bool(Unknown))', util.Uninferable),
        ]
        for code, expected in pairs:
            node = extract_node(code)
            inferred = next(node.infer())
            if expected is util.Uninferable:
                self.assertEqual(expected, inferred)
            else:
                self.assertEqual(inferred.value, expected)

    def test_bool_bool_special_method(self):
        ast_nodes = extract_node('''
        class FalseClass:
           def {method}(self):
               return False
        class TrueClass:
           def {method}(self):
               return True
        class C(object):
           def __call__(self):
               return False
        class B(object):
           {method} = C()
        class LambdaBoolFalse(object):
            {method} = lambda self: self.foo
            @property
            def foo(self): return 0
        class FalseBoolLen(object):
            __len__ = lambda self: self.foo
            @property
            def foo(self): return 0
        bool(FalseClass) #@
        bool(TrueClass) #@
        bool(FalseClass()) #@
        bool(TrueClass()) #@
        bool(B()) #@
        bool(LambdaBoolFalse()) #@
        bool(FalseBoolLen()) #@
        '''.format(method=BOOL_SPECIAL_METHOD))
        expected = [True, True, False, True, False, False, False]
        for node, expected_value in zip(ast_nodes, expected):
            inferred = next(node.infer())
            self.assertEqual(inferred.value, expected_value)

    def test_bool_instance_not_callable(self):
        ast_nodes = extract_node('''
        class BoolInvalid(object):
           {method} = 42
        class LenInvalid(object):
           __len__ = "a"
        bool(BoolInvalid()) #@
        bool(LenInvalid()) #@
        '''.format(method=BOOL_SPECIAL_METHOD))
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable)


class TestType(unittest.TestCase):

    def test_type(self):
        pairs = [
            ('type(1)', 'int'),
            ('type(type)', 'type'),
            ('type(None)', 'NoneType'),
            ('type(object)', 'type'),
            ('type(dict())', 'dict'),
            ('type({})', 'dict'),
            ('type(frozenset())', 'frozenset'),
        ]
        for code, expected in pairs:
            node = extract_node(code)
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.ClassDef)
            self.assertEqual(inferred.name, expected)


class ArgumentsTest(unittest.TestCase):

    @staticmethod
    def _get_dict_value(inferred):
        items = inferred.items
        return sorted((key.value, value.value) for key, value in items)

    @staticmethod
    def _get_tuple_value(inferred):
        elts = inferred.elts
        return tuple(elt.value for elt in elts)

    def test_args(self):
        expected_values = [(), (1, ), (2, 3), (4, 5),
                           (3, ), (), (3, 4, 5),
                           (), (), (4, ), (4, 5),
                           (), (3, ), (), (), (3, ), (42, )]
        ast_nodes = extract_node('''
        def func(*args):
            return args
        func() #@
        func(1) #@
        func(2, 3) #@
        func(*(4, 5)) #@
        def func(a, b, *args):
            return args
        func(1, 2, 3) #@
        func(1, 2) #@
        func(1, 2, 3, 4, 5) #@
        def func(a, b, c=42, *args):
            return args
        func(1, 2) #@
        func(1, 2, 3) #@
        func(1, 2, 3, 4) #@
        func(1, 2, 3, 4, 5) #@
        func = lambda a, b, *args: args
        func(1, 2) #@
        func(1, 2, 3) #@
        func = lambda a, b=42, *args: args
        func(1) #@
        func(1, 2) #@
        func(1, 2, 3) #@
        func(1, 2, *(42, )) #@
        ''')
        for node, expected_value in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Tuple)
            self.assertEqual(self._get_tuple_value(inferred), expected_value)

    @test_utils.require_version('3.5')
    def test_multiple_starred_args(self):
        expected_values = [
            (1, 2, 3),
            (1, 4, 2, 3, 5, 6, 7),
        ]
        ast_nodes = extract_node('''
        def func(a, b, *args):
            return args
        func(1, 2, *(1, ), *(2, 3)) #@
        func(1, 2, *(1, ), 4, *(2, 3), 5, *(6, 7)) #@
        ''')
        for node, expected_value in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Tuple)
            self.assertEqual(self._get_tuple_value(inferred), expected_value)

    def test_defaults(self):
        expected_values = [42, 3, 41, 42]
        ast_nodes = extract_node('''
        def func(a, b, c=42, *args):
            return c
        func(1, 2) #@
        func(1, 2, 3) #@
        func(1, 2, c=41) #@
        func(1, 2, 42, 41) #@
        ''')
        for node, expected_value in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, expected_value)

    @test_utils.require_version('3.0')
    def test_kwonly_args(self):
        expected_values = [24, 24, 42, 23, 24, 24, 54]
        ast_nodes = extract_node('''
        def test(*, f, b): return f
        test(f=24, b=33) #@
        def test(a, *, f): return f
        test(1, f=24) #@
        def test(a, *, f=42): return f
        test(1) #@
        test(1, f=23) #@
        def test(a, b, c=42, *args, f=24):
            return f
        test(1, 2, 3) #@
        test(1, 2, 3, 4) #@
        test(1, 2, 3, 4, 5, f=54) #@
        ''')
        for node, expected_value in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, expected_value)

    def test_kwargs(self):
        expected = [
            [('a', 1), ('b', 2), ('c', 3)],
            [('a', 1)],
            [('a', 'b')],
        ]
        ast_nodes = extract_node('''
        def test(**kwargs):
             return kwargs
        test(a=1, b=2, c=3) #@
        test(a=1) #@
        test(**{'a': 'b'}) #@
        ''')
        for node, expected_value in zip(ast_nodes, expected):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Dict)
            value = self._get_dict_value(inferred)
            self.assertEqual(value, expected_value)

    def test_kwargs_and_other_named_parameters(self):
        ast_nodes = extract_node('''
        def test(a=42, b=24, **kwargs):
            return kwargs
        test(42, 24, c=3, d=4) #@
        test(49, b=24, d=4) #@
        test(a=42, b=33, c=3, d=42) #@
        test(a=42, **{'c':42}) #@
        ''')
        expected_values = [
            [('c', 3), ('d', 4)],
            [('d', 4)],
            [('c', 3), ('d', 42)],
            [('c', 42)],
        ]
        for node, expected_value in zip(ast_nodes, expected_values):
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Dict)
            value = self._get_dict_value(inferred)
            self.assertEqual(value, expected_value)

    def test_kwargs_access_by_name(self):
        expected_values = [42, 42, 42, 24]
        ast_nodes = extract_node('''
        def test(**kwargs):
            return kwargs['f']
        test(f=42) #@
        test(**{'f': 42}) #@
        test(**dict(f=42)) #@
        def test(f=42, **kwargs):
            return kwargs['l']
        test(l=24) #@
        ''')
        for ast_node, value in zip(ast_nodes, expected_values):
            inferred = next(ast_node.infer())
            self.assertIsInstance(inferred, nodes.Const)
            self.assertEqual(inferred.value, value)

    @test_utils.require_version('3.5')
    def test_multiple_kwargs(self):
        expected_value = [
            ('a', 1),
            ('b', 2),
            ('c', 3),
            ('d', 4),
            ('f', 42),
        ]
        ast_node = extract_node('''
        def test(**kwargs):
             return kwargs
        test(a=1, b=2, **{'c': 3}, **{'d': 4}, f=42) #@
        ''')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.Dict)
        value = self._get_dict_value(inferred)
        self.assertEqual(value, expected_value)

    def test_kwargs_are_overridden(self):
        ast_nodes = extract_node('''
        def test(f):
             return f
        test(f=23, **{'f': 34}) #@
        def test(f=None):
             return f
        test(f=23, **{'f':23}) #@
        ''')
        for ast_node in ast_nodes:
            inferred = next(ast_node.infer())
            self.assertEqual(inferred, util.Uninferable)

    def test_fail_to_infer_args(self):
        ast_nodes = extract_node('''
        def test(a, **kwargs): return a
        test(*missing) #@
        test(*object) #@
        test(*1) #@


        def test(**kwargs): return kwargs
        test(**miss) #@
        test(**(1, 2)) #@
        test(**1) #@
        test(**{misss:1}) #@
        test(**{object:1}) #@
        test(**{1:1}) #@
        test(**{'a':1, 'a':1}) #@

        def test(a): return a
        test() #@
        test(1, 2, 3) #@

        from unknown import unknown
        test(*unknown) #@
        def test(*args): return args
        test(*unknown) #@
        ''')
        for node in ast_nodes:
            inferred = next(node.infer())
            self.assertEqual(inferred, util.Uninferable)


class SliceTest(unittest.TestCase):

    def test_slice(self):
        ast_nodes = [
            ('[1, 2, 3][slice(None)]', [1, 2, 3]),
            ('[1, 2, 3][slice(None, None)]', [1, 2, 3]),
            ('[1, 2, 3][slice(None, None, None)]', [1, 2, 3]),
            ('[1, 2, 3][slice(1, None)]', [2, 3]),
            ('[1, 2, 3][slice(None, 1, None)]', [1]),
            ('[1, 2, 3][slice(0, 1)]', [1]),
            ('[1, 2, 3][slice(0, 3, 2)]', [1, 3]),
        ]
        for node, expected_value in ast_nodes:
            ast_node = extract_node("__({})".format(node))
            inferred = next(ast_node.infer())
            self.assertIsInstance(inferred, nodes.List)
            self.assertEqual([elt.value for elt in inferred.elts], expected_value)

    def test_slice_inference_error(self):
        ast_nodes = extract_node('''
        from unknown import unknown
        [1, 2, 3][slice(None, unknown, unknown)] #@
        [1, 2, 3][slice(None, missing, missing)] #@
        [1, 2, 3][slice(object, list, tuple)] #@
        [1, 2, 3][slice(b'a')] #@
        [1, 2, 3][slice(1, 'aa')] #@
        [1, 2, 3][slice(1, 2.0, 3.0)] #@
        [1, 2, 3][slice()] #@
        [1, 2, 3][slice(1, 2, 3, 4)] #@
        ''')
        for node in ast_nodes:
            self.assertRaises(InferenceError, next, node.infer())

    def test_slice_attributes(self):
        ast_nodes = [
            ('slice(2, 3, 4)', (2, 3, 4)),
            ('slice(None, None, 4)', (None, None, 4)),
            ('slice(None, 1, None)', (None, 1, None)),
        ]
        for code, values in ast_nodes:
            lower, upper, step = values
            node = extract_node(code)
            inferred = next(node.infer())
            self.assertIsInstance(inferred, nodes.Slice)
            lower_value = next(inferred.igetattr('start'))
            self.assertIsInstance(lower_value, nodes.Const)
            self.assertEqual(lower_value.value, lower)
            higher_value = next(inferred.igetattr('stop'))
            self.assertIsInstance(higher_value, nodes.Const)
            self.assertEqual(higher_value.value, upper)
            step_value = next(inferred.igetattr('step'))
            self.assertIsInstance(step_value, nodes.Const)
            self.assertEqual(step_value.value, step)
            self.assertEqual(inferred.pytype(), '%s.slice' % BUILTINS)

    def test_slice_type(self):
        ast_node = extract_node('type(slice(None, None, None))')
        inferred = next(ast_node.infer())
        self.assertIsInstance(inferred, nodes.ClassDef)
        self.assertEqual(inferred.name, 'slice')


class CallSiteTest(unittest.TestCase):

    @staticmethod
    def _call_site_from_call(call):
        return arguments.CallSite.from_call(call)

    def _test_call_site_pair(self, code, expected_args, expected_keywords):
        ast_node = extract_node(code)
        call_site = self._call_site_from_call(ast_node)
        self.assertEqual(len(call_site.positional_arguments), len(expected_args))
        self.assertEqual([arg.value for arg in call_site.positional_arguments],
                         expected_args)
        self.assertEqual(len(call_site.keyword_arguments), len(expected_keywords))
        for keyword, value in expected_keywords.items():
            self.assertIn(keyword, call_site.keyword_arguments)
            self.assertEqual(call_site.keyword_arguments[keyword].value, value)

    def _test_call_site(self, pairs):
        for pair in pairs:
            self._test_call_site_pair(*pair)

    @test_utils.require_version('3.5')
    def test_call_site_starred_args(self):
        pairs = [
            (
                "f(*(1, 2), *(2, 3), *(3, 4), **{'a':1}, **{'b': 2})",
                [1, 2, 2, 3, 3, 4],
                {'a': 1, 'b': 2}
            ),
            (
                "f(1, 2, *(3, 4), 5, *(6, 7), f=24, **{'c':3})",
                [1, 2, 3, 4, 5, 6, 7],
                {'f':24, 'c': 3},
            ),
            # Too many fs passed into.
            (
                "f(f=24, **{'f':24})", [], {},
            ),
        ]
        self._test_call_site(pairs)

    def test_call_site(self):
        pairs = [
            (
                "f(1, 2)", [1, 2], {}
            ),
            (
                "f(1, 2, *(1, 2))", [1, 2, 1, 2], {}
            ),
            (
                "f(a=1, b=2, c=3)", [], {'a':1, 'b':2, 'c':3}
            )
        ]
        self._test_call_site(pairs)

    def _test_call_site_valid_arguments(self, values, invalid):
        for value in values:
            ast_node = extract_node(value)
            call_site = self._call_site_from_call(ast_node)
            self.assertEqual(call_site.has_invalid_arguments(), invalid)

    def test_call_site_valid_arguments(self):
        values = [
            "f(*lala)", "f(*1)", "f(*object)",
        ]
        self._test_call_site_valid_arguments(values, invalid=True)
        values = [
            "f()", "f(*(1, ))", "f(1, 2, *(2, 3))",
        ]
        self._test_call_site_valid_arguments(values, invalid=False)

    def test_duplicated_keyword_arguments(self):
        ast_node = extract_node('f(f=24, **{"f": 25})')
        site = self._call_site_from_call(ast_node)
        self.assertIn('f', site.duplicated_keywords)


if __name__ == '__main__':
    unittest.main()
