# pylint: disable=missing-docstring,pointless-statement,expression-not-assigned,too-few-public-methods,import-error,no-init,wrong-import-position,no-else-return

# standard types
1 in [1, 2, 3]
1 in {'a': 1, 'b': 2}
1 in {1, 2, 3}
1 in (1, 2, 3)
'1' in "123"
'1' in u"123"
'1' in bytearray(b"123")
1 in frozenset([1, 2, 3])

# comprehensions
1 in [x ** 2 % 10 for x in range(10)]
1 in {x ** 2 % 10 for x in range(10)}
1 in {x: x ** 2 % 10 for x in range(10)}

# iterators
1 in iter([1, 2, 3])

# generator
def count(upto=float("inf")):
    i = 0
    while True:
        if i > upto:
            break
        yield i
        i += 1

10 in count(upto=10)

# custom instance
class UniversalContainer(object):
    def __contains__(self, key):
        return True

42 in UniversalContainer()

# custom iterable
class CustomIterable(object):
    def __iter__(self):
        return iter((1, 2, 3))
3 in CustomIterable()

# old-style iterable
class OldStyleIterable(object):
    def __getitem__(self, key):
        if key < 10:
            return 2 ** key
        else:
            raise IndexError("bad index")
64 in OldStyleIterable()

# do not emit warning if class has unknown bases
from some_missing_module import ImportedClass

class MaybeIterable(ImportedClass):
    pass

10 in MaybeIterable()

# do not emit warning inside mixins/abstract/base classes
class UsefulMixin(object):
    stuff = None

    def get_stuff(self):
        return self.stuff

    def act(self, thing):
        stuff = self.get_stuff()
        if thing in stuff:
            pass

class BaseThing(object):
    valid_values = None

    def validate(self, value):
        if self.valid_values is None:
            return True
        else:
            # error should not be emitted here
            return value in self.valid_values

class AbstractThing(object):
    valid_values = None

    def validate(self, value):
        if self.valid_values is None:
            return True
        else:
            # error should not be emitted here
            return value in self.valid_values

# class is not named as abstract
# but still is deduceably abstract
class Thing(object):
    valid_values = None

    def __init__(self):
        self._init_values()

    def validate(self, value):
        if self.valid_values is None:
            return True
        else:
            # error should not be emitted here
            return value in self.valid_values

    def _init_values(self):
        raise NotImplementedError

# error cases
42 in 42  # [unsupported-membership-test]
42 not in None  # [unsupported-membership-test]
42 in 8.5  # [unsupported-membership-test]

class EmptyClass(object):
    pass

42 not in EmptyClass()  # [unsupported-membership-test]
42 in EmptyClass  # [unsupported-membership-test]
42 not in count  # [unsupported-membership-test]
42 in range  # [unsupported-membership-test]
