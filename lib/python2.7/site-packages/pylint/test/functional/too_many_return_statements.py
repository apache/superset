# pylint: disable=missing-docstring

def stupid_function(arg): # [too-many-return-statements]
    if arg == 1:
        return 1
    elif arg == 2:
        return 2
    elif arg == 3:
        return 3
    elif arg == 4:
        return 4
    elif arg == 5:
        return 5
    elif arg == 6:
        return 6
    elif arg == 7:
        return 7
    elif arg == 8:
        return 8
    elif arg == 9:
        return 9
    elif arg == 10:
        return 10
    return None


def many_yield(text):
    """Not a problem"""
    if text:
        yield "    line 1: %s\n" % text
        yield "    line 2\n"
        yield "    line 3\n"
        yield "    line 4\n"
        yield "    line 5\n"
    else:
        yield "    line 6\n"
        yield "    line 7\n"
        yield "    line 8\n"
        yield "    line 9\n"
        yield "    line 10\n"
