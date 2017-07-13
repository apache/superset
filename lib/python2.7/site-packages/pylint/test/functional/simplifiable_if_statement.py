"""Test that some if statement tests can be simplified."""

# pylint: disable=missing-docstring, invalid-name, no-else-return


def test_simplifiable_1(arg):
    # Simple test that can be replaced by bool(arg)
    if arg: # [simplifiable-if-statement]
        return True
    else:
        return False


def test_simplifiable_2(arg, arg2):
    # Can be reduced to bool(arg and not arg2)
    if arg and not arg2: # [simplifiable-if-statement]
        return True
    else:
        return False


def test_simplifiable_3(arg, arg2):
    # Can be reduced to bool(arg and not arg2)
    if arg and not arg2: # [simplifiable-if-statement]
        var = True
    else:
        var = False
    return var


def test_simplifiable_4(arg):
    if arg:
        var = True
    else:
        if arg == "arg1": # [simplifiable-if-statement]
            return True
        else:
            return False
    return var


def test_not_necessarily_simplifiable_1(arg, arg2):
    # Can be reduced to bool(not arg and not arg2) or to
    # `not all(N)`, which is a bit harder to understand
    # than `any(N)` when var should be False.
    if arg or arg2:
        var = False
    else:
        var = True
    return var


def test_not_necessarily_simplifiabile_2(arg):
    # This could theoretically be reduced to `not arg or arg > 3`
    # but the net result is that now the condition is harder to understand,
    # because it requires understanding of an extra clause:
    #   * first, there is the negation of truthness with `not arg`
    #   * the second clause is `arg > 3`, which occurs when arg has a
    #     a truth value, but it implies that `arg > 3` is equivalent
    #     with `arg and arg > 3`, which means that the user must
    #     think about this assumption when evaluating `arg > 3`.
    #     The original form is easier to grasp.
    if arg and arg <= 3:
        return False
    else:
        return True


def test_not_simplifiable_3(arg):
    if arg:
        test_not_necessarily_simplifiabile_2(arg)
        test_not_necessarily_simplifiable_1(arg, arg)
        return False
    else:
        if arg < 3:
            test_simplifiable_3(arg, 42)
        return True


def test_not_simplifiable_4(arg):
    # Not interested in multiple elifs
    if arg == "any":
        return True
    elif test_not_simplifiable_3(arg) == arg:
        return True
    else:
        return False


def test_not_simplifiable_5(arg):
    # Different actions in each branch
    if arg == "any":
        return True
    else:
        var = 42
    return var


def test_not_simplifiable_6(arg):
    # Different actions in each branch
    if arg == "any":
        var = 42
    else:
        return True
    return var

def test_not_simplifiable_7(arg):
    # Returning something different
    if arg == "any":
        return 4
    else:
        return 5


def test_not_simplifiable_8(arg):
    # Only one of the branch returns something boolean
    if arg == "any":
        return True
    else:
        return 0
