''' Test for inheritance '''
from __future__ import print_function
__revision__ = 1
# pylint: disable=too-few-public-methods, using-constant-test
class AAAA(object):
    ''' class AAAA '''

    def __init__(self):
        pass

    def method1(self):
        ''' method 1 '''
        print(self)

    def method2(self):
        ''' method 2 '''
        print(self)

class BBBB(AAAA):
    ''' class BBBB '''

    def __init__(self):
        AAAA.__init__(self)

    # should ignore docstring calling from class AAAA
    def method1(self):
        AAAA.method1(self)

class CCCC(BBBB):
    ''' class CCCC '''

    def __init__(self):
        BBBB.__init__(self)

    # should ignore docstring since CCCC is inherited from BBBB which is
    # inherited from AAAA containing method2
    if __revision__:
        def method2(self):
            AAAA.method2(self)
    else:
        def method2(self):
            AAAA.method1(self)
