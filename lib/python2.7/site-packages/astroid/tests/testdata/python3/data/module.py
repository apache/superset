"""test module for astroid
"""

__revision__ = '$Id: module.py,v 1.2 2005-11-02 11:56:54 syt Exp $'
from astroid.node_classes import Name as NameNode
from astroid import modutils
from astroid.utils import *
import os.path
MY_DICT = {}

def global_access(key, val):
    """function test"""
    local = 1
    MY_DICT[key] = val
    for i in val:
        if i:
            del MY_DICT[i]
            continue
        else:
            break
    else:
        return


class YO:
    """hehe"""
    a = 1
    
    def __init__(self):
        try:
            self.yo = 1
        except ValueError as ex:
            pass
        except (NameError, TypeError):
            raise XXXError()
        except:
            raise



class YOUPI(YO):
    class_attr = None
    
    def __init__(self):
        self.member = None
    
    def method(self):
        """method test"""
        global MY_DICT
        try:
            MY_DICT = {}
            local = None
            autre = [a for (a, b) in MY_DICT if b]
            if b in autre:
                return
            else:
                if a in autre:
                    return 'hehe'
            global_access(local, val=autre)
        finally:
            return local
    
    def static_method():
        """static method test"""
        assert MY_DICT, '???'
    static_method = staticmethod(static_method)
    
    def class_method(cls):
        """class method test"""
        exec(a, b)
    class_method = classmethod(class_method)


def four_args(a, b, c, d):
    """four arguments (was nested_args)"""
    while 1:
        if a:
            break
        a += +1
    else:
        b += -2
    if c:
        d = ((a) and (b)) or (c)
    else:
        c = ((a) and (b)) or (d)
    list(map(lambda x, y: (y, x), a))
redirect = four_args

