# Copyright (c) 2014, 2016 Google, Inc.
# Copyright (c) 2015 Dmitry Pribysh <dmand@yandex.ru>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unittest for the type checker."""
import sys

import pytest

import astroid

from pylint.checkers import typecheck
from pylint.testutils import CheckerTestCase, Message, set_config


class TestTypeChecker(CheckerTestCase):
    "Tests for pylint.checkers.typecheck"
    CHECKER_CLASS = typecheck.TypeChecker

    def test_no_member_in_getattr(self):
        """Make sure that a module attribute access is checked by pylint.
        """

        node = astroid.extract_node("""
        import optparse
        optparse.THIS_does_not_EXIST 
        """)
        with self.assertAddsMessages(
                Message(
                    'no-member',
                    node=node,
                    args=('Module', 'optparse', 'THIS_does_not_EXIST', ''))):
            self.checker.visit_attribute(node)

    @set_config(ignored_modules=('argparse',))
    def test_no_member_in_getattr_ignored(self):
        """Make sure that a module attribute access check is omitted with a
        module that is configured to be ignored.
        """

        node = astroid.extract_node("""
        import argparse
        argparse.THIS_does_not_EXIST
        """)
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @set_config(ignored_classes=('xml.etree.', ))
    def test_ignored_modules_invalid_pattern(self):
        node = astroid.extract_node('''
        import xml
        xml.etree.Lala
        ''')
        message = Message('no-member', node=node,
                          args=('Module', 'xml.etree', 'Lala', ''))
        with self.assertAddsMessages(message):
            self.checker.visit_attribute(node)

    @set_config(ignored_modules=('xml.etree*', ))
    def test_ignored_modules_patterns(self):
        node = astroid.extract_node('''
        import xml
        xml.etree.portocola #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @set_config(ignored_classes=('xml.*', ))
    def test_ignored_classes_no_recursive_pattern(self):
        node = astroid.extract_node('''
        import xml
        xml.etree.ElementTree.Test
        ''')
        message = Message('no-member', node=node,
                          args=('Module', 'xml.etree.ElementTree', 'Test', ''))
        with self.assertAddsMessages(message):
            self.checker.visit_attribute(node)

    @set_config(ignored_classes=('optparse.Values', ))
    def test_ignored_classes_qualified_name(self):
        """Test that ignored-classes supports qualified name for ignoring."""
        node = astroid.extract_node('''
        import optparse
        optparse.Values.lala
        ''')
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @set_config(ignored_classes=('Values', ))
    def test_ignored_classes_only_name(self):
        """Test that ignored_classes works with the name only."""
        node = astroid.extract_node('''
        import optparse
        optparse.Values.lala
        ''')
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @set_config(contextmanager_decorators=('contextlib.contextmanager',
                                           '.custom_contextmanager'))
    def test_custom_context_manager(self):
        """Test that @custom_contextmanager is recognized as configured."""
        node = astroid.extract_node('''
        from contextlib import contextmanager
        def custom_contextmanager(f):
            return contextmanager(f)
        @custom_contextmanager
        def dec():
            yield
        with dec():
            pass
        ''')
        with self.assertNoMessages():
            self.checker.visit_with(node)

    def test_invalid_metaclass(self):
        module = astroid.parse('''
        import six

        class InvalidAsMetaclass(object):
            pass

        @six.add_metaclass(int)
        class FirstInvalid(object):
            pass

        @six.add_metaclass(InvalidAsMetaclass)
        class SecondInvalid(object):
            pass

        @six.add_metaclass(2)
        class ThirdInvalid(object):
            pass
        ''')
        for class_obj, metaclass_name in (('ThirdInvalid', '2'),
                                          ('SecondInvalid', 'InvalidAsMetaclass'),
                                          ('FirstInvalid', 'int')):
            classdef = module[class_obj]
            message = Message('invalid-metaclass', node=classdef, args=(metaclass_name, ))
            with self.assertAddsMessages(message):
                self.checker.visit_classdef(classdef)

    @pytest.mark.skipif(sys.version_info[0] < 3, reason='Needs Python 3.')
    def test_invalid_metaclass_function_metaclasses(self):
        module = astroid.parse('''
        def invalid_metaclass_1(name, bases, attrs):
            return int
        def invalid_metaclass_2(name, bases, attrs):
            return 1
        class Invalid(metaclass=invalid_metaclass_1):
            pass
        class InvalidSecond(metaclass=invalid_metaclass_2):
            pass
        ''')
        for class_obj, metaclass_name in (('Invalid', 'int'), ('InvalidSecond', '1')):
            classdef = module[class_obj]
            message = Message('invalid-metaclass', node=classdef, args=(metaclass_name, ))
            with self.assertAddsMessages(message):
                self.checker.visit_classdef(classdef)

    @pytest.mark.skipif(sys.version_info < (3, 5), reason='Needs Python 3.5.')
    def test_typing_namedtuple_not_callable_issue1295(self):
        module = astroid.parse("""
        import typing
        Named = typing.NamedTuple('Named', [('foo', int), ('bar', int)])
        named = Named(1, 2)
        """)
        call = module.body[-1].value
        callables = call.func.infered()
        assert len(callables) == 1
        assert callables[0].callable()
        with self.assertNoMessages():
            self.checker.visit_call(call)

    @pytest.mark.skipif(sys.version_info < (3, 5), reason='Needs Python 3.5.')
    def test_typing_namedtuple_unsubscriptable_object_issue1295(self):
        module = astroid.parse("""
        import typing
        MyType = typing.Tuple[str, str]
        """)
        subscript = module.body[-1].value
        with self.assertNoMessages():
            self.checker.visit_subscript(subscript)
