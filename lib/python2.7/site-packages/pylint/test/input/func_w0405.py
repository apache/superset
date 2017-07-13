"""check reimport
"""
from __future__ import absolute_import, print_function

# pylint: disable=using-constant-test,ungrouped-imports,wrong-import-position
import os
from os.path import join, exists
import os
import re as _re

__revision__ = 0
_re.match('yo', '.*')

if __revision__:
    print(os)
    from os.path import exists
    print(join, exists)

def func(yooo):
    """reimport in different scope"""
    import os as ass
    ass.remove(yooo)
    import re
    re.compile('.*')

if 1: # pylint: disable=using-constant-test
    import sys
    print(sys.modules)
else:
    print('bla')
    import sys
