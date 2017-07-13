# pylint: disable=missing-docstring,too-few-public-methods

def test_unused(first, second, _not_used): # [unused-argument, unused-argument]
    pass


def test_prefixed_with_ignored(first, ignored_second):
    first()


def test_prefixed_with_unused(first, unused_second):
    first()

# for Sub.inherited, only the warning for "aay" is desired.
# The warnings for "aab" and "aac"  are most likely false positives though,
# because there could be another subclass that overrides the same method and does
# use the arguments (eg Sub2)


class Base(object):
    "parent"
    def inherited(self, aaa, aab, aac):
        "abstract method"
        raise NotImplementedError

class Sub(Base):
    "child 1"
    def inherited(self, aaa, aab, aac):
        "overridden method, though don't use every argument"
        return aaa

    def newmethod(self, aax, aay): # [unused-argument]
        "another method, warning for aay desired"
        return self, aax

class Sub2(Base):
    "child 1"

    def inherited(self, aaa, aab, aac):
        "overridden method, use every argument"
        return aaa + aab + aac
