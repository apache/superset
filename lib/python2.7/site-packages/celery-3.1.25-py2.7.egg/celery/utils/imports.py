# -*- coding: utf-8 -*-
"""
    celery.utils.import
    ~~~~~~~~~~~~~~~~~~~

    Utilities related to importing modules and symbols by name.

"""
from __future__ import absolute_import

import imp as _imp
import importlib
import os
import sys

from contextlib import contextmanager

from kombu.utils import symbol_by_name

from celery.five import reload

__all__ = [
    'NotAPackage', 'qualname', 'instantiate', 'symbol_by_name', 'cwd_in_path',
    'find_module', 'import_from_cwd', 'reload_from_cwd', 'module_file',
]


class NotAPackage(Exception):
    pass


if sys.version_info > (3, 3):  # pragma: no cover
    def qualname(obj):
        if not hasattr(obj, '__name__') and hasattr(obj, '__class__'):
            obj = obj.__class__
        q = getattr(obj, '__qualname__', None)
        if '.' not in q:
            q = '.'.join((obj.__module__, q))
        return q
else:
    def qualname(obj):  # noqa
        if not hasattr(obj, '__name__') and hasattr(obj, '__class__'):
            obj = obj.__class__
        return '.'.join((obj.__module__, obj.__name__))


def instantiate(name, *args, **kwargs):
    """Instantiate class by name.

    See :func:`symbol_by_name`.

    """
    return symbol_by_name(name)(*args, **kwargs)


@contextmanager
def cwd_in_path():
    cwd = os.getcwd()
    if cwd in sys.path:
        yield
    else:
        sys.path.insert(0, cwd)
        try:
            yield cwd
        finally:
            try:
                sys.path.remove(cwd)
            except ValueError:  # pragma: no cover
                pass


def find_module(module, path=None, imp=None):
    """Version of :func:`imp.find_module` supporting dots."""
    if imp is None:
        imp = importlib.import_module
    with cwd_in_path():
        if '.' in module:
            last = None
            parts = module.split('.')
            for i, part in enumerate(parts[:-1]):
                mpart = imp('.'.join(parts[:i + 1]))
                try:
                    path = mpart.__path__
                except AttributeError:
                    raise NotAPackage(module)
                last = _imp.find_module(parts[i + 1], path)
            return last
        return _imp.find_module(module)


def import_from_cwd(module, imp=None, package=None):
    """Import module, but make sure it finds modules
    located in the current directory.

    Modules located in the current directory has
    precedence over modules located in `sys.path`.
    """
    if imp is None:
        imp = importlib.import_module
    with cwd_in_path():
        return imp(module, package=package)


def reload_from_cwd(module, reloader=None):
    if reloader is None:
        reloader = reload
    with cwd_in_path():
        return reloader(module)


def module_file(module):
    """Return the correct original file name of a module."""
    name = module.__file__
    return name[:-1] if name.endswith('.pyc') else name
