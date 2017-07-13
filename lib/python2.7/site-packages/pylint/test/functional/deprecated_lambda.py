# pylint: disable=missing-docstring,invalid-name,no-absolute-import

import functools

# Don't do this, use a comprehension instead.
assert map(lambda x: x*2, [1, 2, 3]) == [2, 4, 6] # [deprecated-lambda]

assert filter(lambda x: x != 1, [1, 2, 3]) == [2, 3] # [deprecated-lambda]

# It's still ok to use map and filter with anything but an inline lambda.
double = lambda x: x * 2
assert map(double, [1, 2, 3]) == [2, 4, 6]

# It's also ok to pass lambdas to other functions.
assert functools.reduce(lambda x, y: x * y, [1, 2, 3, 4]) == 24

# Or to a undefined function or one with varargs
def f(*a):
    return len(a)

f(lambda x, y: x + y, [1, 2, 3])

undefined_function(lambda: 2)  # pylint: disable=undefined-variable
