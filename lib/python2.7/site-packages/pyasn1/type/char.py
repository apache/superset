#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
import sys
from pyasn1.type import univ, tag
from pyasn1 import error


__all__ = ['NumericString', 'PrintableString', 'TeletexString', 'T61String', 'VideotexString',
           'IA5String', 'GraphicString', 'VisibleString', 'ISO646String',
           'GeneralString', 'UniversalString', 'BMPString', 'UTF8String']

NoValue = univ.NoValue
noValue = univ.noValue


class AbstractCharacterString(univ.OctetString):
    """Creates |ASN.1| type or object.

    |ASN.1| objects are immutable and duck-type Python 2 :class:`unicode` or Python 3 :class:`str`.
    When used in octet-stream context, |ASN.1| type assumes "|encoding|" encoding.

    Parameters
    ----------
    value: :class:`unicode`, :class:`str`, :class:`bytes` or |ASN.1| object
        unicode object (Python 2) or string (Python 3), alternatively string
        (Python 2) or bytes (Python 3) representing octet-stream of serialized
        unicode string (note `encoding` parameter) or |ASN.1| class instance.

    tagSet: :py:class:`~pyasn1.type.tag.TagSet`
        Object representing non-default ASN.1 tag(s)

    subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
        Object representing non-default ASN.1 subtype constraint(s)

    encoding: :py:class:`str`
        Unicode codec ID to encode/decode :class:`unicode` (Python 2) or
        :class:`str` (Python 3) the payload when |ASN.1| object is used
        in octet-stream context.

    Raises
    ------
    : :py:class:`pyasn1.error.PyAsn1Error`
        On constraint violation or bad initializer.
    """

    if sys.version_info[0] <= 2:
        def __str__(self):
            try:
                return self._value.encode(self._encoding)
            except UnicodeEncodeError:
                raise error.PyAsn1Error(
                    'Can\'t encode string \'%s\' with \'%s\' codec' % (self._value, self._encoding)
                )

        def __unicode__(self):
            return unicode(self._value)

        def prettyIn(self, value):
            if isinstance(value, unicode):
                return value
            elif isinstance(value, str):
                try:
                    return value.decode(self._encoding)
                except (LookupError, UnicodeDecodeError):
                    raise error.PyAsn1Error(
                        'Can\'t decode string \'%s\' with \'%s\' codec' % (value, self._encoding)
                    )
            elif isinstance(value, (tuple, list)):
                try:
                    return self.prettyIn(''.join([chr(x) for x in value]))
                except ValueError:
                    raise error.PyAsn1Error(
                        'Bad %s initializer \'%s\'' % (self.__class__.__name__, value)
                    )
            else:
                try:
                    return unicode(value)
                except UnicodeDecodeError:
                    raise error.PyAsn1Error(
                        'Can\'t turn object \'%s\' into unicode' % (value,)
                    )

        def asOctets(self, padding=True):
            return str(self)

        def asNumbers(self, padding=True):
            return tuple([ord(x) for x in str(self)])

    else:
        def __str__(self):
            return str(self._value)

        def __bytes__(self):
            try:
                return self._value.encode(self._encoding)
            except UnicodeEncodeError:
                raise error.PyAsn1Error(
                    'Can\'t encode string \'%s\' with \'%s\' codec' % (self._value, self._encoding)
                )

        def prettyIn(self, value):
            if isinstance(value, str):
                return value
            elif isinstance(value, bytes):
                try:
                    return value.decode(self._encoding)
                except UnicodeDecodeError:
                    raise error.PyAsn1Error(
                        'Can\'t decode string \'%s\' with \'%s\' codec' % (value, self._encoding)
                    )
            elif isinstance(value, (tuple, list)):
                return self.prettyIn(bytes(value))
            else:
                try:
                    return str(value)
                except (UnicodeDecodeError, ValueError):
                    raise error.PyAsn1Error(
                        'Can\'t turn object \'%s\' into unicode' % (value,)
                    )

        def asOctets(self, padding=True):
            return bytes(self)

        def asNumbers(self, padding=True):
            return tuple(bytes(self))

    def prettyOut(self, value):
        return value

    def __reversed__(self):
        return reversed(self._value)

    def clone(self, value=noValue, tagSet=None, subtypeSpec=None,
              encoding=None, binValue=noValue, hexValue=noValue):
        """Creates a copy of a |ASN.1| type or object.

        Any parameters to the *clone()* method will replace corresponding
        properties of the |ASN.1| object.

        Parameters
        ----------
        value: :class:`unicode`, :class:`str`, :class:`bytes` or |ASN.1| object
            unicode object (Python 2) or string (Python 3), alternatively string
            (Python 2) or bytes (Python 3) representing octet-stream of serialized
            unicode string (note `encoding` parameter) or |ASN.1| class instance.

        tagSet: :py:class:`~pyasn1.type.tag.TagSet`
            Object representing non-default ASN.1 tag(s)

        subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 subtype constraint(s)

        encoding: :py:class:`str`
            Unicode codec ID to encode/decode :py:class:`unicode` (Python 2) or
            :py:class:`str` (Python 3) the payload when |ASN.1| object is used
            in octet-stream context.

        Returns
        -------
        :
            new instance of |ASN.1| type/value

        """
        return univ.OctetString.clone(self, value, tagSet, subtypeSpec, encoding, binValue, hexValue)

    def subtype(self, value=noValue, implicitTag=None, explicitTag=None,
                subtypeSpec=None, encoding=None, binValue=noValue, hexValue=noValue):
        """Creates a copy of a |ASN.1| type or object.

        Any parameters to the *subtype()* method will be added to the corresponding
        properties of the |ASN.1| object.

        Parameters
        ----------
        value: :class:`unicode`, :class:`str`, :class:`bytes` or |ASN.1| object
            unicode object (Python 2) or string (Python 3), alternatively string
            (Python 2) or bytes (Python 3) representing octet-stream of serialized
            unicode string (note `encoding` parameter) or |ASN.1| class instance.

        implicitTag: :py:class:`~pyasn1.type.tag.Tag`
            Implicitly apply given ASN.1 tag object to caller's
            :py:class:`~pyasn1.type.tag.TagSet`, then use the result as
            new object's ASN.1 tag(s).

        explicitTag: :py:class:`~pyasn1.type.tag.Tag`
            Explicitly apply given ASN.1 tag object to caller's
            :py:class:`~pyasn1.type.tag.TagSet`, then use the result as
            new object's ASN.1 tag(s).

        subtypeSpec: :py:class:`~pyasn1.type.constraint.ConstraintsIntersection`
            Object representing non-default ASN.1 subtype constraint(s)

        encoding: :py:class:`str`
            Unicode codec ID to encode/decode :py:class:`unicode` (Python 2) or
            :py:class:`str` (Python 3) the payload when |ASN.1| object is used
            in octet-stream context.

        Returns
        -------
        :
            new instance of |ASN.1| type/value

        """
        return univ.OctetString.subtype(self, value, implicitTag, explicitTag, subtypeSpec, encoding, binValue, hexValue)


class NumericString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 18)
    )
    encoding = 'us-ascii'


class PrintableString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 19)
    )
    encoding = 'us-ascii'


class TeletexString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 20)
    )
    encoding = 'iso-8859-1'


class T61String(TeletexString):
    __doc__ = TeletexString.__doc__


class VideotexString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 21)
    )
    encoding = 'iso-8859-1'


class IA5String(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 22)
    )
    encoding = 'us-ascii'


class GraphicString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 25)
    )
    encoding = 'iso-8859-1'


class VisibleString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 26)
    )
    encoding = 'us-ascii'


class ISO646String(VisibleString):
    __doc__ = VisibleString.__doc__


class GeneralString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 27)
    )
    encoding = 'iso-8859-1'


class UniversalString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 28)
    )
    encoding = "utf-32-be"


class BMPString(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 30)
    )
    encoding = "utf-16-be"


class UTF8String(AbstractCharacterString):
    __doc__ = AbstractCharacterString.__doc__

    #: Default :py:class:`~pyasn1.type.tag.TagSet` object for |ASN.1| objects
    tagSet = AbstractCharacterString.tagSet.tagImplicitly(
        tag.Tag(tag.tagClassUniversal, tag.tagFormatSimple, 12)
    )
    encoding = "utf-8"
