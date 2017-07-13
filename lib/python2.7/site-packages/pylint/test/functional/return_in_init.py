# pylint: disable=missing-docstring,too-few-public-methods

class MyClass(object):

    def __init__(self): # [return-in-init]
        return 1

class MyClass2(object):
    """dummy class"""

    def __init__(self):
        return


class MyClass3(object):
    """dummy class"""

    def __init__(self):
        return None

class MyClass5(object):
    """dummy class"""

    def __init__(self):
        self.callable = lambda: (yield None)
