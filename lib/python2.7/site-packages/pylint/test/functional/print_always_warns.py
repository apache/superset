"""Check print statement always warns even if in Python 2 block """

from __future__ import absolute_import

import six

if six.PY2:
    print "Python 3 fails to parse print statements." # [print-statement]
