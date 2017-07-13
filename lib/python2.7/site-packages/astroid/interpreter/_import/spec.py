# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

import abc
import collections
import enum
import imp
import os
import sys
import zipimport
try:
    import importlib.machinery
    _HAS_MACHINERY = True
except ImportError:
    _HAS_MACHINERY = False

try:
    from functools import lru_cache
except ImportError:
    from backports.functools_lru_cache import lru_cache

from . import util

ModuleType = enum.Enum('ModuleType', 'C_BUILTIN C_EXTENSION PKG_DIRECTORY '
                                     'PY_CODERESOURCE PY_COMPILED PY_FROZEN PY_RESOURCE '
                                     'PY_SOURCE PY_ZIPMODULE PY_NAMESPACE')
_ImpTypes = {imp.C_BUILTIN: ModuleType.C_BUILTIN,
             imp.C_EXTENSION: ModuleType.C_EXTENSION,
             imp.PKG_DIRECTORY: ModuleType.PKG_DIRECTORY,
             imp.PY_COMPILED: ModuleType.PY_COMPILED,
             imp.PY_FROZEN: ModuleType.PY_FROZEN,
             imp.PY_SOURCE: ModuleType.PY_SOURCE,
            }
if hasattr(imp, 'PY_RESOURCE'):
    _ImpTypes[imp.PY_RESOURCE] = ModuleType.PY_RESOURCE
if hasattr(imp, 'PY_CODERESOURCE'):
    _ImpTypes[imp.PY_CODERESOURCE] = ModuleType.PY_CODERESOURCE

def _imp_type_to_module_type(imp_type):
    return _ImpTypes[imp_type]

_ModuleSpec = collections.namedtuple('_ModuleSpec', 'name type location '
                                                    'origin submodule_search_locations')

class ModuleSpec(_ModuleSpec):
    """Defines a class similar to PEP 420's ModuleSpec

    A module spec defines a name of a module, its type, location
    and where submodules can be found, if the module is a package.
    """

    def __new__(cls, name, module_type, location=None, origin=None,
                submodule_search_locations=None):
        return _ModuleSpec.__new__(cls, name=name, type=module_type,
                                   location=location, origin=origin,
                                   submodule_search_locations=submodule_search_locations)


class Finder(object):
    """A finder is a class which knows how to find a particular module."""

    def __init__(self, path=None):
        self._path = path or sys.path

    @abc.abstractmethod
    def find_module(self, modname, module_parts, processed, submodule_path):
        """Find the given module

        Each finder is responsible for each protocol of finding, as long as
        they all return a ModuleSpec.

        :param str modname: The module which needs to be searched.
        :param list module_parts: It should be a list of strings,
                                  where each part contributes to the module's
                                  namespace.
        :param list processed: What parts from the module parts were processed
                               so far.
        :param list submodule_path: A list of paths where the module
                                    can be looked into.
        :returns: A ModuleSpec, describing how and where the module was found,
                  None, otherwise.
        """

    def contribute_to_path(self, spec, processed):
        """Get a list of extra paths where this finder can search."""


class ImpFinder(Finder):
    """A finder based on the imp module."""

    def find_module(self, modname, module_parts, processed, submodule_path):
        if submodule_path is not None:
            submodule_path = list(submodule_path)
        try:
            stream, mp_filename, mp_desc = imp.find_module(modname, submodule_path)
        except ImportError:
            return None

        # Close resources.
        if stream:
            stream.close()

        return ModuleSpec(name=modname, location=mp_filename,
                          module_type=_imp_type_to_module_type(mp_desc[2]))

    def contribute_to_path(self, spec, processed):
        if spec.location is None:
            # Builtin.
            return None

        if _is_setuptools_namespace(spec.location):
            # extend_path is called, search sys.path for module/packages
            # of this name see pkgutil.extend_path documentation
            path = [os.path.join(p, *processed) for p in sys.path
                    if os.path.isdir(os.path.join(p, *processed))]
        else:
            path = [spec.location]
        return path


class ExplicitNamespacePackageFinder(ImpFinder):
    """A finder for the explicit namespace packages, generated through pkg_resources."""

    def find_module(self, modname, module_parts, processed, submodule_path):
        if util.is_namespace(modname) and modname in sys.modules:
            submodule_path = sys.modules[modname].__path__
            return ModuleSpec(name=modname, location='',
                              origin='namespace',
                              module_type=ModuleType.PY_NAMESPACE,
                              submodule_search_locations=submodule_path)


    def contribute_to_path(self, spec, processed):
        return spec.submodule_search_locations


class ZipFinder(Finder):
    """Finder that knows how to find a module inside zip files."""

    def __init__(self, path):
        super(ZipFinder, self).__init__(path)
        self._zipimporters = _precache_zipimporters(path)

    def find_module(self, modname, module_parts, processed, submodule_path):
        try:
            file_type, filename, path = _search_zip(module_parts, self._zipimporters)
        except ImportError:
            return None

        return ModuleSpec(name=modname, location=filename,
                          origin='egg', module_type=file_type,
                          submodule_search_locations=path)


class PathSpecFinder(Finder):
    """Finder based on importlib.machinery.PathFinder."""

    def find_module(self, modname, module_parts, processed, submodule_path):
        spec = importlib.machinery.PathFinder.find_spec(modname, path=submodule_path)
        if spec:
            location = spec.origin if spec.origin != 'namespace' else None
            module_type = ModuleType.PY_NAMESPACE if spec.origin == 'namespace' else None
            spec = ModuleSpec(name=spec.name, location=location,
                              origin=spec.origin, module_type=module_type,
                              submodule_search_locations=list(spec.submodule_search_locations
                                                              or []))
        return spec

    def contribute_to_path(self, spec, processed):
        if spec.type == ModuleType.PY_NAMESPACE:
            return spec.submodule_search_locations
        return None


_SPEC_FINDERS = (
    ImpFinder,
    ZipFinder,
)
if _HAS_MACHINERY and sys.version_info[:2] > (3, 3):
    _SPEC_FINDERS += (PathSpecFinder, )
_SPEC_FINDERS += (ExplicitNamespacePackageFinder, )


def _is_setuptools_namespace(location):
    try:
        with open(os.path.join(location, '__init__.py'), 'rb') as stream:
            data = stream.read(4096)
    except IOError:
        pass
    else:
        extend_path = b'pkgutil' in data and b'extend_path' in data
        declare_namespace = (
            b"pkg_resources" in data
            and b"declare_namespace(__name__)" in data)
        return extend_path or declare_namespace


@lru_cache()
def _cached_set_diff(left, right):
    result = set(left)
    result.difference_update(right)
    return result


def _precache_zipimporters(path=None):
    pic = sys.path_importer_cache

    # When measured, despite having the same complexity (O(n)),
    # converting to tuples and then caching the conversion to sets
    # and the set difference is faster than converting to sets
    # and then only caching the set difference.

    req_paths = tuple(path or sys.path)
    cached_paths = tuple(pic)
    new_paths = _cached_set_diff(req_paths, cached_paths)
    for entry_path in new_paths:
        try:
            pic[entry_path] = zipimport.zipimporter(entry_path)
        except zipimport.ZipImportError:
            continue
    return pic


def _search_zip(modpath, pic):
    for filepath, importer in list(pic.items()):
        if importer is not None:
            found = importer.find_module(modpath[0])
            if found:
                if not importer.find_module(os.path.sep.join(modpath)):
                    raise ImportError('No module named %s in %s/%s' % (
                        '.'.join(modpath[1:]), filepath, modpath))
                #import code; code.interact(local=locals())
                return (ModuleType.PY_ZIPMODULE,
                        os.path.abspath(filepath) + os.path.sep + os.path.sep.join(modpath),
                        filepath)
    raise ImportError('No module named %s' % '.'.join(modpath))


def _find_spec_with_path(search_path, modname, module_parts, processed, submodule_path):
    finders = [finder(search_path) for finder in _SPEC_FINDERS]
    for finder in finders:
        spec = finder.find_module(modname, module_parts, processed, submodule_path)
        if spec is None:
            continue
        return finder, spec

    raise ImportError('No module named %s' % '.'.join(module_parts))


def find_spec(modpath, path=None):
    """Find a spec for the given module.

    :type modpath: list or tuple
    :param modpath:
      split module's name (i.e name of a module or package split
      on '.'), with leading empty strings for explicit relative import

    :type path: list or None
    :param path:
      optional list of path where the module or package should be
      searched (use sys.path if nothing or None is given)

    :rtype: ModuleSpec
    :return: A module spec, which describes how the module was
             found and where.
    """
    _path = path or sys.path

    # Need a copy for not mutating the argument.
    modpath = modpath[:]

    submodule_path = None
    module_parts = modpath[:]
    processed = []

    while modpath:
        modname = modpath.pop(0)
        finder, spec = _find_spec_with_path(_path, modname,
                                            module_parts, processed,
                                            submodule_path or path)
        processed.append(modname)
        if modpath:
            submodule_path = finder.contribute_to_path(spec, processed)

        if spec.type == ModuleType.PKG_DIRECTORY:
            spec = spec._replace(submodule_search_locations=submodule_path)

    return spec
