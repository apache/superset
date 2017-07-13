#pylint: disable=C0103,R0904,R0903,W0201,old-style-class,no-absolute-import
"""
This module demonstrates a possible problem of pyLint with calling __init__ s
from inherited classes.
Initializations done there are not considered, which results in Error E0203 for
self.cookedq.
"""

from __future__ import print_function

import telnetlib

class SeeTelnet(telnetlib.Telnet):
    """
    Extension of telnetlib.
    """

    def __init__(self, host=None, port=0):
        """
        Constructor.
        When called without arguments, create an unconnected instance.
        With a hostname argument, it connects the instance; a port
        number is optional.
        Parameter:
        - host: IP address of the host
        - port: Port number
        """
        telnetlib.Telnet.__init__(self, host, port)

    def readUntilArray(self, matches, _=None):
        """
        Read until a given string is encountered or until timeout.
        ...
        """
        self.process_rawq()
        maxLength = 0
        for match in matches:
            if len(match) > maxLength:
                maxLength = len(match)

class Base(object):
    """bla bla"""
    dougloup_papa = None

    def __init__(self):
        self._var = False

class Derived(Base):
    """derived blabla"""
    dougloup_moi = None
    def Work(self):
        """do something"""
        # E0203 - Access to member '_var' before its definition
        if self._var:
            print("True")
        else:
            print("False")
        self._var = True

        # E0203 - Access to member 'dougloup_papa' before its definition
        if self.dougloup_papa:
            print('dougloup !')
        self.dougloup_papa = True
        # E0203 - Access to member 'dougloup_moi' before its definition
        if self.dougloup_moi:
            print('dougloup !')
        self.dougloup_moi = True


class QoSALConnection(object):
    """blabla"""

    _the_instance = None

    def __new__(cls):
        if cls._the_instance is None:
            cls._the_instance = object.__new__(cls)
        return cls._the_instance

    def __init__(self):
        pass

class DefinedOutsideInit(object):
    """use_attr is seen as the method defining attr because its in
    first position
    """
    def __init__(self):
        self.reset()

    def use_attr(self):
        """use and set members"""
        if self.attr:
            print('hop')
        self.attr = 10

    def reset(self):
        """reset members"""
        self.attr = 4
