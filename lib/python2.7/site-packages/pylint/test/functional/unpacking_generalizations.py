"""Various tests for unpacking generalizations added in Python 3.5"""

# pylint: disable=missing-docstring, invalid-name

def func_variadic_args(*args):
    return args


def func_variadic_positional_args(a, b, *args):
    return a, b, args

def func_positional_args(a, b, c, d):
    return a, b, c, d


func_variadic_args(*(2, 3), *(3, 4), *(4, 5))
func_variadic_args(1, 2, *(2, 3), 2, 3, *(4, 5))
func_variadic_positional_args(1, 2, *(4, 5), *(5, 6))
func_variadic_positional_args(*(2, 3), *(4, 5), *(5, 6))
func_variadic_positional_args(*(2, 3))
func_variadic_positional_args(*(2, 3, 4))
func_variadic_positional_args(1, 2, 3, *(3, 4))

func_positional_args(*(2, 3, 4), *(2, 3)) # [too-many-function-args]
func_positional_args(*(1, 2), 3) # [no-value-for-parameter]
func_positional_args(1, *(2, ), 3, *(4, 5)) # [too-many-function-args]
func_positional_args(1, 2, c=24, d=32, **{'d': 32}) # [repeated-keyword]
# +1: [repeated-keyword,repeated-keyword]
func_positional_args(1, 2, c=24, **{'c': 34, 'd': 33}, **{'d': 24})
