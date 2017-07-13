from __future__ import absolute_import
from future.utils import PY3

if PY3:
    from html.entities import *
else:
    from future.moves.html.entities import *
