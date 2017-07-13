#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
import sys
from pyasn1.type import constraint, tagmap, tag
from pyasn1 import error

__all__ = ['Asn1Item', 'Asn1ItemBase', 'AbstractSimpleAsn1Item', 'AbstractConstructedAsn1Item']


class Asn1Item(object):
    pass


class Asn1ItemBase(Asn1Item):
    #: Default :py:class:`~pyasn1.type.tag.TagSet` object representing
    #: ASN.1 tag(s) associated with this ASN.1 type.
    tagSet = tag.TagSet()

    #: Default :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
    #: object imposing constraints on initialization values.
    subtypeSpec = constraint.ConstraintsIntersection()

    # Used for ambiguous ASN.1 types identification
    typeId = None

    def __init__(self, tagSet=None, subtypeSpec=None):
        if tagSet is None:
            self._tagSet = self.tagSet
        else:
            self._tagSet = tagSet
        if subtypeSpec is None:
            self._subtypeSpec = self.subtypeSpec
        else:
            self._subtypeSpec = subtypeSpec

    def _verifySubtypeSpec(self, value, idx=None):
        try:
            self._subtypeSpec(value, idx)
        except error.PyAsn1Error:
            c, i, t = sys.exc_info()
            raise c('%s at %s' % (i, self.__class__.__name__))

    def getSubtypeSpec(self):
        return self._subtypeSpec

    def getTagSet(self):
        return self._tagSet

    def getEffectiveTagSet(self):
        return self._tagSet  # used by untagged types

    def getTagMap(self):
        return tagmap.TagMap({self._tagSet: self})

    def isSameTypeWith(self, other, matchTags=True, matchConstraints=True):
        """Examine |ASN.1| type for equality with other ASN.1 type.

        ASN.1 tags (:py:mod:`~pyasn1.type.tag`) and constraints
        (:py:mod:`~pyasn1.type.constraint`) are examined when carrying
        out ASN.1 types comparison.

        No Python inheritance relationship between PyASN1 objects is considered.

        Parameters
        ----------
        other: a pyasn1 type object
            Class instance representing ASN.1 type.

        Returns
        -------
        : :class:`bool`
            :class:`True` if *other* is |ASN.1| type,
            :class:`False` otherwise.
        """
        return self is other or \
            (not matchTags or
             self._tagSet == other.getTagSet()) and \
            (not matchConstraints or
             self._subtypeSpec == other.getSubtypeSpec())

    def isSuperTypeOf(self, other, matchTags=True, matchConstraints=True):
        """Examine |ASN.1| type for subtype relationship with other ASN.1 type.
        
        ASN.1 tags (:py:mod:`~pyasn1.type.tag`) and constraints
        (:py:mod:`~pyasn1.type.constraint`) are examined when carrying
        out ASN.1 types comparison.

        No Python inheritance relationship between PyASN1 objects is considered.


        Parameters
        ----------
            other: a pyasn1 type object
                Class instance representing ASN.1 type. 

        Returns
        -------
            : :class:`bool`
                :class:`True` if *other* is a subtype of |ASN.1| type,
                :class:`False` otherwise.
        """
        return (not matchTags or
                self._tagSet.isSuperTagSetOf(other.getTagSet())) and \
               (not matchConstraints or
                (self._subtypeSpec.isSuperTypeOf(other.getSubtypeSpec())))

    @staticmethod
    def isNoValue(*values):
        for value in values:
            if value is not None and value is not noValue:
                return False
        return True


class NoValue(object):
    """Create a singleton instance of NoValue class.

    NoValue object can be used as an initializer on PyASN1 type class
    instantiation to represent ASN.1 type rather than ASN.1 data value.

    No operations other than type comparison can be performed on
    a PyASN1 type object.
    """
    skipMethods = ('__getattribute__', '__getattr__', '__setattr__', '__delattr__',
                   '__class__', '__init__', '__del__', '__new__', '__repr__', 
                   '__qualname__', '__objclass__', 'im_class', '__sizeof__')

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            def getPlug(name):
                def plug(self, *args, **kw):
                    raise error.PyAsn1Error('Uninitialized ASN.1 value ("%s" attribute looked up)' % name)
                return plug

            op_names = [name
                        for typ in (str, int, list, dict)
                        for name in dir(typ)
                        if name not in cls.skipMethods and name.startswith('__') and name.endswith('__') and callable(getattr(typ, name))]

            for name in set(op_names):
                setattr(cls, name, getPlug(name))

            cls._instance = object.__new__(cls)

        return cls._instance

    def __getattr__(self, attr):
        if attr in self.skipMethods:
            raise AttributeError('attribute %s not present' % attr)
        raise error.PyAsn1Error('No value for "%s"' % attr)

    def __repr__(self):
        return '%s()' % self.__class__.__name__

noValue = NoValue()


# Base class for "simple" ASN.1 objects. These are immutable.
class AbstractSimpleAsn1Item(Asn1ItemBase):
    #: Default payload value
    defaultValue = noValue

    def __init__(self, value=noValue, tagSet=None, subtypeSpec=None):
        Asn1ItemBase.__init__(self, tagSet, subtypeSpec)
        if self.isNoValue(value):
            value = self.defaultValue
        if self.isNoValue(value):
            self.__hashedValue = value = noValue
        else:
            value = self.prettyIn(value)
            self._verifySubtypeSpec(value)
            self.__hashedValue = hash(value)
        self._value = value
        self._len = None

    def __repr__(self):
        r = []
        if self._value is not self.defaultValue:
            r.append(self.prettyOut(self._value))
        if self._tagSet is not self.tagSet:
            r.append('tagSet=%r' % (self._tagSet,))
        if self._subtypeSpec is not self.subtypeSpec:
            r.append('subtypeSpec=%r' % (self._subtypeSpec,))
        return '%s(%s)' % (self.__class__.__name__, ', '.join(r))

    def __str__(self):
        return str(self._value)

    def __eq__(self, other):
        return self is other and True or self._value == other

    def __ne__(self, other):
        return self._value != other

    def __lt__(self, other):
        return self._value < other

    def __le__(self, other):
        return self._value <= other

    def __gt__(self, other):
        return self._value > other

    def __ge__(self, other):
        return self._value >= other

    if sys.version_info[0] <= 2:
        def __nonzero__(self):
            return bool(self._value)
    else:
        def __bool__(self):
            return bool(self._value)

    def __hash__(self):
        return self.__hashedValue is noValue and hash(noValue) or self.__hashedValue

    def hasValue(self):
        """Indicate if |ASN.1| object represents ASN.1 value or ASN.1 type.

        The PyASN1 type objects can only participate in types comparison
        and serve as a blueprint for serialization codecs to resolve
        ambiguous types.

        The PyASN1 value objects can additionally participate to most
        of built-in Python operations.

        Returns
        -------
        : :class:`bool`
            :class:`True` if object is ASN.1 value,
            :class:`False` otherwise.

        """
        return self._value is not noValue

    def clone(self, value=noValue, tagSet=None, subtypeSpec=None):
        """Create a copy of a |ASN.1| type or object.

          Any parameters to the *clone()* method will replace corresponding
          properties of the |ASN.1| object.

          Parameters
          ----------
          value: :class:`tuple`, :class:`str` or |ASN.1| object
              Initialization value to pass to new ASN.1 object instead of
              inheriting one from the caller.

          tagSet: :py:class:`~pyasn1.type.tag.TagSet`
              Object representing ASN.1 tag(s) to use in new object instead of inheriting from the caller

          subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
              Object representing ASN.1 subtype constraint(s) to use in new object instead of inheriting from the caller

          Returns
          -------
          :
              new instance of |ASN.1| type/value
        """
        if self.isNoValue(value):
            if self.isNoValue(tagSet, subtypeSpec):
                return self
            value = self._value
        if tagSet is None:
            tagSet = self._tagSet
        if subtypeSpec is None:
            subtypeSpec = self._subtypeSpec
        return self.__class__(value, tagSet, subtypeSpec)

    def subtype(self, value=noValue, implicitTag=None, explicitTag=None,
                subtypeSpec=None):
        """Create a copy of a |ASN.1| type or object.

         Any parameters to the *subtype()* method will be added to the corresponding
         properties of the |ASN.1| object.

         Parameters
         ----------
         value: :class:`tuple`, :class:`str` or |ASN.1| object
             Initialization value to pass to new ASN.1 object instead of
             inheriting one from the caller.

         implicitTag: :py:class:`~pyasn1.type.tag.Tag`
             Implicitly apply given ASN.1 tag object to caller's
             :py:class:`~pyasn1.type.tag.TagSet`, then use the result as
             new object's ASN.1 tag(s).

         explicitTag: :py:class:`~pyasn1.type.tag.Tag`
             Explicitly apply given ASN.1 tag object to caller's
             :py:class:`~pyasn1.type.tag.TagSet`, then use the result as
             new object's ASN.1 tag(s).

         subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
             Add ASN.1 constraints object to one of the caller, then
             use the result as new object's ASN.1 constraints.

         Returns
         -------
         :
             new instance of |ASN.1| type/value
        """
        if self.isNoValue(value):
            value = self._value
        if implicitTag is not None:
            tagSet = self._tagSet.tagImplicitly(implicitTag)
        elif explicitTag is not None:
            tagSet = self._tagSet.tagExplicitly(explicitTag)
        else:
            tagSet = self._tagSet
        if subtypeSpec is None:
            subtypeSpec = self._subtypeSpec
        else:
            subtypeSpec = self._subtypeSpec + subtypeSpec
        return self.__class__(value, tagSet, subtypeSpec)

    def prettyIn(self, value):
        return value

    def prettyOut(self, value):
        return str(value)

    def prettyPrint(self, scope=0):
        """Provide human-friendly printable object representation.

        Returns
        -------
        : :class:`str`
            human-friendly type and/or value representation.
        """
        if self.hasValue():
            return self.prettyOut(self._value)
        else:
            return '<no value>'

    # XXX Compatibility stub
    def prettyPrinter(self, scope=0):
        return self.prettyPrint(scope)

    # noinspection PyUnusedLocal
    def prettyPrintType(self, scope=0):
        return '%s -> %s' % (self.getTagSet(), self.__class__.__name__)


#
# Constructed types:
# * There are five of them: Sequence, SequenceOf/SetOf, Set and Choice
# * ASN1 types and values are represened by Python class instances
# * Value initialization is made for defaulted components only
# * Primary method of component addressing is by-position. Data model for base
#   type is Python sequence. Additional type-specific addressing methods
#   may be implemented for particular types.
# * SequenceOf and SetOf types do not implement any additional methods
# * Sequence, Set and Choice types also implement by-identifier addressing
# * Sequence, Set and Choice types also implement by-asn1-type (tag) addressing
# * Sequence and Set types may include optional and defaulted
#   components
# * Constructed types hold a reference to component types used for value
#   verification and ordering.
# * Component type is a scalar type for SequenceOf/SetOf types and a list
#   of types for Sequence/Set/Choice.
#

def setupComponent():
    """Returns a sentinel value.

     Indicates to a constructed type to set up its inner component so that it
     can be referred to. This is useful in situation when you want to populate
     descendants of a constructed type what requires being able to refer to
     their parent types along the way.

     Example
     -------

     >>> constructed['record'] = setupComponent()
     >>> constructed['record']['scalar'] = 42
    """
    return noValue


class AbstractConstructedAsn1Item(Asn1ItemBase):

    #: If `True`, requires exact component type matching,
    #: otherwise subtype relation is only enforced
    strictConstraints = False

    def __init__(self, componentType=None, tagSet=None,
                 subtypeSpec=None, sizeSpec=None):
        Asn1ItemBase.__init__(self, tagSet, subtypeSpec)
        if componentType is None:
            self._componentType = self.componentType
        else:
            self._componentType = componentType
        if sizeSpec is None:
            self._sizeSpec = self.sizeSpec
        else:
            self._sizeSpec = sizeSpec
        self._componentValues = []
        self._componentValuesSet = 0

    def __repr__(self):
        r = []
        if self._componentType is not self.componentType:
            r.append('componentType=%r' % (self._componentType,))
        if self._tagSet is not self.tagSet:
            r.append('tagSet=%r' % (self._tagSet,))
        if self._subtypeSpec is not self.subtypeSpec:
            r.append('subtypeSpec=%r' % (self._subtypeSpec,))
        r = '%s(%s)' % (self.__class__.__name__, ', '.join(r))
        if self._componentValues:
            r += '.setComponents(%s)' % ', '.join([repr(x) for x in self._componentValues])
        return r

    def __eq__(self, other):
        return self is other and True or self._componentValues == other

    def __ne__(self, other):
        return self._componentValues != other

    def __lt__(self, other):
        return self._componentValues < other

    def __le__(self, other):
        return self._componentValues <= other

    def __gt__(self, other):
        return self._componentValues > other

    def __ge__(self, other):
        return self._componentValues >= other

    if sys.version_info[0] <= 2:
        def __nonzero__(self):
            return bool(self._componentValues)
    else:
        def __bool__(self):
            return bool(self._componentValues)

    def getComponentTagMap(self):
        raise error.PyAsn1Error('Method not implemented')

    def _cloneComponentValues(self, myClone, cloneValueFlag):
        pass

    def clone(self, tagSet=None, subtypeSpec=None, sizeSpec=None, cloneValueFlag=None):
        """Create a copy of a |ASN.1| type or object.

        Any parameters to the *clone()* method will replace corresponding
        properties of the |ASN.1| object.

        Parameters
        ----------
        tagSet: :py:class:`~pyasn1.type.tag.TagSet`
            Object representing non-default ASN.1 tag(s)

        subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 subtype constraint(s)

        sizeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 size constraint(s)

        Returns
        -------
        :
            new instance of |ASN.1| type/value

        """
        if tagSet is None:
            tagSet = self._tagSet
        if subtypeSpec is None:
            subtypeSpec = self._subtypeSpec
        if sizeSpec is None:
            sizeSpec = self._sizeSpec
        r = self.__class__(self._componentType, tagSet, subtypeSpec, sizeSpec)
        if cloneValueFlag:
            self._cloneComponentValues(r, cloneValueFlag)
        return r

    def subtype(self, implicitTag=None, explicitTag=None, subtypeSpec=None,
                sizeSpec=None, cloneValueFlag=None):
        """Create a copy of a |ASN.1| type or object.

        Any parameters to the *subtype()* method will be added to the corresponding
        properties of the |ASN.1| object.

        Parameters
        ----------
        tagSet: :py:class:`~pyasn1.type.tag.TagSet`
            Object representing non-default ASN.1 tag(s)

        subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 subtype constraint(s)

        sizeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 size constraint(s)

        Returns
        -------
        :
            new instance of |ASN.1| type/value

        """
        if implicitTag is not None:
            tagSet = self._tagSet.tagImplicitly(implicitTag)
        elif explicitTag is not None:
            tagSet = self._tagSet.tagExplicitly(explicitTag)
        else:
            tagSet = self._tagSet
        if subtypeSpec is None:
            subtypeSpec = self._subtypeSpec
        else:
            subtypeSpec = self._subtypeSpec + subtypeSpec
        if sizeSpec is None:
            sizeSpec = self._sizeSpec
        else:
            sizeSpec = sizeSpec + self._sizeSpec
        r = self.__class__(self._componentType, tagSet, subtypeSpec, sizeSpec)
        if cloneValueFlag:
            self._cloneComponentValues(r, cloneValueFlag)
        return r

    def _verifyComponent(self, idx, value):
        pass

    def verifySizeSpec(self):
        self._sizeSpec(self)

    def getComponentByPosition(self, idx):
        raise error.PyAsn1Error('Method not implemented')

    def setComponentByPosition(self, idx, value, verifyConstraints=True):
        raise error.PyAsn1Error('Method not implemented')

    def setComponents(self, *args, **kwargs):
        for idx, value in enumerate(args):
            self[idx] = value
        for k in kwargs:
            self[k] = kwargs[k]
        return self

    def getComponentType(self):
        return self._componentType

    def setDefaultComponents(self):
        pass

    def __getitem__(self, idx):
        return self.getComponentByPosition(idx)

    def __setitem__(self, idx, value):
        self.setComponentByPosition(idx, value)

    def __len__(self):
        return len(self._componentValues)

    def clear(self):
        self._componentValues = []
        self._componentValuesSet = 0
