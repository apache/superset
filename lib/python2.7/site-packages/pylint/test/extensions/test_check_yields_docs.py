# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unit tests for the yield documentation checking in the
`DocstringChecker` in :mod:`pylint.extensions.check_docs`
"""
from __future__ import division, print_function, absolute_import

import astroid
from pylint.testutils import CheckerTestCase, Message, set_config

from pylint.extensions.docparams import DocstringParameterChecker


class TestDocstringCheckerYield(CheckerTestCase):
    """Tests for pylint_plugin.RaiseDocChecker"""
    CHECKER_CLASS = DocstringParameterChecker

    def test_ignores_no_docstring(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            yield False #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    @set_config(accept_no_yields_doc=False)
    def test_warns_no_docstring(self):
        node = astroid.extract_node('''
        def my_func(self):
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node),
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_ignores_unknown_style(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring."""
            yield False #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_warn_partial_sphinx_yields(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :returns: Always False
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_partial_sphinx_yields_type(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :rtype: bool
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_missing_sphinx_yields(self):
        node = astroid.extract_node('''
        def my_func(self, doc_type):
            """This is a docstring.

            :param doc_type: Sphinx
            :type doc_type: str
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node),
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_partial_google_yields(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                Always False
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_partial_google_yields_type(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                bool:
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_missing_google_yields(self):
        node = astroid.extract_node('''
        def my_func(self, doc_type):
            """This is a docstring.

            Parameters:
                doc_type (str): Google
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node),
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warn_missing_numpy_yields(self):
        node = astroid.extract_node('''
        def my_func(self, doc_type):
            """This is a docstring.

            Arguments
            ---------
            doc_type : str
                Numpy
            """
            yield False
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node),
                Message(msg_id='missing-yield-type-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_find_sphinx_yields(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :return: Always False
            :rtype: bool
            """
            yield False #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_find_google_yields(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                bool: Always False
            """
            yield False #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_find_numpy_yields(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
            bool
                Always False
            """
            yield False #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_sphinx_yield_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :returns: An object
            :rtype: :class:`mymodule.Class`
            """
            yield mymodule.Class() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_google_yield_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                mymodule.Class: An object
            """
            yield mymodule.Class() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_numpy_yield_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
                mymodule.Class
                    An object
            """
            yield mymodule.Class() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_sphinx_yield_list_of_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :returns: An object
            :rtype: list(:class:`mymodule.Class`)
            """
            yield [mymodule.Class()] #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_google_yield_list_of_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                list(:class:`mymodule.Class`): An object
            """
            yield [mymodule.Class()] #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_finds_numpy_yield_list_of_custom_class(self):
        yield_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
                list(:class:`mymodule.Class`)
                    An object
            """
            yield [mymodule.Class()] #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_yield(yield_node)

    def test_warns_sphinx_yield_list_of_custom_class_without_description(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :rtype: list(:class:`mymodule.Class`)
            """
            yield [mymodule.Class()]
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warns_google_yield_list_of_custom_class_without_description(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                list(:class:`mymodule.Class`):
            """
            yield [mymodule.Class()]
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node)):
            self.checker.visit_yield(yield_node)

    def test_warns_numpy_yield_list_of_custom_class_without_description(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
                list(:class:`mymodule.Class`)
            """
            yield [mymodule.Class()]
        ''')
        yield_node = node.body[0]
        with self.assertAddsMessages(
                Message(msg_id='missing-yield-doc', node=node)):
            self.checker.visit_yield(yield_node)

    # No such thing as redundant yield documentation for sphinx because it
    # doesn't support yield documentation

    def test_ignores_google_redundant_yield_doc_multiple_yields(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                int or None: One, or sometimes None.
            """
            if a_func():
                yield None
            yield 1
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    def test_ignores_numpy_redundant_yield_doc_multiple_yields(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
                int
                    One
                None
                    Sometimes
            """
            if a_func():
                yield None
            yield 1
        ''')
        with self.assertNoMessages():
            self.checker.visit_functiondef(node)

    # No such thing as redundant yield documentation for sphinx because it
    # doesn't support yield documentation

    def test_warns_google_redundant_yield_doc_return(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields:
                int: One
            """
            return 1
        ''')
        with self.assertAddsMessages(
                Message(msg_id='redundant-yields-doc', node=node)):
            self.checker.visit_functiondef(node)

    def test_warns_numpy_redundant_yield_doc_return(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Yields
            -------
                int
                    One
            """
            return 1
        ''')
        with self.assertAddsMessages(
                Message(msg_id='redundant-yields-doc', node=node)):
            self.checker.visit_functiondef(node)
