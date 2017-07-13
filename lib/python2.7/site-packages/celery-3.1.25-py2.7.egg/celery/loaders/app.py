# -*- coding: utf-8 -*-
"""
    celery.loaders.app
    ~~~~~~~~~~~~~~~~~~

    The default loader used with custom app instances.

"""
from __future__ import absolute_import

from .base import BaseLoader

__all__ = ['AppLoader']


class AppLoader(BaseLoader):
    pass
