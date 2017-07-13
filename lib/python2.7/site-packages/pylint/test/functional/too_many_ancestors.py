# pylint: disable=missing-docstring, too-few-public-methods

class Aaaa(object):
    pass
class Bbbb(object):
    pass
class Cccc(object):
    pass
class Dddd(object):
    pass
class Eeee(object):
    pass
class Ffff(object):
    pass
class Gggg(object):
    pass
class Hhhh(object):
    pass

class Iiii(Aaaa, Bbbb, Cccc, Dddd, Eeee, Ffff, Gggg, Hhhh): # [too-many-ancestors]
    pass

class Jjjj(Iiii): # [too-many-ancestors]
    pass
