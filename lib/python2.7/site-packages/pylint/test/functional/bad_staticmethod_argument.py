# pylint: disable=missing-docstring, no-staticmethod-decorator

class Abcd(object):

    def method1(self): # [bad-staticmethod-argument]
        pass

    method1 = staticmethod(method1)

    def method2(cls): # [bad-staticmethod-argument]
        pass

    method2 = staticmethod(method2)

    def __init__(self):
        pass
