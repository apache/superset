enum --- support for enumerations
========================================

An enumeration is a set of symbolic names (members) bound to unique, constant
values.  Within an enumeration, the members can be compared by identity, and
the enumeration itself can be iterated over.

    from enum import Enum

    class Fruit(Enum):
        apple = 1
        banana = 2
        orange = 3

    list(Fruit)
    # [<Fruit.apple: 1>, <Fruit.banana: 2>, <Fruit.orange: 3>]

    len(Fruit)
    # 3

    Fruit.banana
    # <Fruit.banana: 2>

    Fruit['banana']
    # <Fruit.banana: 2>

    Fruit(2)
    # <Fruit.banana: 2>

    Fruit.banana is Fruit['banana'] is Fruit(2)
    # True

    Fruit.banana.name
    # 'banana'

    Fruit.banana.value
    # 2

Repository and Issue Tracker at https://bitbucket.org/stoneleaf/enum34.


