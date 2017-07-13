""" Test that superfluous else return are detected. """

# pylint:disable=invalid-name,missing-docstring,unused-variable

def foo1(x, y, z):
    if x:  # [no-else-return]
        a = 1
        return y
    else:
        b = 2
        return z


def foo2(x, y, w, z):
    if x:  # [no-else-return]
        a = 1
        return y
    elif z:
        b = 2
        return w
    else:
        c = 3
        return z


def foo3(x, y, z):
    if x:  # [no-else-return]
        a = 1
        if y:  # [no-else-return]
            b = 2
            return y
        else:
            c = 3
            return x
    else:
        d = 4
        return z


def bar1(x, y, z):
    if x:
        return y
    return z


def bar2(w, x, y, z):
    if x:
        return y
    elif z:
        a = 1
    else:
        return w


def bar3(x, y, z):
    if x:
        if z:
            return y
    else:
        return z
