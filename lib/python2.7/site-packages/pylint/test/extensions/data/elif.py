"""Checks use of "else if" triggers a refactor message"""

def my_function():
    """docstring"""
    myint = 2
    if myint > 5:
        pass
    else:
        if myint <= 5:
            pass
        else:
            myint = 3
            if myint > 2:
                if myint > 3:
                    pass
                elif myint == 3:
                    pass
                elif myint < 3:
                    pass
                else:
                    if myint:
                        pass
            else:
                if myint:
                    pass
                myint = 4
