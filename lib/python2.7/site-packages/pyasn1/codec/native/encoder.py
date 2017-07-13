#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
try:
    from collections import OrderedDict

except ImportError:
    OrderedDict = dict

from pyasn1.type import base, univ, char, useful
from pyasn1 import debug, error

__all__ = ['encode']


class AbstractItemEncoder(object):
    def encode(self, encodeFun, value):
        raise error.PyAsn1Error('Not implemented')


class ExplicitlyTaggedItemEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        if isinstance(value, base.AbstractConstructedAsn1Item):
            value = value.clone(tagSet=value.getTagSet()[:-1],
                                cloneValueFlag=1)
        else:
            value = value.clone(tagSet=value.getTagSet()[:-1])
        return encodeFun(value)

explicitlyTaggedItemEncoder = ExplicitlyTaggedItemEncoder()


class BooleanEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return bool(value)


class IntegerEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return int(value)


class BitStringEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return str(value)


class OctetStringEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return value.asOctets()


class TextStringEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return value.prettyPrint()


class NullEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return None


class ObjectIdentifierEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return str(value)


class RealEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return float(value)


class SetEncoder(AbstractItemEncoder):
    protoDict = dict
    def encode(self, encodeFun, value):
        value.setDefaultComponents()
        value.verifySizeSpec()
        substrate = self.protoDict()
        for key, subValue in value.items():
            if subValue is None:  # Optional component
                continue
            substrate[key] = encodeFun(subValue)
        return substrate


class SequenceEncoder(SetEncoder):
    protoDict = OrderedDict


class SequenceOfEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        value.verifySizeSpec()
        return [encodeFun(x) for x in value]


class ChoiceEncoder(SequenceEncoder):
    pass


class AnyEncoder(AbstractItemEncoder):
    def encode(self, encodeFun, value):
        return value.asOctets()


tagMap = {
    univ.Boolean.tagSet: BooleanEncoder(),
    univ.Integer.tagSet: IntegerEncoder(),
    univ.BitString.tagSet: BitStringEncoder(),
    univ.OctetString.tagSet: OctetStringEncoder(),
    univ.Null.tagSet: NullEncoder(),
    univ.ObjectIdentifier.tagSet: ObjectIdentifierEncoder(),
    univ.Enumerated.tagSet: IntegerEncoder(),
    univ.Real.tagSet: RealEncoder(),
    # Sequence & Set have same tags as SequenceOf & SetOf
    univ.SequenceOf.tagSet: SequenceOfEncoder(),
    univ.SetOf.tagSet: SequenceOfEncoder(),
    univ.Choice.tagSet: ChoiceEncoder(),
    # character string types
    char.UTF8String.tagSet: TextStringEncoder(),
    char.NumericString.tagSet: TextStringEncoder(),
    char.PrintableString.tagSet: TextStringEncoder(),
    char.TeletexString.tagSet: TextStringEncoder(),
    char.VideotexString.tagSet: TextStringEncoder(),
    char.IA5String.tagSet: TextStringEncoder(),
    char.GraphicString.tagSet: TextStringEncoder(),
    char.VisibleString.tagSet: TextStringEncoder(),
    char.GeneralString.tagSet: TextStringEncoder(),
    char.UniversalString.tagSet: TextStringEncoder(),
    char.BMPString.tagSet: TextStringEncoder(),
    # useful types
    useful.ObjectDescriptor.tagSet: OctetStringEncoder(),
    useful.GeneralizedTime.tagSet: OctetStringEncoder(),
    useful.UTCTime.tagSet: OctetStringEncoder()
}

# Type-to-codec map for ambiguous ASN.1 types
typeMap = {
    univ.Set.typeId: SetEncoder(),
    univ.SetOf.typeId: SequenceOfEncoder(),
    univ.Sequence.typeId: SequenceEncoder(),
    univ.SequenceOf.typeId: SequenceOfEncoder(),
    univ.Choice.typeId: ChoiceEncoder(),
    univ.Any.typeId: AnyEncoder()
}


class Encoder(object):

    # noinspection PyDefaultArgument
    def __init__(self, tagMap, typeMap={}):
        self.__tagMap = tagMap
        self.__typeMap = typeMap

    def __call__(self, asn1Value):
        if not isinstance(asn1Value, base.Asn1Item):
            raise error.PyAsn1Error('value is not valid (should be an instance of an ASN.1 Item)')

        if debug.logger & debug.flagEncoder:
            debug.scope.push(type(asn1Value).__name__)
            debug.logger('encoder called for type %s <%s>' % (type(asn1Value).__name__, asn1Value.prettyPrint()))

        tagSet = asn1Value.getTagSet()
        if len(tagSet) > 1:
            concreteEncoder = explicitlyTaggedItemEncoder
        else:
            if asn1Value.typeId is not None and asn1Value.typeId in self.__typeMap:
                concreteEncoder = self.__typeMap[asn1Value.typeId]
            elif tagSet in self.__tagMap:
                concreteEncoder = self.__tagMap[tagSet]
            else:
                tagSet = asn1Value.baseTagSet
                if tagSet in self.__tagMap:
                    concreteEncoder = self.__tagMap[tagSet]
                else:
                    raise error.PyAsn1Error('No encoder for %s' % (asn1Value,))

        debug.logger & debug.flagEncoder and debug.logger('using value codec %s chosen by %s' % (type(concreteEncoder).__name__, tagSet))

        pyObject = concreteEncoder.encode(self, asn1Value)

        if debug.logger & debug.flagEncoder:
            debug.logger('encoder %s produced: %s' % (type(concreteEncoder).__name__, repr(pyObject)))
            debug.scope.pop()

        return pyObject


#: Turns ASN.1 object into a Python built-in type object(s).
#:
#: Takes any ASN.1 object (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#: walks all its components recursively and produces a Python built-in type or a tree
#: of those.
#:
#: One exception is that instead of :py:class:`dict`, the :py:class:`OrderedDict`
#: can be produced (whenever available) to preserve ordering of the components
#: in ASN.1 SEQUENCE.
#:
#: Parameters
#: ----------
#  asn1Value: any pyasn1 object (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#:     pyasn1 object to encode (or a tree of them)
#:
#: Returns
#: -------
#: : :py:class:`object`
#:     Python built-in type instance (or a tree of them)
#:
#: Raises
#: ------
#: : :py:class:`pyasn1.error.PyAsn1Error`
#:     On encoding errors
encode = Encoder(tagMap, typeMap)
