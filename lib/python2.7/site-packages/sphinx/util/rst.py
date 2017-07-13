# -*- coding: utf-8 -*-
"""
    sphinx.util.rst
    ~~~~~~~~~~~~~~~

    reST helper functions.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re

symbols_re = re.compile(r'([!-/:-@\[-`{-~])')


def escape(text):
    # type: (unicode) -> unicode
    return symbols_re.sub(r'\\\1', text)  # type: ignore
