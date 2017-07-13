# pylint: disable=missing-docstring

class MultiException(Exception):
    def __init__(self):
        Exception.__init__(self)
    def return_self(self):
        return self


raise MultiException().return_self()
