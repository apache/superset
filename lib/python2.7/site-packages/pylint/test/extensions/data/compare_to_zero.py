# pylint: disable=literal-comparison,missing-docstring,misplaced-comparison-constant

X = 123
Y = len('test')

if X is 0:  # [compare-to-zero]
    pass

if Y is not 0:  # [compare-to-zero]
    pass

if X == 0:  # [compare-to-zero]
    pass

if Y != 0:  # [compare-to-zero]
    pass

if X > 0:  # [compare-to-zero]
    pass

if X < 0: #  this is allowed
    pass

if 0 < X:  # [compare-to-zero]
    pass

if 0 > X: #  this is allowed
    pass
