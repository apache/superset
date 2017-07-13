from __future__ import absolute_import

from celery.utils.imports import (
    qualname,
    reload_from_cwd,
    module_file,
    find_module,
    NotAPackage,
)

from celery.tests.case import Case, Mock, patch


class test_import_utils(Case):

    def test_find_module(self):
        self.assertTrue(find_module('celery'))
        imp = Mock()
        imp.return_value = None
        with self.assertRaises(NotAPackage):
            find_module('foo.bar.baz', imp=imp)

    def test_qualname(self):
        Class = type('Fox', (object, ), {'__module__': 'quick.brown'})
        self.assertEqual(qualname(Class), 'quick.brown.Fox')
        self.assertEqual(qualname(Class()), 'quick.brown.Fox')

    @patch('celery.utils.imports.reload')
    def test_reload_from_cwd(self, reload):
        reload_from_cwd('foo')
        self.assertTrue(reload.called)

    def test_reload_from_cwd_custom_reloader(self):
        reload = Mock()
        reload_from_cwd('foo', reload)
        self.assertTrue(reload.called)

    def test_module_file(self):
        m1 = Mock()
        m1.__file__ = '/opt/foo/xyz.pyc'
        self.assertEqual(module_file(m1), '/opt/foo/xyz.py')
        m2 = Mock()
        m2.__file__ = '/opt/foo/xyz.py'
        self.assertEqual(module_file(m1), '/opt/foo/xyz.py')
