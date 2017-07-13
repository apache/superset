# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unit tests for the raised exception documentation checking in the
`DocstringChecker` in :mod:`pylint.extensions.check_docs`
"""
from __future__ import division, print_function, absolute_import

import astroid
from pylint.testutils import CheckerTestCase, Message, set_config

from pylint.extensions.docparams import DocstringParameterChecker


class TestDocstringCheckerRaise(CheckerTestCase):
    """Tests for pylint_plugin.RaiseDocChecker"""
    CHECKER_CLASS = DocstringParameterChecker

    def test_ignores_no_docstring(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            raise RuntimeError('hi') #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_ignores_unknown_style(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring."""
            raise RuntimeError('hi')
        ''')
        raise_node = node.body[0]
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    @set_config(accept_no_raise_doc=False)
    def test_warns_unknown_style(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring."""
            raise RuntimeError('hi')
        ''')
        raise_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_missing_sphinx_raises(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Never
            """
            raise RuntimeError('hi')
            raise NameError('hi')
        ''')
        raise_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_missing_google_raises(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises:
                NameError: Never
            """
            raise RuntimeError('hi')
            raise NameError('hi')
        ''')
        raise_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_missing_numpy_raises(self):
        node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises
            ------
            NameError
                Never
            """
            raise RuntimeError('hi')
            raise NameError('hi')
        ''')
        raise_node = node.body[0]
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_ignore_spurious_sphinx_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises RuntimeError: Always
            :except NameError: Never
            :raise OSError: Never
            :exception ValueError: Never
            """
            raise RuntimeError('Blah') #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_find_all_sphinx_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises RuntimeError: Always
            :except NameError: Never
            :raise OSError: Never
            :exception ValueError: Never
            """
            raise RuntimeError('hi') #@
            raise NameError('hi')
            raise OSError(2, 'abort!')
            raise ValueError('foo')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_find_all_google_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises:
                RuntimeError: Always
                NameError: Never
            """
            raise RuntimeError('hi') #@
            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_find_all_numpy_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises
            ------
            RuntimeError
                Always
            NameError
                Never
            """
            raise RuntimeError('hi') #@
            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_finds_rethrown_sphinx_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Sometimes
            """
            try:
                fake_func()
            except RuntimeError:
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_rethrown_google_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises:
                NameError: Sometimes
            """
            try:
                fake_func()
            except RuntimeError:
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_rethrown_numpy_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises
            ------
            NameError
                Sometimes
            """
            try:
                fake_func()
            except RuntimeError:
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_finds_rethrown_sphinx_multiple_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Sometimes
            """
            try:
                fake_func()
            except (RuntimeError, ValueError):
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError, ValueError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_rethrown_google_multiple_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises:
                NameError: Sometimes
            """
            try:
                fake_func()
            except (RuntimeError, ValueError):
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError, ValueError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_rethrown_numpy_multiple_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises
            ------
            NameError
                Sometimes
            """
            try:
                fake_func()
            except (RuntimeError, ValueError):
                raise #@

            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError, ValueError', ))):
            self.checker.visit_raise(raise_node)

    def test_ignores_caught_sphinx_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Sometimes
            """
            try:
                raise RuntimeError('hi') #@
            except RuntimeError:
                pass

            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_ignores_caught_google_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises:
                NameError: Sometimes
            """
            try:
                raise RuntimeError('hi') #@
            except RuntimeError:
                pass

            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_ignores_caught_numpy_raises(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            Raises
            ------
            NameError
                Sometimes
            """
            try:
                raise RuntimeError('hi') #@
            except RuntimeError:
                pass

            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_find_missing_sphinx_raises_infer_from_instance(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Never
            """
            my_exception = RuntimeError('hi')
            raise my_exception #@
            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_find_missing_sphinx_raises_infer_from_function(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Never
            """
            def ex_func(val):
                return RuntimeError(val)
            raise ex_func('hi') #@
            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            self.checker.visit_raise(raise_node)

    def test_ignores_raise_uninferable(self):
        raise_node = astroid.extract_node('''
        from unknown import Unknown

        def my_func(self):
            """This is a docstring.

            :raises NameError: Never
            """
            raise Unknown('hi') #@
            raise NameError('hi')
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_ignores_returns_from_inner_functions(self):
        raise_node = astroid.extract_node('''
        def my_func(self):
            """This is a docstring.

            :raises NameError: Never
            """
            def ex_func(val):
                def inner_func(value):
                    return OSError(value)
                return RuntimeError(val)
            raise ex_func('hi') #@
            raise NameError('hi')
        ''')
        node = raise_node.frame()
        with self.assertAddsMessages(
            Message(
                msg_id='missing-raises-doc',
                node=node,
                args=('RuntimeError', ))):
            # we do NOT expect a warning about the OSError in inner_func!
            self.checker.visit_raise(raise_node)

    def test_ignores_returns_use_only_names(self):
        raise_node = astroid.extract_node('''
        def myfunc():
            """This is a docstring

            :raises NameError: Never
            """
            def inner_func():
                return 42

            raise inner_func() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_ignores_returns_use_only_exception_instances(self):
        raise_node = astroid.extract_node('''
        def myfunc():
            """This is a docstring

            :raises MyException: Never
            """
            class MyException(Exception):
                pass
            def inner_func():
                return MyException

            raise inner_func() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_no_crash_when_inferring_handlers(self):
        raise_node = astroid.extract_node('''
        import collections

        def test():
           """raises

           :raise U: pass
           """
           try:
              pass
           except collections.U as exc:
              raise #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)

    def test_no_crash_when_cant_find_exception(self):
        raise_node = astroid.extract_node('''
        import collections

        def test():
           """raises

           :raise U: pass
           """
           try:
              pass
           except U as exc:
              raise #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_raise(raise_node)
