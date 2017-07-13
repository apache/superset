# pylint: disable=missing-docstring, using-constant-test,cell-var-from-loop

def insidious_break_and_return():
    for i in range(0, -5, -1):
        my_var = 0

        try:
            my_var += 1.0/i
            if i < -3:
                break
            else:
                return my_var
        finally:
            if i > -2:
                break # [lost-exception]
            else:
                return my_var # [lost-exception]
    return None


def break_and_return():
    for i in range(0, -5, -1):
        my_var = 0
        if i:
            break
        try:
            my_var += 1.0/i
        finally:
            for _ in range(2):
                if True:
                    break
            else:
                def strange():
                    if True:
                        return my_var
                strange()
        if i:
            break
        else:
            return
