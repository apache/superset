# Copyright (c) 2014-2015 Bruno Daniel <bruno.daniel@blue-yonder.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unit tests for the pylint checkers in :mod:`pylint.extensions.check_docs`,
in particular the parameter documentation checker `DocstringChecker`
"""
from __future__ import division, print_function, absolute_import

import sys

import pytest

import astroid
from pylint.testutils import CheckerTestCase, Message, set_config

from pylint.extensions.docparams import DocstringParameterChecker


class TestParamDocChecker(CheckerTestCase):
    """Tests for pylint_plugin.ParamDocChecker"""
    CHECKER_CLASS = DocstringParameterChecker

    def test_missing_func_params_in_sphinx_docstring(self):
        """Example of a function with missing Sphinx parameter documentation in
        the docstring
        """
        node = astroid.extract_node("""
        def function_foo(x, y, z):
            '''docstring ...

            :param x: bla

            :param int z: bar
            '''
            pass
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self.checker.visit_functiondef(node)

    def test_missing_func_params_in_google_docstring(self):
        """Example of a function with missing Google style parameter
        documentation in the docstring
        """
        node = astroid.extract_node("""
        def function_foo(x, y, z):
            '''docstring ...

            Args:
                x: bla
                z (int): bar

            some other stuff
            '''
            pass
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self.checker.visit_functiondef(node)

    def test_missing_func_params_in_numpy_docstring(self):
        """Example of a function with missing NumPy style parameter
        documentation in the docstring
        """
        node = astroid.extract_node("""
        def function_foo(x, y, z):
            '''docstring ...

            Parameters
            ----------
            x:
                bla
            z: int
                bar

            some other stuff
            '''
            pass
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self.checker.visit_functiondef(node)

    def test_tolerate_no_param_documentation_at_all(self):
        """Example of a function with no parameter documentation at all

        No error message is emitted.
        """
        node = astroid.extract_node("""
        def function_foo(x, y):
            '''docstring ...

            missing parameter documentation'''
            pass
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    @set_config(accept_no_param_doc=False)
    def test_don_t_tolerate_no_param_documentation_at_all(self):
        """Example of a function with no parameter documentation at all

        Missing documentation error message is emitted.
        """
        node = astroid.extract_node("""
        def function_foo(x, y):
            '''docstring ...

            missing parameter documentation'''
            pass
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x, y',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self.checker.visit_functiondef(node)

    @set_config(accept_no_param_doc=False)
    def test_see_tolerate_no_param_documentation_at_all(self):
        """Example for the usage of "For the parameters, see"
        to suppress missing-param warnings.
        """
        node = astroid.extract_node("""
        def function_foo(x, y):
            '''docstring ...

            For the parameters, see :func:`blah`
            '''
            pass
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def _visit_methods_of_class(self, node):
        """Visit all methods of a class node

        :param node: class node
        :type node: :class:`astroid.scoped_nodes.Class`
        """
        for body_item in node.body:
            if (isinstance(body_item, astroid.FunctionDef)
                    and hasattr(body_item, 'name')):
                self.checker.visit_functiondef(body_item)

    def test_missing_method_params_in_sphinx_docstring(self):
        """Example of a class method with missing parameter documentation in
        the Sphinx style docstring
        """
        node = astroid.extract_node("""
        class Foo(object):
            def method_foo(self, x, y):
                '''docstring ...

                missing parameter documentation

                :param x: bla
                '''
                pass
        """)
        method_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=method_node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=method_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_missing_method_params_in_google_docstring(self):
        """Example of a class method with missing parameter documentation in
        the Google style docstring
        """
        node = astroid.extract_node("""
        class Foo(object):
            def method_foo(self, x, y):
                '''docstring ...

                missing parameter documentation

                Args:
                    x: bla
                '''
                pass
        """)
        method_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=method_node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=method_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_missing_method_params_in_numpy_docstring(self):
        """Example of a class method with missing parameter documentation in
        the Numpy style docstring
        """
        node = astroid.extract_node("""
        class Foo(object):
            def method_foo(self, x, y):
                '''docstring ...

                missing parameter documentation

                Parameters
                ----------
                x:
                    bla
                '''
                pass
        """)
        method_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=method_node,
                args=('y',)),
            Message(
                msg_id='missing-type-doc',
                node=method_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_existing_func_params_in_sphinx_docstring(self):
        """Example of a function with correctly documented parameters and
        return values (Sphinx style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg, warg):
            '''function foo ...

            :param xarg: bla xarg
            :type xarg: int

            :parameter yarg: bla yarg
            :type yarg: my.qualified.type

            :arg int zarg: bla zarg

            :keyword my.qualified.type warg: bla warg

            :return: sum
            :rtype: float
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_existing_func_params_in_google_docstring(self):
        """Example of a function with correctly documented parameters and
        return values (Google style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg, warg):
            '''function foo ...

            Args:
                xarg (int): bla xarg
                yarg (my.qualified.type): bla
                    bla yarg

                zarg (int): bla zarg
                warg (my.qualified.type): bla warg

            Returns:
                float: sum
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_existing_func_params_in_numpy_docstring(self):
        """Example of a function with correctly documented parameters and
        return values (Numpy style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg, warg):
            '''function foo ...

            Parameters
            ----------
            xarg: int
                bla xarg
            yarg: my.qualified.type
                bla yarg

            zarg: int
                bla zarg
            warg: my.qualified.type
                bla warg

            Returns
            -------
            float
                sum
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_wrong_name_of_func_params_in_sphinx_docstring(self):
        """Example of functions with inconsistent parameter names in the
        signature and in the Sphinx style documentation
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg):
            '''function foo ...

            :param xarg1: bla xarg
            :type xarg: int

            :param yarg: bla yarg
            :type yarg1: float

            :param str zarg1: bla zarg
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('xarg, zarg',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('yarg, zarg',)),
            Message(
                    msg_id='differing-param-doc',
                    node=node,
                    args=('xarg1, zarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('yarg1, zarg1',)),
        ):
            self.checker.visit_functiondef(node)

        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            :param yarg1: bla yarg
            :type yarg1: float

            For the other parameters, see bla.
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='differing-param-doc',
                node=node,
                args=('yarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('yarg1',)),
        ):
            self.checker.visit_functiondef(node)

    def test_wrong_name_of_func_params_in_google_docstring(self):
        """Example of functions with inconsistent parameter names in the
        signature and in the Google style documentation
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg):
            '''function foo ...

            Args:
                xarg1 (int): bla xarg
                yarg (float): bla yarg

                zarg1 (str): bla zarg
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('xarg, zarg',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('xarg, zarg',)),
            Message(
                msg_id='differing-param-doc',
                node=node,
                args=('xarg1, zarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('xarg1, zarg1',)),
        ):
            self.checker.visit_functiondef(node)

        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            Args:
                yarg1 (float): bla yarg

            For the other parameters, see bla.
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='differing-param-doc',
                node=node,
                args=('yarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('yarg1',))
        ):
            self.checker.visit_functiondef(node)

    def test_wrong_name_of_func_params_in_numpy_docstring(self):
        """Example of functions with inconsistent parameter names in the
        signature and in the Numpy style documentation
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg, zarg):
            '''function foo ...

            Parameters
            ----------
            xarg1: int
                bla xarg
            yarg: float
                bla yarg

            zarg1: str
                bla zarg
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('xarg, zarg',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('xarg, zarg',)),
            Message(
                msg_id='differing-param-doc',
                node=node,
                args=('xarg1, zarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('xarg1, zarg1',)),
        ):
            self.checker.visit_functiondef(node)

        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            Parameters
            ----------
            yarg1: float
                bla yarg

            For the other parameters, see bla.
            '''
            return xarg + yarg
        """)
        with self.assertAddsMessages(
            Message(
                msg_id='differing-param-doc',
                node=node,
                args=('yarg1',)),
            Message(
                msg_id='differing-type-doc',
                node=node,
                args=('yarg1',))
        ):
            self.checker.visit_functiondef(node)

    def test_see_sentence_for_func_params_in_sphinx_docstring(self):
        """Example for the usage of "For the other parameters, see" to avoid
        too many repetitions, e.g. in functions or methods adhering to a
        given interface (Sphinx style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            :param yarg: bla yarg
            :type yarg: float

            For the other parameters, see :func:`bla`
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_see_sentence_for_func_params_in_google_docstring(self):
        """Example for the usage of "For the other parameters, see" to avoid
        too many repetitions, e.g. in functions or methods adhering to a
        given interface (Google style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            Args:
                yarg (float): bla yarg

            For the other parameters, see :func:`bla`
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_see_sentence_for_func_params_in_numpy_docstring(self):
        """Example for the usage of "For the other parameters, see" to avoid
        too many repetitions, e.g. in functions or methods adhering to a
        given interface (Numpy style)
        """
        node = astroid.extract_node("""
        def function_foo(xarg, yarg):
            '''function foo ...

            Parameters
            ----------
            yarg: float
                bla yarg

            For the other parameters, see :func:`bla`
            '''
            return xarg + yarg
        """)
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_constr_params_in_class_sphinx(self):
        """Example of a class with missing constructor parameter documentation
        (Sphinx style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            :param y: bla
            
            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                pass

        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_class_google(self):
        """Example of a class with missing constructor parameter documentation
        (Google style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            Args:
                y: bla
            
            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                pass

        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_class_numpy(self):
        """Example of a class with missing constructor parameter documentation
        (Numpy style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            Parameters
            ----------
            y:
                bla
            
            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                pass

        """)
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_init_sphinx(self):
        """Example of a class with missing constructor parameter documentation
        (Sphinx style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            def __init__(self, x, y):
                '''docstring foo constructor

                :param y: bla

                missing constructor parameter documentation
                '''

                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_init_google(self):
        """Example of a class with missing constructor parameter documentation
        (Google style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            def __init__(self, x, y):
                '''docstring foo constructor

                Args:
                    y: bla

                missing constructor parameter documentation
                '''
                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_init_numpy(self):
        """Example of a class with missing constructor parameter documentation
        (Numpy style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            def __init__(self, x, y):
                '''docstring foo constructor

                Parameters
                ----------
                y:
                    bla

                missing constructor parameter documentation
                '''
                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',))
        ):
            self._visit_methods_of_class(node)

    @set_config(accept_no_param_doc=False)
    def test_see_sentence_for_constr_params_in_class(self):
        """Example usage of "For the parameters, see" in class docstring"""
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            For the parameters, see :func:`bla`
            '''

            def __init__(self, x, y):
                '''init'''
                pass

        """)
        with self.assertNoMessages():
            self._visit_methods_of_class(node)

    @set_config(accept_no_param_doc=False)
    def test_see_sentence_for_constr_params_in_init(self):
        """Example usage of "For the parameters, see" in init docstring"""
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''foo'''

            def __init__(self, x, y):
                '''docstring foo constructor

                For the parameters, see :func:`bla`
                '''
                pass

        """)
        with self.assertNoMessages():
            self._visit_methods_of_class(node)


    def test_constr_params_in_class_and_init_sphinx(self):
        """Example of a class with missing constructor parameter documentation
        in both the init docstring and the class docstring
        (Sphinx style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            :param y: None

            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                '''docstring foo

                :param y: bla

                missing constructor parameter documentation
                '''
                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='multiple-constructor-doc',
                node=node,
                args=(node.name,)),
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',)),
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',)),
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_class_and_init_google(self):
        """Example of a class with missing constructor parameter documentation
        in both the init docstring and the class docstring
        (Google style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            Args:
                y: bla

            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                '''docstring foo

                Args:
                    y: bla

                missing constructor parameter documentation
                '''
                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='multiple-constructor-doc',
                node=node,
                args=(node.name,)),
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',)),
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',)),
        ):
            self._visit_methods_of_class(node)

    def test_constr_params_in_class_and_init_numpy(self):
        """Example of a class with missing constructor parameter documentation
        in both the init docstring and the class docstring
        (Numpy style)

        Everything is completely analogous to functions.
        """
        node = astroid.extract_node("""
        class ClassFoo(object):
            '''docstring foo

            Parameters
            ----------
            y:
                bla

            missing constructor parameter documentation
            '''

            def __init__(self, x, y):
                '''docstring foo

                Parameters
                ----------
                y:
                    bla

                missing constructor parameter documentation
                '''
                pass

        """)
        constructor_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='multiple-constructor-doc',
                node=node,
                args=(node.name,)),
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('x, y',)),
            Message(
                msg_id='missing-param-doc',
                node=constructor_node,
                args=('x',)),
            Message(
                msg_id='missing-type-doc',
                node=constructor_node,
                args=('x, y',)),
        ):
            self._visit_methods_of_class(node)

    @pytest.mark.skipif(sys.version_info[0] != 3, reason="Enabled on Python 3")
    def test_kwonlyargs_are_taken_in_account(self):
        node = astroid.extract_node('''
        def my_func(arg, *, kwonly, missing_kwonly):
            """The docstring

            :param int arg: The argument.
            :param bool kwonly: A keyword-arg.
            """
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('missing_kwonly', )),
            Message(
                msg_id='missing-type-doc',
                node=node,
                args=('missing_kwonly', ))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_args_sphinx(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            :param named_arg: Returned
            :type named_arg: object
            :returns: Maybe named_arg
            :rtype: object or None
            """
            if args:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('args',))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_kwargs_sphinx(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            :param named_arg: Returned
            :type named_arg: object
            :returns: Maybe named_arg
            :rtype: object or None
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('kwargs',))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_args_google(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            Args:
                named_arg (object): Returned

            Returns:
                object or None: Maybe named_arg
            """
            if args:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('args',))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_kwargs_google(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            Args:
                named_arg (object): Returned

            Returns:
                object or None: Maybe named_arg
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('kwargs',))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_args_numpy(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            Args
            ----
            named_arg : object
                Returned

            Returns
            -------
                object or None
                    Maybe named_arg
            """
            if args:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('args',))):
            self.checker.visit_functiondef(node)

    def test_warns_missing_kwargs_numpy(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            Args
            ----
            named_arg : object
                Returned

            Returns
            -------
                object or None
                    Maybe named_arg
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertAddsMessages(
            Message(
                msg_id='missing-param-doc',
                node=node,
                args=('kwargs',))):
            self.checker.visit_functiondef(node)

    def test_finds_args_without_type_sphinx(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            :param named_arg: Returned
            :type named_arg: object
            :param args: Optional arguments
            :returns: Maybe named_arg
            :rtype: object or None
            """
            if args:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_finds_kwargs_without_type_sphinx(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            :param named_arg: Returned
            :type named_arg: object
            :param kwargs: Keyword arguments
            :returns: Maybe named_arg
            :rtype: object or None
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_finds_args_without_type_google(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            Args:
                named_arg (object): Returned
                *args: Optional arguments

            Returns:
                object or None: Maybe named_arg
            """
            if args:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_finds_kwargs_without_type_google(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            Args:
                named_arg (object): Returned
                **kwargs: Keyword arguments

            Returns:
                object or None: Maybe named_arg
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_finds_args_without_type_numpy(self):
        node = astroid.extract_node('''
        def my_func(named_arg, *args):
            """The docstring

            Args
            ----
            named_arg : object
                Returned
            args :
                Optional Arguments

            Returns
            -------
                object or None
                    Maybe named_arg
            """
            if args:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_finds_kwargs_without_type_numpy(self):
        node = astroid.extract_node('''
        def my_func(named_arg, **kwargs):
            """The docstring

            Args
            ----
            named_arg : object
                Returned
            kwargs :
                Keyword arguments

            Returns
            -------
                object or None
                    Maybe named_arg
            """
            if kwargs:
                return named_arg
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    COMPLEX_TYPES = [
        'int or str',
        'dict(str, str)',
        'dict[str, str]',
        'tuple(int)',
        'tuple(int or str)',
        'tuple(int) or list(int)',
        'tuple(int or str) or list(int or str)',
    ]

    @pytest.mark.parametrize('complex_type', COMPLEX_TYPES)
    def test_finds_multiple_types_sphinx(self, complex_type):
        node = astroid.extract_node('''
        def my_func(named_arg):
            """The docstring

            :param named_arg: Returned
            :type named_arg: {0}

            :returns: named_arg
            :rtype: {0}
            """
            return named_arg
        '''.format(complex_type))
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    @pytest.mark.parametrize('complex_type', COMPLEX_TYPES)
    def test_finds_multiple_types_google(self, complex_type):
        node = astroid.extract_node('''
        def my_func(named_arg):
            """The docstring

            Args:
                named_arg ({0}): Returned

            Returns:
                {0}: named_arg
            """
            return named_arg
        '''.format(complex_type))
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    @pytest.mark.parametrize('complex_type', COMPLEX_TYPES)
    def test_finds_multiple_types_numpy(self, complex_type):
        node = astroid.extract_node('''
        def my_func(named_arg):
            """The docstring

            Args
            ----
            named_arg : {0}
                Returned

            Returns
            -------
                {0}
                    named_arg
            """
            return named_arg
        '''.format(complex_type))
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_ignores_optional_specifier_numpy(self):
        node = astroid.extract_node('''
        def do_something(param, param2='all'):
            """Do something.

            Parameters
            ----------
            param : str
                Description.
            param2 : str, optional
                Description (the default is 'all').

            Returns
            -------
            int
                Description.
            """
            return param, param2
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)
