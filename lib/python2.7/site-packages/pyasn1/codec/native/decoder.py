#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from pyasn1.type import base, univ, char, useful
from pyasn1 import debug, error

__all__ = ['decode']


class AbstractScalarDecoder(object):
    def __call__(self, pyObject, asn1Spec, decoderFunc=None):
        return asn1Spec.clone(pyObject)


class BitStringDecoder(AbstractScalarDecoder):
    def __call__(self, pyObject, asn1Spec, decoderFunc=None):
        return asn1Spec.clone(univ.BitString.fromBinaryString(pyObject))


class SequenceOrSetDecoder(object):
    def __call__(self, pyObject, asn1Spec, decoderFunc):
        asn1Value = asn1Spec.clone()

        componentsTypes = asn1Spec.getComponentType()

        for field in asn1Value:
            if field in pyObject:
                asn1Value[field] = decoderFunc(pyObject[field], componentsTypes[field].getType())

        return asn1Value


class SequenceOfOrSetOfDecoder(object):
    def __call__(self, pyObject, asn1Spec, decoderFunc):
        asn1Value = asn1Spec.clone()

        for pyValue in pyObject:
            asn1Value.append(decoderFunc(pyValue, asn1Spec.getComponentType()))

        return asn1Value


class ChoiceDecoder(object):
    def __call__(self, pyObject, asn1Spec, decoderFunc):
        asn1Value = asn1Spec.clone()

        componentsTypes = asn1Spec.getComponentType()

        for field in pyObject:
            if field in componentsTypes:
                asn1Value[field] = decoderFunc(pyObject[field], componentsTypes[field].getType())
                break

        return asn1Value


tagMap = {
    univ.Integer.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.Boolean.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.BitString.tagSet.getBaseTag(): BitStringDecoder(),
    univ.OctetString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.Null.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.ObjectIdentifier.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.Enumerated.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.Real.tagSet.getBaseTag(): AbstractScalarDecoder(),
    univ.Sequence.tagSet.getBaseTag(): SequenceOrSetDecoder(),  # conflicts with SequenceOf
    univ.Set.tagSet.getBaseTag(): SequenceOrSetDecoder(),  # conflicts with SetOf
    univ.Choice.tagSet.getBaseTag(): ChoiceDecoder(),  # conflicts with Any
    # character string types
    char.UTF8String.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.NumericString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.PrintableString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.TeletexString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.VideotexString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.IA5String.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.GraphicString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.VisibleString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.GeneralString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.UniversalString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    char.BMPString.tagSet.getBaseTag(): AbstractScalarDecoder(),
    # useful types
    useful.ObjectDescriptor.tagSet.getBaseTag(): AbstractScalarDecoder(),
    useful.GeneralizedTime.tagSet.getBaseTag(): AbstractScalarDecoder(),
    useful.UTCTime.tagSet.getBaseTag(): AbstractScalarDecoder()
}

# Type-to-codec map for ambiguous ASN.1 types
typeMap = {
    univ.Set.typeId: SequenceOrSetDecoder(),
    univ.SetOf.typeId: SequenceOfOrSetOfDecoder(),
    univ.Sequence.typeId: SequenceOrSetDecoder(),
    univ.SequenceOf.typeId: SequenceOfOrSetOfDecoder(),
    univ.Choice.typeId: ChoiceDecoder(),
    univ.Any.typeId: AbstractScalarDecoder()
}


class Decoder(object):

    # noinspection PyDefaultArgument
    def __init__(self, tagMap, typeMap):
        self.__tagMap = tagMap
        self.__typeMap = typeMap

    def __call__(self, pyObject, asn1Spec):
        if debug.logger & debug.flagDecoder:
            debug.scope.push(type(pyObject).__name__)
            debug.logger('decoder called at scope %s, working with type %s' % (debug.scope, type(pyObject).__name__))

        if asn1Spec is None or not isinstance(asn1Spec, base.Asn1Item):
            raise error.PyAsn1Error('asn1Spec is not valid (should be an instance of an ASN.1 Item, not %s)' % asn1Spec.__class__.__name__)

        if asn1Spec.typeId is not None and asn1Spec.typeId in self.__typeMap:
            valueDecoder = self.__typeMap[asn1Spec.typeId]
        elif asn1Spec.tagSet.getBaseTag() in self.__tagMap:
            valueDecoder = self.__tagMap[asn1Spec.tagSet.getBaseTag()]
        else:
            raise error.PyAsn1Error('Unknown ASN.1 tag %s' % asn1Spec.tagSet)

        if debug.logger & debug.flagDecoder:
            debug.logger('calling decoder %s on Python type %s <%s>' % (type(valueDecoder).__name__, type(pyObject).__name__, repr(pyObject)))

        value = valueDecoder(pyObject, asn1Spec, self)

        if debug.logger & debug.flagDecoder:
            debug.logger('decoder %s produced ASN.1 type %s <%s>' % (type(valueDecoder).__name__, type(value).__name__, repr(value)))
            debug.scope.pop()

        return value


#: Turns Python objects of built-in types into ASN.1 objects.
#:
#: Takes Python objects of built-in types and turns them into a tree of
#: ASN.1 objects (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative) which
#: may be a scalar or an arbitrary nested structure.
#:
#: Parameters
#: ----------
#: pyObject: :py:class:`object`
#:     A scalar or nested Python objects
#:
#: asn1Spec: any pyasn1 type object e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative
#:     A pyasn1 type object to act as a template guiding the decoder. It is required
#:     for successful interpretation of Python objects mapping into their ASN.1
#:     representations.
#:
#: Returns
#: -------
#: : :py:class:`~pyasn1.type.base.PyAsn1Item` derivative
#:     A scalar or constructed pyasn1 object
#:
#: Raises
#: ------
#: : :py:class:`pyasn1.error.PyAsn1Error`
#:     On decoding errors
decode = Decoder(tagMap, typeMap)
