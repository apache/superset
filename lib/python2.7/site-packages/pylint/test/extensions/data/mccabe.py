"""Checks use of "too-complex" check"""


def f1():
    """McCabe rating: 1"""
    pass


def f2(n):
    """McCabe rating: 1"""
    k = n + 4
    s = k + n
    return s


def f3(n):
    """McCabe rating: 3"""
    if n > 3:
        return "bigger than three"
    elif n > 4:
        return "is never executed"
    else:
        return "smaller than or equal to three"


def f4():
    """McCabe rating: 2"""
    for i in range(10):
        print(i)


def f5(mylist):
    """McCabe rating: 2"""
    for i in mylist:
        print(i)
    else:
        print(None)


def f6(n):
    """McCabe rating: 2"""
    if n > 4:
        return f(n - 1)
    else:
        return n


def f7():
    """McCabe rating: 3"""
    def b():
        """McCabe rating: 2"""
        def c():
            """McCabe rating: 1"""
            pass
        c()
    b()


def f8():
    """McCabe rating: 4"""
    try:
        print(1)
    except TypeA:
        print(2)
    except TypeB:
        print(3)
    else:
        print(4)


def f9():
    """McCabe rating: 9"""
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


def f10():
    """McCabe rating: 11"""
    myint = 2
    if myint == 5:
        return myint
    elif myint == 6:
        return myint
    elif myint == 7:
        return myint
    elif myint == 8:
        return myint
    elif myint == 9:
        return myint
    elif myint == 10:
        if myint == 8:
            while True:
                return True
        elif myint == 8:
            with myint:
                return 8
    else:
        if myint == 2:
            return myint
        return myint
    return myint


class MyClass1(object):
    """Class of example to test mccabe"""
    _name = 'MyClass'  # To force a tail.node=None

    def method1():
        """McCabe rating: 1"""
        pass

    def method2(self, param1):
        """McCabe rating: 18"""
        if not param1:
            pass
        pass
        if param1:
            pass
        else:
            pass

        pass

        if param1:
            pass
        if param1:
            pass
        if param1:
            pass
        if param1:
            pass
        if param1:
            pass
        if param1:
            pass
        if param1:
            for value in range(5):
                pass

        pass
        for count in range(6):
            with open('myfile') as fp:
                count += 1
            pass
        pass
        try:
            pass
            if not param1:
                pass
            else:
                pass
            if param1:
                raise BaseException('Error')
            with open('myfile2') as fp2:
                pass
            pass
        finally:
            if param1 is not None:
                pass
            for count2 in range(8):
                try:
                    pass
                except BaseException('Error2'):
                    pass
        return param1


for count in range(10):
    if count == 1:
        exit(0)
    elif count == 2:
        exit(1)
    else:
        exit(2)


def method3(self):
    try:
        if True:
            pass
        else:
            pass
    finally:
        pass
    return True
