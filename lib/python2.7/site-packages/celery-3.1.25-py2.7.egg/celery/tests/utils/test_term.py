# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import sys

from celery.utils import term
from celery.utils.term import colored, fg
from celery.five import text_t

from celery.tests.case import Case, SkipTest


class test_colored(Case):

    def setUp(self):
        if sys.platform == 'win32':
            raise SkipTest('Colors not supported on Windows')

        self._prev_encoding = sys.getdefaultencoding

        def getdefaultencoding():
            return 'utf-8'

        sys.getdefaultencoding = getdefaultencoding

    def tearDown(self):
        sys.getdefaultencoding = self._prev_encoding

    def test_colors(self):
        colors = (
            ('black', term.BLACK),
            ('red', term.RED),
            ('green', term.GREEN),
            ('yellow', term.YELLOW),
            ('blue', term.BLUE),
            ('magenta', term.MAGENTA),
            ('cyan', term.CYAN),
            ('white', term.WHITE),
        )

        for name, key in colors:
            self.assertIn(fg(30 + key), str(colored().names[name]('foo')))

        self.assertTrue(str(colored().bold('f')))
        self.assertTrue(str(colored().underline('f')))
        self.assertTrue(str(colored().blink('f')))
        self.assertTrue(str(colored().reverse('f')))
        self.assertTrue(str(colored().bright('f')))
        self.assertTrue(str(colored().ired('f')))
        self.assertTrue(str(colored().igreen('f')))
        self.assertTrue(str(colored().iyellow('f')))
        self.assertTrue(str(colored().iblue('f')))
        self.assertTrue(str(colored().imagenta('f')))
        self.assertTrue(str(colored().icyan('f')))
        self.assertTrue(str(colored().iwhite('f')))
        self.assertTrue(str(colored().reset('f')))

        self.assertTrue(text_t(colored().green('∂bar')))

        self.assertTrue(
            colored().red('éefoo') + colored().green('∂bar'))

        self.assertEqual(
            colored().red('foo').no_color(), 'foo')

        self.assertTrue(
            repr(colored().blue('åfoo')))

        self.assertIn("''", repr(colored()))

        c = colored()
        s = c.red('foo', c.blue('bar'), c.green('baz'))
        self.assertTrue(s.no_color())

        c._fold_no_color(s, 'øfoo')
        c._fold_no_color('fooå', s)

        c = colored().red('åfoo')
        self.assertEqual(
            c._add(c, 'baræ'),
            '\x1b[1;31m\xe5foo\x1b[0mbar\xe6',
        )

        c2 = colored().blue('ƒƒz')
        c3 = c._add(c, c2)
        self.assertEqual(
            c3,
            '\x1b[1;31m\xe5foo\x1b[0m\x1b[1;34m\u0192\u0192z\x1b[0m',
        )
