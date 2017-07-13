# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import astroid


def _collections_transform():
    return astroid.parse('''
    class defaultdict(dict):
        default_factory = None
        def __missing__(self, key): pass
        def __getitem__(self, key): return default_factory

    class deque(object):
        maxlen = 0
        def __init__(self, iterable=None, maxlen=None):
            self.iterable = iterable
        def append(self, x): pass
        def appendleft(self, x): pass
        def clear(self): pass
        def count(self, x): return 0
        def extend(self, iterable): pass
        def extendleft(self, iterable): pass
        def pop(self): pass
        def popleft(self): pass
        def remove(self, value): pass
        def reverse(self): pass
        def rotate(self, n): pass
        def __iter__(self): return self
        def __reversed__(self): return self.iterable[::-1]
        def __getitem__(self, index): pass
        def __setitem__(self, index, value): pass
        def __delitem__(self, index): pass

        def OrderedDict(dict):
            def __reversed__(self): return self[::-1]
    ''')


astroid.register_module_extender(astroid.MANAGER, 'collections', _collections_transform)

