# -*- coding: utf-8 -*-
"""
    flask_testing
    ~~~~~~~~~~~~~

    Flask unittest integration.

    :copyright: (c) 2010 by Dan Jacob.
    :license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import
from .utils import TestCase, LiveServerTestCase

try:
    import twill
    from .twill import Twill, TwillTestCase
    is_twill_available = True
except ImportError:
    is_twill_available = False

    class Error():
        def __init__(self, *args, **kwargs):
            msg = "'twill' package is required for %s" % (
                  self.__class__.__name__)
            raise ImportError(msg)

    Twill = Error
    TwillTestCase = Error
