# pylint: disable=missing-docstring,unused-argument

def target(pos, *, keyword):
    return pos + keyword


def forwarding_kwds(pos, **kwds):
    target(pos, **kwds)


def forwarding_args(*args, keyword):
    target(*args, keyword=keyword)

def forwarding_conversion(*args, **kwargs):
    target(*args, **dict(kwargs))


def not_forwarding_kwargs(*args, **kwargs):
    target(*args) # [missing-kwoa]


target(1, keyword=2)

PARAM = 1
target(2, PARAM) # [too-many-function-args, missing-kwoa]
