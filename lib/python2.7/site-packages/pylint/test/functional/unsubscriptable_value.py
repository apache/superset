"""
Checks that value used in a subscript supports subscription
(i.e. defines __getitem__ method).
"""
# pylint: disable=missing-docstring,pointless-statement,expression-not-assigned,wrong-import-position
# pylint: disable=too-few-public-methods,import-error,invalid-name,wrong-import-order
import six

# primitives
numbers = [1, 2, 3]
numbers[0]
"123"[0]
u"123"[0]
b"123"[0]
bytearray(b"123")[0]
dict(a=1, b=2)['a']
(1, 2, 3)[0]

# list/dict comprehensions are fine
[x for x in range(10)][0]
{x: 10 - x for x in range(10)}[0]


# instances
class NonSubscriptable(object):
    pass

class Subscriptable(object):
    def __getitem__(self, key):
        return key + key

NonSubscriptable()[0]  # [unsubscriptable-object]
NonSubscriptable[0]  # [unsubscriptable-object]
Subscriptable()[0]
Subscriptable[0]  # [unsubscriptable-object]

# generators are not subscriptable
def powers_of_two():
    k = 0
    while k < 10:
        yield 2 ** k
        k += 1

powers_of_two()[0]  # [unsubscriptable-object]
powers_of_two[0]  # [unsubscriptable-object]


# check that primitive non subscriptable types are caught
True[0]  # [unsubscriptable-object]
None[0]  # [unsubscriptable-object]
8.5[0]  # [unsubscriptable-object]
10[0]  # [unsubscriptable-object]

# sets are not subscriptable
{x ** 2 for x in range(10)}[0]  # [unsubscriptable-object]
set(numbers)[0]  # [unsubscriptable-object]
frozenset(numbers)[0]  # [unsubscriptable-object]

# skip instances with unknown base classes
from some_missing_module import LibSubscriptable

class MaybeSubscriptable(LibSubscriptable):
    pass

MaybeSubscriptable()[0]

# subscriptable classes (through metaclasses)

class MetaSubscriptable(type):
    def __getitem__(cls, key):
        return key + key

class SubscriptableClass(six.with_metaclass(MetaSubscriptable, object)):
    pass

SubscriptableClass[0]
SubscriptableClass()[0]  # [unsubscriptable-object]

# functions are not subscriptable
def test(*args, **kwargs):
    return args, kwargs

test()[0]
test[0]  # [unsubscriptable-object]

# deque
from collections import deque
deq = deque(maxlen=10)
deq.append(42)
deq[0]


class AbstractClass(object):

    def __init__(self):
        self.ala = {i for i in range(10)}
        self.bala = [i for i in range(10)]
        self.portocala = None

    def test_unsubscriptable(self):
        self.bala[0]
        self.portocala[0]


class ClassMixin(object):

    def __init__(self):
        self.ala = {i for i in range(10)}
        self.bala = [i for i in range(10)]
        self.portocala = None

    def test_unsubscriptable(self):
        self.bala[0]
        self.portocala[0]
    