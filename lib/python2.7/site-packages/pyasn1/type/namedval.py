#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
# ASN.1 named integers
#
from pyasn1 import error

__all__ = ['NamedValues']


class NamedValues(object):
    def __init__(self, *namedValues):
        self.nameToValIdx = {}
        self.valToNameIdx = {}
        self.namedValues = ()
        automaticVal = 1
        for namedValue in namedValues:
            if isinstance(namedValue, tuple):
                name, val = namedValue
            else:
                name = namedValue
                val = automaticVal
            if name in self.nameToValIdx:
                raise error.PyAsn1Error('Duplicate name %s' % (name,))
            self.nameToValIdx[name] = val
            if val in self.valToNameIdx:
                raise error.PyAsn1Error('Duplicate value %s=%s' % (name, val))
            self.valToNameIdx[val] = name
            self.namedValues = self.namedValues + ((name, val),)
            automaticVal += 1

    def __repr__(self):
        return '%s(%s)' % (self.__class__.__name__, ', '.join([repr(x) for x in self.namedValues]))

    def __str__(self):
        return str(self.namedValues)

    def __eq__(self, other):
        return tuple(self) == tuple(other)

    def __ne__(self, other):
        return tuple(self) != tuple(other)

    def __lt__(self, other):
        return tuple(self) < tuple(other)

    def __le__(self, other):
        return tuple(self) <= tuple(other)

    def __gt__(self, other):
        return tuple(self) > tuple(other)

    def __ge__(self, other):
        return tuple(self) >= tuple(other)

    def __hash__(self):
        return hash(tuple(self))

    def getName(self, value):
        if value in self.valToNameIdx:
            return self.valToNameIdx[value]

    def getValue(self, name):
        if name in self.nameToValIdx:
            return self.nameToValIdx[name]

    def __getitem__(self, i):
        return self.namedValues[i]

    def __len__(self):
        return len(self.namedValues)

    def __add__(self, namedValues):
        return self.__class__(*self.namedValues + namedValues)

    def __radd__(self, namedValues):
        return self.__class__(*namedValues + tuple(self))

    def clone(self, *namedValues):
        return self.__class__(*tuple(self) + namedValues)

# XXX clone/subtype?
