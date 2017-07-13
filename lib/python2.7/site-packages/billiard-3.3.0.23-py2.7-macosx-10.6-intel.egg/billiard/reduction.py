from __future__ import absolute_import

import sys

if sys.version_info[0] == 3:
    from .py3 import reduction
else:
    from .py2 import reduction  # noqa

sys.modules[__name__] = reduction
