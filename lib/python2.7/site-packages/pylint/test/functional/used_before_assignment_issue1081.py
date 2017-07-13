# pylint: disable=missing-docstring,invalid-name,too-few-public-methods

x = 24


def used_before_assignment_1(a):
    if x == a:  # [used-before-assignment]
        for x in [1, 2]:  # [redefined-outer-name]
            pass


def used_before_assignment_2(a):
    if x == a:  # [used-before-assignment]
        pass
    x = 2  # [redefined-outer-name]


def used_before_assignment_3(a):
    if x == a:  # [used-before-assignment]
        if x > 3:
            x = 2  # [redefined-outer-name]


def not_used_before_assignment(a):
    if x == a:
        pass


def not_used_before_assignment_2(a):
    x = 3  # [redefined-outer-name]
    if x == a:
        pass


def func(something):
    return something ** 3


class FalsePositive(object):
    x = func(x)
