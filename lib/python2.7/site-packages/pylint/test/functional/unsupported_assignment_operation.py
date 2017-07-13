"""
Checks that value used in a subscript support assignments
(i.e. defines __setitem__ method).
"""
# pylint: disable=missing-docstring,pointless-statement,expression-not-assigned,wrong-import-position
# pylint: disable=too-few-public-methods,import-error,invalid-name,wrong-import-order
import six

# primitives
numbers = [1, 2, 3]
numbers[0] = 42


bytearray(b"123")[0] = 42
dict(a=1, b=2)['a'] = 42
(1, 2, 3)[0] = 42 # [unsupported-assignment-operation]

# list/dict comprehensions are fine
[x for x in range(10)][0] = 42
{x: 10 - x for x in range(10)}[0] = 42


# instances
class NonSubscriptable(object):
    pass

class Subscriptable(object):
    def __setitem__(self, key, value):
        return key + value

NonSubscriptable()[0] = 24  # [unsupported-assignment-operation]
NonSubscriptable[0] = 24 # [unsupported-assignment-operation]
Subscriptable()[0] = 24
Subscriptable[0] = 24 # [unsupported-assignment-operation]

# generators are not subscriptable
def powers_of_two():
    k = 0
    while k < 10:
        yield 2 ** k
        k += 1

powers_of_two()[0] = 42 # [unsupported-assignment-operation]
powers_of_two[0] = 42  # [unsupported-assignment-operation]


# check that primitive non subscriptable types are caught
True[0] = 24  # [unsupported-assignment-operation]
None[0] = 42 # [unsupported-assignment-operation]
8.5[0] = 24 # [unsupported-assignment-operation]
10[0] = 24 # [unsupported-assignment-operation]

# sets are not subscriptable
{x ** 2 for x in range(10)}[0] = 24 # [unsupported-assignment-operation]
set(numbers)[0] = 24 # [unsupported-assignment-operation]
frozenset(numbers)[0] = 42 # [unsupported-assignment-operation]

# skip instances with unknown base classes
from some_missing_module import LibSubscriptable

class MaybeSubscriptable(LibSubscriptable):
    pass

MaybeSubscriptable()[0] = 42

# subscriptable classes (through metaclasses)

class MetaSubscriptable(type):
    def __setitem__(cls, key, value):
        return key + value

class SubscriptableClass(six.with_metaclass(MetaSubscriptable, object)):
    pass

SubscriptableClass[0] = 24
SubscriptableClass()[0] = 24 # [unsupported-assignment-operation]

# functions are not subscriptable
def test(*args, **kwargs):
    return args, kwargs

test()[0] = 24 # [unsupported-assignment-operation]
test[0] = 24 # [unsupported-assignment-operation]

# deque
from collections import deque
deq = deque(maxlen=10)
deq.append(42)
deq[0] = 42

# tuples assignment
values = [1, 2, 3, 4]
(values[0], values[1]) = 3, 4
(values[0], SubscriptableClass()[0]) = 42, 42 # [unsupported-assignment-operation]
