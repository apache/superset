# pylint: disable=missing-docstring, pointless-statement, global-variable-not-assigned, global-statement


CONST = 1


def test():
    CONST  # [used-prior-global-declaration]

    global CONST


def other_test():
    CONST

    global SOMETHING


def other_test_1():
    global SOMETHING

    CONST


def other_test_2():
    CONST

    def inner():
        global CONST

    return inner


def other_test_3():
    def inner():
        return CONST

    global CONST
    return inner
