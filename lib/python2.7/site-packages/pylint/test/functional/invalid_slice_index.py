"""Errors for invalid slice indices"""
# pylint: disable=too-few-public-methods, no-self-use


TESTLIST = [1, 2, 3]

# Invalid indices
def function1():
    """functions used as indices"""
    return TESTLIST[id:id:]  # [invalid-slice-index,invalid-slice-index]

def function2():
    """strings used as indices"""
    return TESTLIST['0':'1':]  # [invalid-slice-index,invalid-slice-index]

def function3():
    """class without __index__ used as index"""

    class NoIndexTest(object):
        """Class with no __index__ method"""
        pass

    return TESTLIST[NoIndexTest()::]  # [invalid-slice-index]

# Valid indices
def function4():
    """integers used as indices"""
    return TESTLIST[0:0:0] # no error

def function5():
    """None used as indices"""
    return TESTLIST[None:None:None] # no error

def function6():
    """class with __index__ used as index"""
    class IndexTest(object):
        """Class with __index__ method"""
        def __index__(self):
            """Allow objects of this class to be used as slice indices"""
            return 0

    return TESTLIST[IndexTest():None:None] # no error

def function7():
    """class with __index__ in superclass used as index"""
    class IndexType(object):
        """Class with __index__ method"""
        def __index__(self):
            """Allow objects of this class to be used as slice indices"""
            return 0

    class IndexSubType(IndexType):
        """Class with __index__ in parent"""
        pass

    return TESTLIST[IndexSubType():None:None] # no error

def function8():
    """slice object used as index"""
    return TESTLIST[slice(1, 2, 3)] # no error
