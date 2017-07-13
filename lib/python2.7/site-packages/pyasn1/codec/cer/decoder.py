#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from pyasn1.type import univ
from pyasn1.codec.ber import decoder
from pyasn1.compat.octets import oct2int
from pyasn1 import error

__all__ = ['decode']


class BooleanDecoder(decoder.AbstractSimpleDecoder):
    protoComponent = univ.Boolean(0)

    def valueDecoder(self, fullSubstrate, substrate, asn1Spec, tagSet, length,
                     state, decodeFun, substrateFun):
        head, tail = substrate[:length], substrate[length:]
        if not head or length != 1:
            raise error.PyAsn1Error('Not single-octet Boolean payload')
        byte = oct2int(head[0])
        # CER/DER specifies encoding of TRUE as 0xFF and FALSE as 0x0, while
        # BER allows any non-zero value as TRUE; cf. sections 8.2.2. and 11.1 
        # in http://www.itu.int/ITU-T/studygroups/com17/languages/X.690-0207.pdf
        if byte == 0xff:
            value = 1
        elif byte == 0x00:
            value = 0
        else:
            raise error.PyAsn1Error('Unexpected Boolean payload: %s' % byte)
        return self._createComponent(asn1Spec, tagSet, value), tail

# TODO: prohibit non-canonical encoding
BitStringDecoder = decoder.BitStringDecoder
OctetStringDecoder = decoder.OctetStringDecoder
RealDecoder = decoder.RealDecoder

tagMap = decoder.tagMap.copy()
tagMap.update(
    {univ.Boolean.tagSet: BooleanDecoder(),
     univ.BitString.tagSet: BitStringDecoder(),
     univ.OctetString.tagSet: OctetStringDecoder(),
     univ.Real.tagSet: RealDecoder()}
)

typeMap = decoder.typeMap


class Decoder(decoder.Decoder):
    pass


#: Turns CER octet stream into an ASN.1 object.
#:
#: Takes CER octetstream and decode it into an ASN.1 object
#: (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative) which
#: may be a scalar or an arbitrary nested structure.
#:
#: Parameters
#: ----------
#: substrate: :py:class:`bytes` (Python 3) or :py:class:`str` (Python 2)
#:     CER octetstream
#:
#: asn1Spec: any pyasn1 type object e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative
#:     A pyasn1 type object to act as a template guiding the decoder. Depending on the ASN.1 structure
#:     being decoded, *asn1Spec* may or may not be required. Most common reason for
#:     it to require is that ASN.1 structure is encoded in *IMPLICIT* tagging mode.
#:
#: Returns
#: -------
#: : :py:class:`tuple`
#:     A tuple of pyasn1 object recovered from CER substrate (:py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#:     and the unprocessed trailing portion of the *substrate* (may be empty)
#:
#: Raises
#: ------
#: : :py:class:`pyasn1.error.PyAsn1Error`
#:     On decoding errors
decode = Decoder(tagMap, decoder.typeMap)
