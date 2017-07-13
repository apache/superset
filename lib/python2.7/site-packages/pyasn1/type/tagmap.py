#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from pyasn1 import error

__all__ = ['TagMap']


class TagMap(object):
    # noinspection PyDefaultArgument
    def __init__(self, posMap={}, negMap={}, defType=None):
        self.__posMap = posMap.copy()
        self.__negMap = negMap.copy()
        self.__defType = defType

    def __contains__(self, tagSet):
        return tagSet in self.__posMap or \
               self.__defType is not None and tagSet not in self.__negMap

    def __getitem__(self, tagSet):
        if tagSet in self.__posMap:
            return self.__posMap[tagSet]
        elif tagSet in self.__negMap:
            raise error.PyAsn1Error('Key in negative map')
        elif self.__defType is not None:
            return self.__defType
        else:
            raise KeyError()

    def __repr__(self):
        s = self.__class__.__name__ + '('
        if self.__posMap:
            s += 'posMap=%r, ' % (self.__posMap,)
        if self.__negMap:
            s += 'negMap=%r, ' % (self.__negMap,)
        if self.__defType is not None:
            s += 'defType=%r' % (self.__defType,)
        return s + ')'

    def __str__(self):
        s = self.__class__.__name__ + ':\n'
        if self.__posMap:
            s += 'posMap:\n%s, ' % ',\n '.join([x.prettyPrintType() for x in self.__posMap.values()])
        if self.__negMap:
            s += 'negMap:\n%s, ' % ',\n '.join([x.prettyPrintType() for x in self.__negMap.values()])
        if self.__defType is not None:
            s += 'defType:\n%s, ' % self.__defType.prettyPrintType()
        return s

    def clone(self, parentType, tagMap, uniq=False):
        if self.__defType is not None and tagMap.getDef() is not None:
            raise error.PyAsn1Error('Duplicate default value at %s' % (self,))
        if tagMap.getDef() is not None:
            defType = tagMap.getDef()
        else:
            defType = self.__defType

        posMap = self.__posMap.copy()
        for k in tagMap.getPosMap():
            if uniq and k in posMap:
                raise error.PyAsn1Error('Duplicate positive key %s' % (k,))
            posMap[k] = parentType

        negMap = self.__negMap.copy()
        negMap.update(tagMap.getNegMap())

        return self.__class__(
            posMap, negMap, defType,
        )

    def getPosMap(self):
        return self.__posMap.copy()

    def getNegMap(self):
        return self.__negMap.copy()

    def getDef(self):
        return self.__defType
