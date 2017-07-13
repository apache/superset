# Copyright (c) 2006, 2009-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import os
import platform
import site
import sys
import unittest

import pkg_resources
import six

import astroid
from astroid import exceptions
from astroid import manager
from astroid.tests import resources


BUILTINS = six.moves.builtins.__name__


def _get_file_from_object(obj):
    if platform.python_implementation() == 'Jython':
        return obj.__file__.split("$py.class")[0] + ".py"
    if sys.version_info > (3, 0):
        return obj.__file__
    if not obj.__file__.endswith(".py"):
        return obj.__file__[:-1]
    return obj.__file__


class AstroidManagerTest(resources.SysPathSetup,
                         resources.AstroidCacheSetupMixin,
                         unittest.TestCase):

    def setUp(self):
        super(AstroidManagerTest, self).setUp()
        self.manager = manager.AstroidManager()
        self.manager.clear_cache(self._builtins) # take care of borg

    def test_ast_from_file(self):
        filepath = unittest.__file__
        ast = self.manager.ast_from_file(filepath)
        self.assertEqual(ast.name, 'unittest')
        self.assertIn('unittest', self.manager.astroid_cache)

    def test_ast_from_file_cache(self):
        filepath = unittest.__file__
        self.manager.ast_from_file(filepath)
        ast = self.manager.ast_from_file('unhandledName', 'unittest')
        self.assertEqual(ast.name, 'unittest')
        self.assertIn('unittest', self.manager.astroid_cache)

    def test_ast_from_file_astro_builder(self):
        filepath = unittest.__file__
        ast = self.manager.ast_from_file(filepath, None, True, True)
        self.assertEqual(ast.name, 'unittest')
        self.assertIn('unittest', self.manager.astroid_cache)

    def test_ast_from_file_name_astro_builder_exception(self):
        self.assertRaises(exceptions.AstroidBuildingError,
                          self.manager.ast_from_file, 'unhandledName')

    def test_do_not_expose_main(self):
        obj = self.manager.ast_from_module_name('__main__')
        self.assertEqual(obj.name, '__main__')
        self.assertEqual(obj.items(), [])

    def test_ast_from_module_name(self):
        ast = self.manager.ast_from_module_name('unittest')
        self.assertEqual(ast.name, 'unittest')
        self.assertIn('unittest', self.manager.astroid_cache)

    def test_ast_from_module_name_not_python_source(self):
        ast = self.manager.ast_from_module_name('time')
        self.assertEqual(ast.name, 'time')
        self.assertIn('time', self.manager.astroid_cache)
        self.assertEqual(ast.pure_python, False)

    def test_ast_from_module_name_astro_builder_exception(self):
        self.assertRaises(exceptions.AstroidBuildingError,
                          self.manager.ast_from_module_name,
                          'unhandledModule')

    def _test_ast_from_old_namespace_package_protocol(self, root):
        origpath = sys.path[:]
        paths = [resources.find('data/path_{}_{}'.format(root, index))
                 for index in range(1, 4)]
        sys.path.extend(paths)
        try:
            for name in ('foo', 'bar', 'baz'):
                module = self.manager.ast_from_module_name('package.' + name)
                self.assertIsInstance(module, astroid.Module)
        finally:
            sys.path = origpath

    def test_ast_from_namespace_pkgutil(self):
        self._test_ast_from_old_namespace_package_protocol('pkgutil')

    def test_ast_from_namespace_pkg_resources(self):
        self._test_ast_from_old_namespace_package_protocol('pkg_resources')

    @unittest.skipUnless(sys.version_info[:2] > (3, 3), "Needs PEP 420 namespace protocol")
    def test_implicit_namespace_package(self):
        data_dir = os.path.dirname(resources.find('data/namespace_pep_420'))
        contribute = os.path.join(data_dir, 'contribute_to_namespace')
        for value in (data_dir, contribute):
            sys.path.insert(0, value)

        try:
            module = self.manager.ast_from_module_name('namespace_pep_420.module')
            self.assertIsInstance(module, astroid.Module)
            self.assertEqual(module.name, 'namespace_pep_420.module')
            var = next(module.igetattr('var'))
            self.assertIsInstance(var, astroid.Const)
            self.assertEqual(var.value, 42)
        finally:
            for _ in range(2):
                sys.path.pop(0)

    def test_namespace_package_pth_support(self):
        pth = 'foogle_fax-0.12.5-py2.7-nspkg.pth'
        site.addpackage(resources.RESOURCE_PATH, pth, [])
        # pylint: disable=no-member; can't infer _namespace_packages, created at runtime.
        pkg_resources._namespace_packages['foogle'] = []

        try:
            module = self.manager.ast_from_module_name('foogle.fax')
            submodule = next(module.igetattr('a'))
            value = next(submodule.igetattr('x'))
            self.assertIsInstance(value, astroid.Const)
            with self.assertRaises(exceptions.AstroidImportError):
                self.manager.ast_from_module_name('foogle.moogle')
        finally:
            del pkg_resources._namespace_packages['foogle']
            sys.modules.pop('foogle')

    def _test_ast_from_zip(self, archive):
        origpath = sys.path[:]
        sys.modules.pop('mypypa', None)
        archive_path = resources.find(archive)
        sys.path.insert(0, archive_path)
        try:
            module = self.manager.ast_from_module_name('mypypa')
            self.assertEqual(module.name, 'mypypa')
            end = os.path.join(archive, 'mypypa')
            self.assertTrue(module.file.endswith(end),
                            "%s doesn't endswith %s" % (module.file, end))
        finally:
            # remove the module, else after importing egg, we don't get the zip
            if 'mypypa' in self.manager.astroid_cache:
                del self.manager.astroid_cache['mypypa']
                del self.manager._mod_file_cache[('mypypa', None)]
            if archive_path in sys.path_importer_cache:
                del sys.path_importer_cache[archive_path]
            sys.path = origpath

    def test_ast_from_module_name_egg(self):
        self._test_ast_from_zip(
            os.path.sep.join(['data', os.path.normcase('MyPyPa-0.1.0-py2.5.egg')])
        )

    def test_ast_from_module_name_zip(self):
        self._test_ast_from_zip(
            os.path.sep.join(['data', os.path.normcase('MyPyPa-0.1.0-py2.5.zip')])
        )

    def test_zip_import_data(self):
        """check if zip_import_data works"""
        filepath = resources.find('data/MyPyPa-0.1.0-py2.5.zip/mypypa')
        ast = self.manager.zip_import_data(filepath)
        self.assertEqual(ast.name, 'mypypa')

    def test_zip_import_data_without_zipimport(self):
        """check if zip_import_data return None without zipimport"""
        self.assertEqual(self.manager.zip_import_data('path'), None)

    def test_file_from_module(self):
        """check if the unittest filepath is equals to the result of the method"""
        self.assertEqual(
            _get_file_from_object(unittest),
            # pylint: disable=no-member; can't infer the ModuleSpec
            self.manager.file_from_module_name('unittest', None).location)

    def test_file_from_module_name_astro_building_exception(self):
        """check if the method launch a exception with a wrong module name"""
        self.assertRaises(exceptions.AstroidBuildingError,
                          self.manager.file_from_module_name, 'unhandledModule', None)

    def test_ast_from_module(self):
        ast = self.manager.ast_from_module(unittest)
        self.assertEqual(ast.pure_python, True)
        import time
        ast = self.manager.ast_from_module(time)
        self.assertEqual(ast.pure_python, False)

    def test_ast_from_module_cache(self):
        """check if the module is in the cache manager"""
        ast = self.manager.ast_from_module(unittest)
        self.assertEqual(ast.name, 'unittest')
        self.assertIn('unittest', self.manager.astroid_cache)

    def test_ast_from_class(self):
        ast = self.manager.ast_from_class(int)
        self.assertEqual(ast.name, 'int')
        self.assertEqual(ast.parent.frame().name, BUILTINS)

        ast = self.manager.ast_from_class(object)
        self.assertEqual(ast.name, 'object')
        self.assertEqual(ast.parent.frame().name, BUILTINS)
        self.assertIn('__setattr__', ast)

    def test_ast_from_class_with_module(self):
        """check if the method works with the module name"""
        ast = self.manager.ast_from_class(int, int.__module__)
        self.assertEqual(ast.name, 'int')
        self.assertEqual(ast.parent.frame().name, BUILTINS)

        ast = self.manager.ast_from_class(object, object.__module__)
        self.assertEqual(ast.name, 'object')
        self.assertEqual(ast.parent.frame().name, BUILTINS)
        self.assertIn('__setattr__', ast)

    def test_ast_from_class_attr_error(self):
        """give a wrong class at the ast_from_class method"""
        self.assertRaises(exceptions.AstroidBuildingError,
                          self.manager.ast_from_class, None)

    def testFailedImportHooks(self):
        def hook(modname):
            if modname == 'foo.bar':
                return unittest
            else:
                raise exceptions.AstroidBuildingError()

        with self.assertRaises(exceptions.AstroidBuildingError):
            self.manager.ast_from_module_name('foo.bar')
        self.manager.register_failed_import_hook(hook)
        self.assertEqual(unittest, self.manager.ast_from_module_name('foo.bar'))
        with self.assertRaises(exceptions.AstroidBuildingError):
            self.manager.ast_from_module_name('foo.bar.baz')
        del self.manager._failed_import_hooks[0]


class BorgAstroidManagerTC(unittest.TestCase):

    def test_borg(self):
        """test that the AstroidManager is really a borg, i.e. that two different
        instances has same cache"""
        first_manager = manager.AstroidManager()
        built = first_manager.ast_from_module_name(BUILTINS)

        second_manager = manager.AstroidManager()
        second_built = second_manager.ast_from_module_name(BUILTINS)
        self.assertIs(built, second_built)


if __name__ == '__main__':
    unittest.main()
