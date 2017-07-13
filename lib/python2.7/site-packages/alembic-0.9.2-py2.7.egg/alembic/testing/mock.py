# testing/mock.py
# Copyright (C) 2005-2017 the SQLAlchemy authors and contributors
# <see AUTHORS file>
#
# This module is part of SQLAlchemy and is released under
# the MIT License: http://www.opensource.org/licenses/mit-license.php

"""Import stub for mock library.

    NOTE:  copied/adapted from SQLAlchemy master for backwards compatibility;
   this should be removable when Alembic targets SQLAlchemy 1.0.0

"""
from __future__ import absolute_import
from ..util.compat import py33

if py33:
    from unittest.mock import MagicMock, Mock, call, patch, ANY
else:
    try:
        from mock import MagicMock, Mock, call, patch, ANY  # noqa
    except ImportError:
        raise ImportError(
            "SQLAlchemy's test suite requires the "
            "'mock' library as of 0.8.2.")
