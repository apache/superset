# pylint: disable=missing-docstring,bare-except,pointless-statement,superfluous-parens
def strangeproblem():
    try:
        for _ in range(0, 4):
            message = object()
            print(type(message))
    finally:
        message = object()


try:
    MY_INT = 1
    print("MY_INT = %d" % MY_INT)
finally:
    MY_INT = 2

try:
    pass
except:
    FALSE_POSITIVE = 1
    FALSE_POSITIVE  # here pylint claims used-before-assignment
finally:
    FALSE_POSITIVE = 2  # this line is needed to reproduce the issue
