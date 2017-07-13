"""Test that valid class attribute doesn't trigger errors"""
__revision__ = 'sponge bob'

class Clazz(object):
    "dummy class"

    def __init__(self):
        self.topic = 5
        self._data = 45

    def change_type(self, new_class):
        """Change type"""
        self.__class__ = new_class

    def do_nothing(self):
        "I do nothing useful"
        return self.topic + 56
