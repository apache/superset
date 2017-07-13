# pylint: disable=missing-docstring, too-few-public-methods, pointless-statement


class Parent(object):

    def __init__(self):
        self._parent = 42
        self._registry = {}
        self._similar1 = 24
        self._similar2 = 23
        self._similar3 = 24
        self._really_similar1 = 23
        self._really_similar2 = 42


class Child(Parent):

    def __init__(self):
        super(Child, self).__init__()

        self._similar # [no-member]
        self._really_similar # [no-member]
        self._paren # [no-member]
        # Distance is too big
        self._registryyyy # [no-member]
        # Nothing close.
        self._pretty_sure_this_wont_match # [no-member]
