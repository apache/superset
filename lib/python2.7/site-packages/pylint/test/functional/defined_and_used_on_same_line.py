"""Check for definitions and usage happening on the same line."""
#pylint: disable=missing-docstring,multiple-statements,no-absolute-import,parameter-unpacking,wrong-import-position
from __future__ import print_function
print([index
       for index in range(10)])

print((index
       for index in range(10)))

FILTER_FUNC = lambda x: not x

def func(xxx): return xxx

def func2(xxx): return xxx + func2(1)

import sys; print(sys.exc_info())

for i in range(10): print(i)

j = 4; LAMB = lambda x: x+j

FUNC4 = lambda a, b: a != b

# test http://www.logilab.org/ticket/6954:

with open('f') as f: print(f.read())

with open('f') as f, open(f.read()) as g:
    print(g.read())
