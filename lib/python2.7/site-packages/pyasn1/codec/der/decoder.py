#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from pyasn1.type import univ
from pyasn1.codec.cer import decoder

__all__ = ['decode']


class BitStringDecoder(decoder.BitStringDecoder):
    supportConstructedForm = False


class OctetStringDecoder(decoder.OctetStringDecoder):
    supportConstructedForm = False

# TODO: prohibit non-canonical encoding
RealDecoder = decoder.RealDecoder

tagMap = decoder.tagMap.copy()
tagMap.update(
    {univ.BitString.tagSet: BitStringDecoder(),
     univ.OctetString.tagSet: OctetStringDecoder(),
     univ.Real.tagSet: RealDecoder()}
)

typeMap = decoder.typeMap


class Decoder(decoder.Decoder):
    supportIndefLength = False


#: Turns DER octet stream into an ASN.1 object.
#:
#: Takes DER octetstream and decode it into an ASN.1 object
#: (e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative) which
#: may be a scalar or an arbitrary nested structure.
#:
#: Parameters
#: ----------
#: substrate: :py:class:`bytes` (Python 3) or :py:class:`str` (Python 2)
#:     DER octetstream
#:
#: asn1Spec: any pyasn1 type object e.g. :py:class:`~pyasn1.type.base.PyAsn1Item` derivative
#:     A pyasn1 type object to act as a template guiding the decoder. Depending on the ASN.1 structure
#:     being decoded, *asn1Spec* may or may not be required. Most common reason for
#:     it to require is that ASN.1 structure is encoded in *IMPLICIT* tagging mode.
#:
#: Returns
#: -------
#: : :py:class:`tuple`
#:     A tuple of pyasn1 object recovered from DER substrate (:py:class:`~pyasn1.type.base.PyAsn1Item` derivative)
#:     and the unprocessed trailing portion of the *substrate* (may be empty)
#:
#: Raises
#: ------
#: : :py:class:`pyasn1.error.PyAsn1Error`
#:     On decoding errors
decode = Decoder(tagMap, typeMap)
