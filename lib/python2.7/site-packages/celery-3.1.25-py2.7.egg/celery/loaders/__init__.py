# -*- coding: utf-8 -*-
"""
    celery.loaders
    ~~~~~~~~~~~~~~

    Loaders define how configuration is read, what happens
    when workers start, when tasks are executed and so on.

"""
from __future__ import absolute_import

from celery._state import current_app
from celery.utils import deprecated
from celery.utils.imports import symbol_by_name, import_from_cwd

__all__ = ['get_loader_cls']

LOADER_ALIASES = {'app': 'celery.loaders.app:AppLoader',
                  'default': 'celery.loaders.default:Loader',
                  'django': 'djcelery.loaders:DjangoLoader'}


def get_loader_cls(loader):
    """Get loader class by name/alias"""
    return symbol_by_name(loader, LOADER_ALIASES, imp=import_from_cwd)


@deprecated(deprecation=2.5, removal=4.0,
            alternative='celery.current_app.loader')
def current_loader():
    return current_app.loader


@deprecated(deprecation=2.5, removal=4.0,
            alternative='celery.current_app.conf')
def load_settings():
    return current_app.conf
