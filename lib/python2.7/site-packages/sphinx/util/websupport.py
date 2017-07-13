# -*- coding: utf-8 -*-
"""
    sphinx.util.websupport
    ~~~~~~~~~~~~~~~~~~~~~~

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

try:
    from sphinxcontrib.websupport.utils import is_commentable  # NOQA
except ImportError:
    def is_commentable(node):
        raise RuntimeError
