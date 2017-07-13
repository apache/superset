# Copyright (c) 2006-2011, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""astroid manager: avoid multiple astroid build of a same module when
possible by providing a class responsible to get astroid representation
from various source and using a cache of built modules)
"""

import os
import sys
import zipimport

import six

from astroid import exceptions
from astroid.interpreter._import import spec
from astroid import modutils
from astroid import transforms
from astroid import util


def safe_repr(obj):
    try:
        return repr(obj)
    except Exception: # pylint: disable=broad-except
        return '???'


class AstroidManager(object):
    """the astroid manager, responsible to build astroid from files
     or modules.

    Use the Borg pattern.
    """

    name = 'astroid loader'
    brain = {}

    def __init__(self):
        self.__dict__ = AstroidManager.brain
        if not self.__dict__:
            # NOTE: cache entries are added by the [re]builder
            self.astroid_cache = {}
            self._mod_file_cache = {}
            self._failed_import_hooks = []
            self.always_load_extensions = False
            self.optimize_ast = False
            self.extension_package_whitelist = set()
            self._transform = transforms.TransformVisitor()

            # Export these APIs for convenience
            self.register_transform = self._transform.register_transform
            self.unregister_transform = self._transform.unregister_transform

    def visit_transforms(self, node):
        """Visit the transforms and apply them to the given *node*."""
        return self._transform.visit(node)

    def ast_from_file(self, filepath, modname=None, fallback=True, source=False):
        """given a module name, return the astroid object"""
        try:
            filepath = modutils.get_source_file(filepath, include_no_ext=True)
            source = True
        except modutils.NoSourceFile:
            pass
        if modname is None:
            try:
                modname = '.'.join(modutils.modpath_from_file(filepath))
            except ImportError:
                modname = filepath
        if modname in self.astroid_cache and self.astroid_cache[modname].file == filepath:
            return self.astroid_cache[modname]
        if source:
            from astroid.builder import AstroidBuilder
            return AstroidBuilder(self).file_build(filepath, modname)
        elif fallback and modname:
            return self.ast_from_module_name(modname)
        raise exceptions.AstroidBuildingError(
            'Unable to build an AST for {path}.', path=filepath)

    def _build_stub_module(self, modname):
        from astroid.builder import AstroidBuilder
        return AstroidBuilder(self).string_build('', modname)

    def _build_namespace_module(self, modname, path):
        from astroid.builder import build_namespace_package_module
        return build_namespace_package_module(modname, path)

    def _can_load_extension(self, modname):
        if self.always_load_extensions:
            return True
        if modutils.is_standard_module(modname):
            return True
        parts = modname.split('.')
        return any(
            '.'.join(parts[:x]) in self.extension_package_whitelist
            for x in range(1, len(parts) + 1))

    def ast_from_module_name(self, modname, context_file=None):
        """given a module name, return the astroid object"""
        if modname in self.astroid_cache:
            return self.astroid_cache[modname]
        if modname == '__main__':
            return self._build_stub_module(modname)
        old_cwd = os.getcwd()
        if context_file:
            os.chdir(os.path.dirname(context_file))
        try:
            found_spec = self.file_from_module_name(modname, context_file)
            # pylint: disable=no-member
            if found_spec.type == spec.ModuleType.PY_ZIPMODULE:
                # pylint: disable=no-member
                module = self.zip_import_data(found_spec.location)
                if module is not None:
                    return module

            elif found_spec.type in (spec.ModuleType.C_BUILTIN,
                                     spec.ModuleType.C_EXTENSION):
                # pylint: disable=no-member
                if (found_spec.type == spec.ModuleType.C_EXTENSION
                        and not self._can_load_extension(modname)):
                    return self._build_stub_module(modname)
                try:
                    module = modutils.load_module_from_name(modname)
                except Exception as ex: # pylint: disable=broad-except
                    util.reraise(exceptions.AstroidImportError(
                        'Loading {modname} failed with:\n{error}',
                        modname=modname, path=found_spec.location, error=ex))
                return self.ast_from_module(module, modname)

            elif found_spec.type == spec.ModuleType.PY_COMPILED:
                raise exceptions.AstroidImportError(
                    "Unable to load compiled module {modname}.",
                    # pylint: disable=no-member
                    modname=modname, path=found_spec.location)

            elif found_spec.type == spec.ModuleType.PY_NAMESPACE:
                return self._build_namespace_module(modname,
                                                    # pylint: disable=no-member
                                                    found_spec.submodule_search_locations)

            # pylint: disable=no-member
            if found_spec.location is None:
                raise exceptions.AstroidImportError(
                    "Can't find a file for module {modname}.",
                    modname=modname)

            # pylint: disable=no-member
            return self.ast_from_file(found_spec.location, modname, fallback=False)
        except exceptions.AstroidBuildingError as e:
            for hook in self._failed_import_hooks:
                try:
                    return hook(modname)
                except exceptions.AstroidBuildingError:
                    pass
            raise e
        finally:
            os.chdir(old_cwd)

    def zip_import_data(self, filepath):
        if zipimport is None:
            return None
        from astroid.builder import AstroidBuilder
        builder = AstroidBuilder(self)
        for ext in ('.zip', '.egg'):
            try:
                eggpath, resource = filepath.rsplit(ext + os.path.sep, 1)
            except ValueError:
                continue
            try:
                importer = zipimport.zipimporter(eggpath + ext)
                zmodname = resource.replace(os.path.sep, '.')
                if importer.is_package(resource):
                    zmodname = zmodname + '.__init__'
                module = builder.string_build(importer.get_source(resource),
                                              zmodname, filepath)
                return module
            except Exception: # pylint: disable=broad-except
                continue
        return None

    def file_from_module_name(self, modname, contextfile):
        try:
            value = self._mod_file_cache[(modname, contextfile)]
            traceback = sys.exc_info()[2]
        except KeyError:
            try:
                value = modutils.file_info_from_modpath(
                    modname.split('.'), context_file=contextfile)
                traceback = sys.exc_info()[2]
            except ImportError as ex:
                value = exceptions.AstroidImportError(
                    'Failed to import module {modname} with error:\n{error}.',
                    modname=modname, error=ex)
                traceback = sys.exc_info()[2]
            self._mod_file_cache[(modname, contextfile)] = value
        if isinstance(value, exceptions.AstroidBuildingError):
            six.reraise(exceptions.AstroidBuildingError,
                        value, traceback)
        return value

    def ast_from_module(self, module, modname=None):
        """given an imported module, return the astroid object"""
        modname = modname or module.__name__
        if modname in self.astroid_cache:
            return self.astroid_cache[modname]
        try:
            # some builtin modules don't have __file__ attribute
            filepath = module.__file__
            if modutils.is_python_source(filepath):
                return self.ast_from_file(filepath, modname)
        except AttributeError:
            pass
        from astroid.builder import AstroidBuilder
        return AstroidBuilder(self).module_build(module, modname)

    def ast_from_class(self, klass, modname=None):
        """get astroid for the given class"""
        if modname is None:
            try:
                modname = klass.__module__
            except AttributeError:
                util.reraise(exceptions.AstroidBuildingError(
                    'Unable to get module for class {class_name}.',
                    cls=klass, class_repr=safe_repr(klass), modname=modname))
        modastroid = self.ast_from_module_name(modname)
        return modastroid.getattr(klass.__name__)[0] # XXX

    def infer_ast_from_something(self, obj, context=None):
        """infer astroid for the given class"""
        if hasattr(obj, '__class__') and not isinstance(obj, type):
            klass = obj.__class__
        else:
            klass = obj
        try:
            modname = klass.__module__
        except AttributeError:
            util.reraise(exceptions.AstroidBuildingError(
                'Unable to get module for {class_repr}.',
                cls=klass, class_repr=safe_repr(klass)))
        except Exception as ex: # pylint: disable=broad-except
            util.reraise(exceptions.AstroidImportError(
                'Unexpected error while retrieving module for {class_repr}:\n'
                '{error}', cls=klass, class_repr=safe_repr(klass), error=ex))
        try:
            name = klass.__name__
        except AttributeError:
            util.reraise(exceptions.AstroidBuildingError(
                'Unable to get name for {class_repr}:\n',
                cls=klass, class_repr=safe_repr(klass)))
        except Exception as ex: # pylint: disable=broad-except
            util.reraise(exceptions.AstroidImportError(
                'Unexpected error while retrieving name for {class_repr}:\n'
                '{error}', cls=klass, class_repr=safe_repr(klass), error=ex))
        # take care, on living object __module__ is regularly wrong :(
        modastroid = self.ast_from_module_name(modname)
        if klass is obj:
            for inferred in modastroid.igetattr(name, context):
                yield inferred
        else:
            for inferred in modastroid.igetattr(name, context):
                yield inferred.instantiate_class()

    def register_failed_import_hook(self, hook):
        """Registers a hook to resolve imports that cannot be found otherwise.

        `hook` must be a function that accepts a single argument `modname` which
        contains the name of the module or package that could not be imported.
        If `hook` can resolve the import, must return a node of type `astroid.Module`,
        otherwise, it must raise `AstroidBuildingError`.
        """
        self._failed_import_hooks.append(hook)

    def cache_module(self, module):
        """Cache a module if no module with the same name is known yet."""
        self.astroid_cache.setdefault(module.name, module)

    def clear_cache(self, astroid_builtin=None):
        # XXX clear transforms
        self.astroid_cache.clear()
        # force bootstrap again, else we may ends up with cache inconsistency
        # between the manager and CONST_PROXY, making
        # unittest_lookup.LookupTC.test_builtin_lookup fail depending on the
        # test order
        import astroid.raw_building
        astroid.raw_building._astroid_bootstrapping(
            astroid_builtin=astroid_builtin)
