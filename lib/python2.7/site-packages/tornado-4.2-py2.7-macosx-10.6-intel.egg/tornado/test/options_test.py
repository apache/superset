# -*- coding: utf-8 -*-
from __future__ import absolute_import, division, print_function, with_statement

import datetime
import os
import sys

from tornado.options import OptionParser, Error
from tornado.util import basestring_type
from tornado.test.util import unittest

try:
    from cStringIO import StringIO  # python 2
except ImportError:
    from io import StringIO  # python 3

try:
    from unittest import mock  # python 3.3
except ImportError:
    try:
        import mock  # third-party mock package
    except ImportError:
        mock = None


class OptionsTest(unittest.TestCase):
    def test_parse_command_line(self):
        options = OptionParser()
        options.define("port", default=80)
        options.parse_command_line(["main.py", "--port=443"])
        self.assertEqual(options.port, 443)

    def test_parse_config_file(self):
        options = OptionParser()
        options.define("port", default=80)
        options.define("username", default='foo')
        options.parse_config_file(os.path.join(os.path.dirname(__file__),
                                               "options_test.cfg"))
        self.assertEquals(options.port, 443)
        self.assertEqual(options.username, "李康")

    def test_parse_callbacks(self):
        options = OptionParser()
        self.called = False

        def callback():
            self.called = True
        options.add_parse_callback(callback)

        # non-final parse doesn't run callbacks
        options.parse_command_line(["main.py"], final=False)
        self.assertFalse(self.called)

        # final parse does
        options.parse_command_line(["main.py"])
        self.assertTrue(self.called)

        # callbacks can be run more than once on the same options
        # object if there are multiple final parses
        self.called = False
        options.parse_command_line(["main.py"])
        self.assertTrue(self.called)

    def test_help(self):
        options = OptionParser()
        try:
            orig_stderr = sys.stderr
            sys.stderr = StringIO()
            with self.assertRaises(SystemExit):
                options.parse_command_line(["main.py", "--help"])
            usage = sys.stderr.getvalue()
        finally:
            sys.stderr = orig_stderr
        self.assertIn("Usage:", usage)

    def test_subcommand(self):
        base_options = OptionParser()
        base_options.define("verbose", default=False)
        sub_options = OptionParser()
        sub_options.define("foo", type=str)
        rest = base_options.parse_command_line(
            ["main.py", "--verbose", "subcommand", "--foo=bar"])
        self.assertEqual(rest, ["subcommand", "--foo=bar"])
        self.assertTrue(base_options.verbose)
        rest2 = sub_options.parse_command_line(rest)
        self.assertEqual(rest2, [])
        self.assertEqual(sub_options.foo, "bar")

        # the two option sets are distinct
        try:
            orig_stderr = sys.stderr
            sys.stderr = StringIO()
            with self.assertRaises(Error):
                sub_options.parse_command_line(["subcommand", "--verbose"])
        finally:
            sys.stderr = orig_stderr

    def test_setattr(self):
        options = OptionParser()
        options.define('foo', default=1, type=int)
        options.foo = 2
        self.assertEqual(options.foo, 2)

    def test_setattr_type_check(self):
        # setattr requires that options be the right type and doesn't
        # parse from string formats.
        options = OptionParser()
        options.define('foo', default=1, type=int)
        with self.assertRaises(Error):
            options.foo = '2'

    def test_setattr_with_callback(self):
        values = []
        options = OptionParser()
        options.define('foo', default=1, type=int, callback=values.append)
        options.foo = 2
        self.assertEqual(values, [2])

    def _sample_options(self):
        options = OptionParser()
        options.define('a', default=1)
        options.define('b', default=2)
        return options

    def test_iter(self):
        options = self._sample_options()
        # OptionParsers always define 'help'.
        self.assertEqual(set(['a', 'b', 'help']), set(iter(options)))

    def test_getitem(self):
        options = self._sample_options()
        self.assertEqual(1, options['a'])

    def test_items(self):
        options = self._sample_options()
        # OptionParsers always define 'help'.
        expected = [('a', 1), ('b', 2), ('help', options.help)]
        actual = sorted(options.items())
        self.assertEqual(expected, actual)

    def test_as_dict(self):
        options = self._sample_options()
        expected = {'a': 1, 'b': 2, 'help': options.help}
        self.assertEqual(expected, options.as_dict())

    def test_group_dict(self):
        options = OptionParser()
        options.define('a', default=1)
        options.define('b', group='b_group', default=2)

        frame = sys._getframe(0)
        this_file = frame.f_code.co_filename
        self.assertEqual(set(['b_group', '', this_file]), options.groups())

        b_group_dict = options.group_dict('b_group')
        self.assertEqual({'b': 2}, b_group_dict)

        self.assertEqual({}, options.group_dict('nonexistent'))

    @unittest.skipIf(mock is None, 'mock package not present')
    def test_mock_patch(self):
        # ensure that our setattr hooks don't interfere with mock.patch
        options = OptionParser()
        options.define('foo', default=1)
        options.parse_command_line(['main.py', '--foo=2'])
        self.assertEqual(options.foo, 2)

        with mock.patch.object(options.mockable(), 'foo', 3):
            self.assertEqual(options.foo, 3)
        self.assertEqual(options.foo, 2)

        # Try nested patches mixed with explicit sets
        with mock.patch.object(options.mockable(), 'foo', 4):
            self.assertEqual(options.foo, 4)
            options.foo = 5
            self.assertEqual(options.foo, 5)
            with mock.patch.object(options.mockable(), 'foo', 6):
                self.assertEqual(options.foo, 6)
            self.assertEqual(options.foo, 5)
        self.assertEqual(options.foo, 2)

    def test_types(self):
        options = OptionParser()
        options.define('str', type=str)
        options.define('basestring', type=basestring_type)
        options.define('int', type=int)
        options.define('float', type=float)
        options.define('datetime', type=datetime.datetime)
        options.define('timedelta', type=datetime.timedelta)
        options.parse_command_line(['main.py',
                                    '--str=asdf',
                                    '--basestring=qwer',
                                    '--int=42',
                                    '--float=1.5',
                                    '--datetime=2013-04-28 05:16',
                                    '--timedelta=45s'])
        self.assertEqual(options.str, 'asdf')
        self.assertEqual(options.basestring, 'qwer')
        self.assertEqual(options.int, 42)
        self.assertEqual(options.float, 1.5)
        self.assertEqual(options.datetime,
                         datetime.datetime(2013, 4, 28, 5, 16))
        self.assertEqual(options.timedelta, datetime.timedelta(seconds=45))

    def test_multiple_string(self):
        options = OptionParser()
        options.define('foo', type=str, multiple=True)
        options.parse_command_line(['main.py', '--foo=a,b,c'])
        self.assertEqual(options.foo, ['a', 'b', 'c'])

    def test_multiple_int(self):
        options = OptionParser()
        options.define('foo', type=int, multiple=True)
        options.parse_command_line(['main.py', '--foo=1,3,5:7'])
        self.assertEqual(options.foo, [1, 3, 5, 6, 7])

    def test_error_redefine(self):
        options = OptionParser()
        options.define('foo')
        with self.assertRaises(Error) as cm:
            options.define('foo')
        self.assertRegexpMatches(str(cm.exception),
                                 'Option.*foo.*already defined')
