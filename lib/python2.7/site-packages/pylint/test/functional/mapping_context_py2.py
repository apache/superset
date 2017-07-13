# pylint: disable=missing-docstring,invalid-name,too-few-public-methods
from __future__ import print_function


def test(**kwargs):
    print(kwargs)

# metaclasses as mappings
class Meta(type):
    def __getitem__(self, key):
        return ord(key)
    def keys(self):
        return ['a', 'b', 'c']

class SomeClass(object):
    __metaclass__ = Meta

test(**SomeClass)
test(**SomeClass())  # [not-a-mapping]
