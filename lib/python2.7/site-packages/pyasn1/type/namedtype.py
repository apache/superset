#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
import sys
from pyasn1.type import tagmap
from pyasn1.compat import octets
from pyasn1 import error

__all__ = ['NamedType', 'OptionalNamedType', 'DefaultedNamedType', 'NamedTypes']


class NamedType(object):
    """Named type specification for constructed types
    """
    isOptional = 0
    isDefaulted = 0

    def __init__(self, name, t):
        self.__name = name
        self.__type = t

    def __repr__(self):
        return '%s(%r, %r)' % (
            self.__class__.__name__, self.__name, self.__type
        )

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

    def getType(self):
        return self.__type

    def getName(self):
        return self.__name

    def __getitem__(self, idx):
        if idx == 0:
            return self.__name
        if idx == 1:
            return self.__type
        raise IndexError()


class OptionalNamedType(NamedType):
    isOptional = 1


class DefaultedNamedType(NamedType):
    isDefaulted = 1


class NamedTypes(object):
    def __init__(self, *namedTypes):
        self.__namedTypes = namedTypes
        self.__namedTypesLen = len(self.__namedTypes)
        self.__minTagSet = None
        self.__tagToPosIdx = {}
        self.__nameToPosIdx = {}
        self.__tagMap = {False: None, True: None}
        self.__ambigiousTypes = {}

    def __repr__(self):
        return '%s(%s)' % (
            self.__class__.__name__,
            ', '.join([repr(x) for x in self.__namedTypes])
        )

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

    def __getitem__(self, idx):
        if octets.isStringType(idx):
            nameToPosIdx = self.__getNameToPosIdx()
            return self.__namedTypes[nameToPosIdx[idx]]
        else:
            return self.__namedTypes[idx]

    def __contains__(self, key):
        nameToPosIdx = self.__getNameToPosIdx()
        return key in nameToPosIdx

    def __iter__(self):
        return (x[0] for x in self.__namedTypes)

    if sys.version_info[0] <= 2:
        def __nonzero__(self):
            return bool(self.__namedTypesLen)
    else:
        def __bool__(self):
            return bool(self.__namedTypesLen)

    def __len__(self):
        return self.__namedTypesLen

    def clone(self):
        return self.__class__(*self.__namedTypes)

    def getTypeByPosition(self, idx):
        if idx < 0 or idx >= self.__namedTypesLen:
            raise error.PyAsn1Error('Type position out of range')
        else:
            return self.__namedTypes[idx].getType()

    def getPositionByType(self, tagSet):
        if not self.__tagToPosIdx:
            idx = self.__namedTypesLen
            while idx > 0:
                idx -= 1
                tagMap = self.__namedTypes[idx].getType().getTagMap() or tagmap.TagMap()
                for t in tagMap.getPosMap():
                    if t in self.__tagToPosIdx:
                        raise error.PyAsn1Error('Duplicate type %s' % (t,))
                    self.__tagToPosIdx[t] = idx
        try:
            return self.__tagToPosIdx[tagSet]
        except KeyError:
            raise error.PyAsn1Error('Type %s not found' % (tagSet,))

    def getNameByPosition(self, idx):
        try:
            return self.__namedTypes[idx].getName()
        except IndexError:
            raise error.PyAsn1Error('Type position out of range')

    def __getNameToPosIdx(self):
        if not self.__nameToPosIdx:
            idx = self.__namedTypesLen
            while idx > 0:
                idx -= 1
                n = self.__namedTypes[idx].getName()
                if n in self.__nameToPosIdx:
                    raise error.PyAsn1Error('Duplicate name %s' % (n,))
                self.__nameToPosIdx[n] = idx
        return self.__nameToPosIdx

    def getPositionByName(self, name):
        nameToPosIdx = self.__getNameToPosIdx()

        try:
            return nameToPosIdx[name]
        except KeyError:
            raise error.PyAsn1Error('Name %s not found' % (name,))

    def __buildAmbigiousTagMap(self):
        ambigiousTypes = ()
        idx = self.__namedTypesLen
        while idx > 0:
            idx -= 1
            t = self.__namedTypes[idx]
            if t.isOptional or t.isDefaulted:
                ambigiousTypes = (t,) + ambigiousTypes
            else:
                ambigiousTypes = (t,)
            self.__ambigiousTypes[idx] = NamedTypes(*ambigiousTypes)

    def getTagMapNearPosition(self, idx):
        if not self.__ambigiousTypes:
            self.__buildAmbigiousTagMap()
        try:
            return self.__ambigiousTypes[idx].getTagMap()
        except KeyError:
            raise error.PyAsn1Error('Type position out of range')

    def getPositionNearType(self, tagSet, idx):
        if not self.__ambigiousTypes:
            self.__buildAmbigiousTagMap()
        try:
            return idx + self.__ambigiousTypes[idx].getPositionByType(tagSet)
        except KeyError:
            raise error.PyAsn1Error('Type position out of range')

    def genMinTagSet(self):
        if self.__minTagSet is None:
            for t in self.__namedTypes:
                __type = t.getType()
                tagSet = getattr(__type, 'getMinTagSet', __type.getTagSet)()
                if self.__minTagSet is None or tagSet < self.__minTagSet:
                    self.__minTagSet = tagSet
        return self.__minTagSet

    def getTagMap(self, uniq=False):
        if self.__tagMap[uniq] is None:
            tagMap = tagmap.TagMap()
            for nt in self.__namedTypes:
                tagMap = tagMap.clone(
                    nt.getType(), nt.getType().getTagMap() or tagmap.TagMap(), uniq
                )
            self.__tagMap[uniq] = tagMap
        return self.__tagMap[uniq]
