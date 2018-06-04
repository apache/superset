# -*- coding: utf-8 -*-
# pylint: disable=C,R,W

"""Utility functions used across Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

# Superset framework imports
from superset import app
from superset.utils import get_celery_app

# Globals
config = app.config
app = get_celery_app(config)
