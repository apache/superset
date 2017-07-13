#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from pyasn1.type import univ
from pyasn1.type import useful
from pyasn1.codec.ber import encoder
from pyasn1.compat.octets import int2oct, str2octs, null
from pyasn1 import error

__all__ = ['encode']


class BooleanEncoder(encoder.IntegerEncoder):
    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        if client == 0:
            substrate = int2oct(0)
        else:
            substrate = int2oct(255)
        return substrate, 0


class BitStringEncoder(encoder.BitStringEncoder):
    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        return encoder.BitStringEncoder.encodeValue(
            self, encodeFun, client, defMode, 1000
        )


class OctetStringEncoder(encoder.OctetStringEncoder):
    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        return encoder.OctetStringEncoder.encodeValue(
            self, encodeFun, client, defMode, 1000
        )


class RealEncoder(encoder.RealEncoder):
    def _chooseEncBase(self, value):
        m, b, e = value
        return self._dropFloatingPoint(m, b, e)


# specialized GeneralStringEncoder here

class GeneralizedTimeEncoder(OctetStringEncoder):
    zchar = str2octs('Z')
    pluschar = str2octs('+')
    minuschar = str2octs('-')
    zero = str2octs('0')

    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        octets = client.asOctets()
        # This breaks too many existing data items
        #        if '.' not in octets:
        #            raise error.PyAsn1Error('Format must include fraction of second: %r' % octets)
        if len(octets) < 15:
            raise error.PyAsn1Error('Bad UTC time length: %r' % octets)
        if self.pluschar in octets or self.minuschar in octets:
            raise error.PyAsn1Error('Must be UTC time: %r' % octets)
        if octets[-1] != self.zchar[0]:
            raise error.PyAsn1Error('Missing timezone specifier: %r' % octets)
        return encoder.OctetStringEncoder.encodeValue(
            self, encodeFun, client, defMode, 1000
        )


class UTCTimeEncoder(encoder.OctetStringEncoder):
    zchar = str2octs('Z')
    pluschar = str2octs('+')
    minuschar = str2octs('-')

    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        octets = client.asOctets()
        if self.pluschar in octets or self.minuschar in octets:
            raise error.PyAsn1Error('Must be UTC time: %r' % octets)
        if octets and octets[-1] != self.zchar[0]:
            client = client.clone(octets + self.zchar)
        if len(client) != 13:
            raise error.PyAsn1Error('Bad UTC time length: %r' % client)
        return encoder.OctetStringEncoder.encodeValue(
            self, encodeFun, client, defMode, 1000
        )


class SetOfEncoder(encoder.SequenceOfEncoder):
    def encodeValue(self, encodeFun, client, defMode, maxChunkSize):
        if isinstance(client, univ.SequenceAndSetBase):
            client.setDefaultComponents()
        client.verifySizeSpec()
        substrate = null
        idx = len(client)
        # This is certainly a hack but how else do I distinguish SetOf
        # from Set if they have the same tags&constraints?
        if isinstance(client, univ.SequenceAndSetBase):
            # Set
            comps = []
            while idx > 0:
                idx -= 1
                if client[idx] is None:  # Optional component
                    continue
                if client.getDefaultComponentByPosition(idx) == client[idx]:
                    continue
                comps.append(client[idx])
            comps.sort(key=lambda x: isinstance(x, univ.Choice) and x.getMinTagSet() or x.getTagSet())
            for c in comps:
                substrate += encodeFun(c, defMode, maxChunkSize)
        else:
            # SetOf
            compSubs = []
            while idx > 0:
                idx -= 1
                compSubs.append(
                    encodeFun(client[idx], defMode, maxChunkSize)
                )
            compSubs.sort()  # perhaps padding's not needed
            substrate = null
            for compSub in compSubs:
                substrate += compSub
        return substrate, 1


tagMap = encoder.tagMap.copy()
tagMap.update({
    univ.Boolean.tagSet: BooleanEncoder(),
    univ.BitString.tagSet: BitStringEncoder(),
    univ.OctetString.tagSet: OctetStringEncoder(),
    univ.Real.tagSet: RealEncoder(),
    useful.GeneralizedTime.tagSet: GeneralizedTimeEncoder(),
    useful.UTCTime.tagSet: UTCTimeEncoder(),
    univ.SetOf().tagSet: SetOfEncoder()  # conflcts with Set
})

typeMap = encoder.typeMap.copy()
typeMap.update({
    univ.Set.typeId: SetOfEncoder(),
    univ.SetOf.typeId: SetOfEncoder()
})


class Encoder(encoder.Encoder):
    def __call__(self, client, defMode=False, maxChunkSize=0):
        return encoder.Encoder.__call__(self, client, defMode, maxChunkSize)


#: Turns ASN.1 object into CER octet stream.
#:
#: Takes any ASN.1 object (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#: walks all its components recursively and produces a CER octet stream.
#:
#: Parameters
#: ----------
#  value: any pyasn1 object (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#:     A pyasn1 object to encode
#:
#: defMode: :py:class:`bool`
#:     If `False`, produces indefinite length encoding
#:
#: maxChunkSize: :py:class:`int`
#:     Maximum chunk size in chunked encoding mode (0 denotes unlimited chunk size)
#:
#: Returns
#: -------
#: : :py:class:`bytes` (Python 3) or :py:class:`str` (Python 2)
#:     Given ASN.1 object encoded into BER octetstream
#:
#: Raises
#: ------
#: : :py:class:`pyasn1.error.PyAsn1Error`
#:     On encoding errors
encode = Encoder(tagMap, typeMap)

# EncoderFactory queries class instance and builds a map of tags -> encoders
