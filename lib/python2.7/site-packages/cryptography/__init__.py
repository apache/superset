# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import sys
import warnings

from cryptography.__about__ import (
    __author__, __copyright__, __email__, __license__, __summary__, __title__,
    __uri__, __version__
)


__all__ = [
    "__title__", "__summary__", "__uri__", "__version__", "__author__",
    "__email__", "__license__", "__copyright__",
]

if sys.version_info[:2] == (2, 6):
    warnings.warn(
        "Python 2.6 is no longer supported by the Python core team, please "
        "upgrade your Python. A future version of cryptography will drop "
        "support for Python 2.6",
        DeprecationWarning
    )
