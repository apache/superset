"""Make sure warnings about redefinitions do not trigger for dummy variables."""
from __future__ import print_function


_, INTERESTING = 'a=b'.split('=')

value = 10


def clobbering():
    """Clobbers a dummy name from the outer scope."""
    value = 9
    for _ in range(7):
        print(value)
