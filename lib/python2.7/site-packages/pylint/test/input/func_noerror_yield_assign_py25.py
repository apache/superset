"""http://www.logilab.org/ticket/8771"""

from __future__ import print_function

def generator():
    """yield as assignment"""
    yield 45
    xxxx = yield 123
    print(xxxx)

def generator_fp1(seq):
    """W0631 false positive"""
    for val in seq:
        pass
    for val in seq:
        yield val

def generator_fp2():
    """E0601 false positive"""
    xxxx = 12
    yield xxxx
