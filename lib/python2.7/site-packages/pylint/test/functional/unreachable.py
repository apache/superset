# pylint: disable=missing-docstring

from __future__ import print_function

def func1():
    return 1
    print('unreachable') # [unreachable]

def func2():
    while 1:
        break
        print('unreachable') # [unreachable]

def func3():
    for i in (1, 2, 3):
        print(i)
        continue
        print('unreachable') # [unreachable]

def func4():
    raise Exception
    return 1 / 0 # [unreachable]
