# pylint: disable=missing-docstring,too-few-public-methods,no-init,no-self-use,unused-argument,pointless-statement,expression-not-assigned,undefined-variable

# metaclasses that support membership test protocol
class MetaIterable(type):
    def __iter__(cls):
        return iter((1, 2, 3))

class MetaOldIterable(type):
    def __getitem__(cls, key):
        if key < 10:
            return key ** 2
        else:
            raise IndexError("bad index")

class MetaContainer(type):
    def __contains__(cls, key):
        return False


class IterableClass(object):
    __metaclass__ = MetaIterable

class OldIterableClass(object):
    __metaclass__ = MetaOldIterable

class ContainerClass(object):
    __metaclass__ = MetaContainer


def test():
    1 in IterableClass
    1 in OldIterableClass
    1 in ContainerClass
    1 in IterableClass()  # [unsupported-membership-test]
    1 in OldIterableClass()  # [unsupported-membership-test]
    1 in ContainerClass()  # [unsupported-membership-test]
