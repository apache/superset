"""
Checks that value used in a subscript support deletion
(i.e. defines __delitem__ method).
"""
# pylint: disable=missing-docstring,pointless-statement,expression-not-assigned,wrong-import-position
# pylint: disable=too-few-public-methods,import-error,invalid-name,wrong-import-order
import six

# primitives
numbers = [1, 2, 3]
del numbers[0]


del bytearray(b"123")[0]
del dict(a=1, b=2)['a']
del (1, 2, 3)[0] # [unsupported-delete-operation]

# list/dict comprehensions are fine
del [x for x in range(10)][0]
del {x: 10 - x for x in range(10)}[0]


# instances
class NonSubscriptable(object):
    pass

class Subscriptable(object):
    def __delitem__(self, key):
        pass

del NonSubscriptable()[0]  # [unsupported-delete-operation]
del NonSubscriptable[0] # [unsupported-delete-operation]
del Subscriptable()[0]
del Subscriptable[0] # [unsupported-delete-operation]

# generators are not subscriptable
def powers_of_two():
    k = 0
    while k < 10:
        yield 2 ** k
        k += 1

del powers_of_two()[0] # [unsupported-delete-operation]
del powers_of_two[0]  # [unsupported-delete-operation]


# check that primitive non subscriptable types are caught
del True[0]  # [unsupported-delete-operation]
del None[0] # [unsupported-delete-operation]
del 8.5[0] # [unsupported-delete-operation]
del 10[0] # [unsupported-delete-operation]

# sets are not subscriptable
del {x ** 2 for x in range(10)}[0] # [unsupported-delete-operation]
del set(numbers)[0] # [unsupported-delete-operation]
del frozenset(numbers)[0] # [unsupported-delete-operation]

# skip instances with unknown base classes
from some_missing_module import LibSubscriptable

class MaybeSubscriptable(LibSubscriptable):
    pass

del MaybeSubscriptable()[0]

# subscriptable classes (through metaclasses)

class MetaSubscriptable(type):
    def __delitem__(cls, key):
        pass

class SubscriptableClass(six.with_metaclass(MetaSubscriptable, object)):
    pass

del SubscriptableClass[0]
del SubscriptableClass()[0] # [unsupported-delete-operation]

# functions are not subscriptable
def test(*args, **kwargs):
    return args, kwargs

del test()[0] # [unsupported-delete-operation]
del test[0] # [unsupported-delete-operation]

# deque
from collections import deque
deq = deque(maxlen=10)
deq.append(42)
del deq[0]

# tuples assignment
values = [1, 2, 3, 4]
del (values[0], values[1])
del (values[0], SubscriptableClass()[0]) # [unsupported-delete-operation]
