"""Checks the maximum block level is smaller than 6 in function definitions"""

#pylint: disable=using-constant-test, missing-docstring, too-many-return-statements,no-else-return

def my_function():
    if 1:  # [too-many-nested-blocks]
        for i in range(10):
            if i == 2:
                while True:
                    try:
                        if True:
                            i += 1
                    except IOError:
                        pass

    if 1:
        for i in range(10):
            if i == 2:
                while True:
                    try:
                        i += 1
                    except IOError:
                        pass

    def nested_func():
        if True:
            for i in range(10):
                while True:
                    if True:
                        if True:
                            yield i

    nested_func()

def more_complex_function():
    attr1 = attr2 = attr3 = [1, 2, 3]
    if attr1:
        for i in attr1:
            if attr2:
                return i
            else:
                return 'duh'
    elif attr2:
        for i in attr2:
            if attr2:
                return i
            else:
                return 'duh'
    else:
        for i in range(15):
            if attr3:
                return i
            else:
                return 'doh'
            return None

def elif_function():
    arg = None
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

def else_if_function():
    arg = None
    if arg == 1:  # [too-many-nested-blocks]
        return 1
    else:
        if arg == 2:
            return 2
        else:
            if arg == 3:
                return 3
            else:
                if arg == 4:
                    return 4
                else:
                    if arg == 5:
                        return 5
                    else:
                        if arg == 6:
                            return 6
                        else:
                            if arg == 7:
                                return 7
