# coding: utf-8
from __future__ import absolute_import, division, print_function, with_statement
import sys
import datetime

import tornado.escape
from tornado.escape import utf8
from tornado.util import raise_exc_info, Configurable, u, exec_in, ArgReplacer, timedelta_to_seconds, import_object
from tornado.test.util import unittest

try:
    from cStringIO import StringIO  # py2
except ImportError:
    from io import StringIO  # py3


class RaiseExcInfoTest(unittest.TestCase):
    def test_two_arg_exception(self):
        # This test would fail on python 3 if raise_exc_info were simply
        # a three-argument raise statement, because TwoArgException
        # doesn't have a "copy constructor"
        class TwoArgException(Exception):
            def __init__(self, a, b):
                super(TwoArgException, self).__init__()
                self.a, self.b = a, b

        try:
            raise TwoArgException(1, 2)
        except TwoArgException:
            exc_info = sys.exc_info()
        try:
            raise_exc_info(exc_info)
            self.fail("didn't get expected exception")
        except TwoArgException as e:
            self.assertIs(e, exc_info[1])


class TestConfigurable(Configurable):
    @classmethod
    def configurable_base(cls):
        return TestConfigurable

    @classmethod
    def configurable_default(cls):
        return TestConfig1


class TestConfig1(TestConfigurable):
    def initialize(self, pos_arg=None, a=None):
        self.a = a
        self.pos_arg = pos_arg


class TestConfig2(TestConfigurable):
    def initialize(self, pos_arg=None, b=None):
        self.b = b
        self.pos_arg = pos_arg


class ConfigurableTest(unittest.TestCase):
    def setUp(self):
        self.saved = TestConfigurable._save_configuration()

    def tearDown(self):
        TestConfigurable._restore_configuration(self.saved)

    def checkSubclasses(self):
        # no matter how the class is configured, it should always be
        # possible to instantiate the subclasses directly
        self.assertIsInstance(TestConfig1(), TestConfig1)
        self.assertIsInstance(TestConfig2(), TestConfig2)

        obj = TestConfig1(a=1)
        self.assertEqual(obj.a, 1)
        obj = TestConfig2(b=2)
        self.assertEqual(obj.b, 2)

    def test_default(self):
        obj = TestConfigurable()
        self.assertIsInstance(obj, TestConfig1)
        self.assertIs(obj.a, None)

        obj = TestConfigurable(a=1)
        self.assertIsInstance(obj, TestConfig1)
        self.assertEqual(obj.a, 1)

        self.checkSubclasses()

    def test_config_class(self):
        TestConfigurable.configure(TestConfig2)
        obj = TestConfigurable()
        self.assertIsInstance(obj, TestConfig2)
        self.assertIs(obj.b, None)

        obj = TestConfigurable(b=2)
        self.assertIsInstance(obj, TestConfig2)
        self.assertEqual(obj.b, 2)

        self.checkSubclasses()

    def test_config_args(self):
        TestConfigurable.configure(None, a=3)
        obj = TestConfigurable()
        self.assertIsInstance(obj, TestConfig1)
        self.assertEqual(obj.a, 3)

        obj = TestConfigurable(42, a=4)
        self.assertIsInstance(obj, TestConfig1)
        self.assertEqual(obj.a, 4)
        self.assertEqual(obj.pos_arg, 42)

        self.checkSubclasses()
        # args bound in configure don't apply when using the subclass directly
        obj = TestConfig1()
        self.assertIs(obj.a, None)

    def test_config_class_args(self):
        TestConfigurable.configure(TestConfig2, b=5)
        obj = TestConfigurable()
        self.assertIsInstance(obj, TestConfig2)
        self.assertEqual(obj.b, 5)

        obj = TestConfigurable(42, b=6)
        self.assertIsInstance(obj, TestConfig2)
        self.assertEqual(obj.b, 6)
        self.assertEqual(obj.pos_arg, 42)

        self.checkSubclasses()
        # args bound in configure don't apply when using the subclass directly
        obj = TestConfig2()
        self.assertIs(obj.b, None)


class UnicodeLiteralTest(unittest.TestCase):
    def test_unicode_escapes(self):
        self.assertEqual(utf8(u('\u00e9')), b'\xc3\xa9')


class ExecInTest(unittest.TestCase):
    # This test is python 2 only because there are no new future imports
    # defined in python 3 yet.
    @unittest.skipIf(sys.version_info >= print_function.getMandatoryRelease(),
                     'no testable future imports')
    def test_no_inherit_future(self):
        # This file has from __future__ import print_function...
        f = StringIO()
        print('hello', file=f)
        # ...but the template doesn't
        exec_in('print >> f, "world"', dict(f=f))
        self.assertEqual(f.getvalue(), 'hello\nworld\n')


class ArgReplacerTest(unittest.TestCase):
    def setUp(self):
        def function(x, y, callback=None, z=None):
            pass
        self.replacer = ArgReplacer(function, 'callback')

    def test_omitted(self):
        args = (1, 2)
        kwargs = dict()
        self.assertIs(self.replacer.get_old_value(args, kwargs), None)
        self.assertEqual(self.replacer.replace('new', args, kwargs),
                         (None, (1, 2), dict(callback='new')))

    def test_position(self):
        args = (1, 2, 'old', 3)
        kwargs = dict()
        self.assertEqual(self.replacer.get_old_value(args, kwargs), 'old')
        self.assertEqual(self.replacer.replace('new', args, kwargs),
                         ('old', [1, 2, 'new', 3], dict()))

    def test_keyword(self):
        args = (1,)
        kwargs = dict(y=2, callback='old', z=3)
        self.assertEqual(self.replacer.get_old_value(args, kwargs), 'old')
        self.assertEqual(self.replacer.replace('new', args, kwargs),
                         ('old', (1,), dict(y=2, callback='new', z=3)))


class TimedeltaToSecondsTest(unittest.TestCase):
    def test_timedelta_to_seconds(self):
        time_delta = datetime.timedelta(hours=1)
        self.assertEqual(timedelta_to_seconds(time_delta), 3600.0)


class ImportObjectTest(unittest.TestCase):
    def test_import_member(self):
        self.assertIs(import_object('tornado.escape.utf8'), utf8)

    def test_import_member_unicode(self):
        self.assertIs(import_object(u('tornado.escape.utf8')), utf8)

    def test_import_module(self):
        self.assertIs(import_object('tornado.escape'), tornado.escape)

    def test_import_module_unicode(self):
        # The internal implementation of __import__ differs depending on
        # whether the thing being imported is a module or not.
        # This variant requires a byte string in python 2.
        self.assertIs(import_object(u('tornado.escape')), tornado.escape)
