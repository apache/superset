# pylint: disable=C0111, W0232
"""check for methods first arguments
"""

__revision__ = 0


class Obj(object):
    # C0202, classmethod
    def __new__(something):
        pass

    # C0202, classmethod
    def class1(cls):
        pass
    class1 = classmethod(class1)

    def class2(other):
        pass
    class2 = classmethod(class2)


class Meta(type):
    # C0204, metaclass __new__
    def __new__(other, name, bases, dct):
        pass

    # C0203, metaclass method
    def method1(cls):
        pass

    def method2(other):
        pass

    # C0205, metaclass classmethod
    def class1(mcs):
        pass
    class1 = classmethod(class1)

    def class2(other):
        pass
    class2 = classmethod(class2)
