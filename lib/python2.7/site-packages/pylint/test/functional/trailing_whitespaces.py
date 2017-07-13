"""Regression test for trailing-whitespace (C0303)."""
# pylint: disable=mixed-line-endings
from __future__ import print_function

# +1: [trailing-whitespace]
print('some trailing whitespace')   
# +1: [trailing-whitespace]
print('trailing whitespace does not count towards the line length limit')                   
print('windows line ends are ok')
# +1: [trailing-whitespace]
print('but trailing whitespace on win is not')   
