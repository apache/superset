# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import abc
import datetime
import hashlib
import ipaddress
import warnings
from enum import Enum

from pyasn1.codec.der import decoder
from pyasn1.type import namedtype, univ

import six

from cryptography import utils
from cryptography.hazmat.primitives import constant_time, serialization
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicKey
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from cryptography.x509.general_name import GeneralName, IPAddress, OtherName
from cryptography.x509.name import Name, RelativeDistinguishedName
from cryptography.x509.oid import (
    CRLEntryExtensionOID, ExtensionOID, ObjectIdentifier
)


class _SubjectPublicKeyInfo(univ.Sequence):
    componentType = namedtype.NamedTypes(
        namedtype.NamedType('algorithm', univ.Sequence()),
        namedtype.NamedType('subjectPublicKey', univ.BitString())
    )


def _key_identifier_from_public_key(public_key):
    if isinstance(public_key, RSAPublicKey):
        data = public_key.public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.PKCS1,
        )
    elif isinstance(public_key, EllipticCurvePublicKey):
        data = public_key.public_numbers().encode_point()
    else:
        # This is a very slow way to do this.
        serialized = public_key.public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo
        )
        spki, remaining = decoder.decode(
            serialized, asn1Spec=_SubjectPublicKeyInfo()
        )
        assert not remaining
        # the univ.BitString object is a tuple of bits. We need bytes and
        # pyasn1 really doesn't want to give them to us. To get it we'll
        # build an integer and convert that to bytes.
        bits = 0
        for bit in spki.getComponentByName("subjectPublicKey"):
            bits = bits << 1 | bit

        data = utils.int_to_bytes(bits)

    return hashlib.sha1(data).digest()


class DuplicateExtension(Exception):
    def __init__(self, msg, oid):
        super(DuplicateExtension, self).__init__(msg)
        self.oid = oid


class UnsupportedExtension(Exception):
    def __init__(self, msg, oid):
        super(UnsupportedExtension, self).__init__(msg)
        self.oid = oid


class ExtensionNotFound(Exception):
    def __init__(self, msg, oid):
        super(ExtensionNotFound, self).__init__(msg)
        self.oid = oid


@six.add_metaclass(abc.ABCMeta)
class ExtensionType(object):
    @abc.abstractproperty
    def oid(self):
        """
        Returns the oid associated with the given extension type.
        """


class Extensions(object):
    def __init__(self, extensions):
        self._extensions = extensions

    def get_extension_for_oid(self, oid):
        for ext in self:
            if ext.oid == oid:
                return ext

        raise ExtensionNotFound("No {0} extension was found".format(oid), oid)

    def get_extension_for_class(self, extclass):
        if extclass is UnrecognizedExtension:
            raise TypeError(
                "UnrecognizedExtension can't be used with "
                "get_extension_for_class because more than one instance of the"
                " class may be present."
            )

        for ext in self:
            if isinstance(ext.value, extclass):
                return ext

        raise ExtensionNotFound(
            "No {0} extension was found".format(extclass), extclass.oid
        )

    def __iter__(self):
        return iter(self._extensions)

    def __len__(self):
        return len(self._extensions)

    def __getitem__(self, idx):
        return self._extensions[idx]

    def __repr__(self):
        return (
            "<Extensions({0})>".format(self._extensions)
        )


@utils.register_interface(ExtensionType)
class CRLNumber(object):
    oid = ExtensionOID.CRL_NUMBER

    def __init__(self, crl_number):
        if not isinstance(crl_number, six.integer_types):
            raise TypeError("crl_number must be an integer")

        self._crl_number = crl_number

    def __eq__(self, other):
        if not isinstance(other, CRLNumber):
            return NotImplemented

        return self.crl_number == other.crl_number

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.crl_number)

    def __repr__(self):
        return "<CRLNumber({0})>".format(self.crl_number)

    crl_number = utils.read_only_property("_crl_number")


@utils.register_interface(ExtensionType)
class AuthorityKeyIdentifier(object):
    oid = ExtensionOID.AUTHORITY_KEY_IDENTIFIER

    def __init__(self, key_identifier, authority_cert_issuer,
                 authority_cert_serial_number):
        if (authority_cert_issuer is None) != (
            authority_cert_serial_number is None
        ):
            raise ValueError(
                "authority_cert_issuer and authority_cert_serial_number "
                "must both be present or both None"
            )

        if authority_cert_issuer is not None:
            authority_cert_issuer = list(authority_cert_issuer)
            if not all(
                isinstance(x, GeneralName) for x in authority_cert_issuer
            ):
                raise TypeError(
                    "authority_cert_issuer must be a list of GeneralName "
                    "objects"
                )

        if authority_cert_serial_number is not None and not isinstance(
            authority_cert_serial_number, six.integer_types
        ):
            raise TypeError(
                "authority_cert_serial_number must be an integer"
            )

        self._key_identifier = key_identifier
        self._authority_cert_issuer = authority_cert_issuer
        self._authority_cert_serial_number = authority_cert_serial_number

    @classmethod
    def from_issuer_public_key(cls, public_key):
        digest = _key_identifier_from_public_key(public_key)
        return cls(
            key_identifier=digest,
            authority_cert_issuer=None,
            authority_cert_serial_number=None
        )

    @classmethod
    def from_issuer_subject_key_identifier(cls, ski):
        return cls(
            key_identifier=ski.value.digest,
            authority_cert_issuer=None,
            authority_cert_serial_number=None
        )

    def __repr__(self):
        return (
            "<AuthorityKeyIdentifier(key_identifier={0.key_identifier!r}, "
            "authority_cert_issuer={0.authority_cert_issuer}, "
            "authority_cert_serial_number={0.authority_cert_serial_number}"
            ")>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, AuthorityKeyIdentifier):
            return NotImplemented

        return (
            self.key_identifier == other.key_identifier and
            self.authority_cert_issuer == other.authority_cert_issuer and
            self.authority_cert_serial_number ==
            other.authority_cert_serial_number
        )

    def __ne__(self, other):
        return not self == other

    key_identifier = utils.read_only_property("_key_identifier")
    authority_cert_issuer = utils.read_only_property("_authority_cert_issuer")
    authority_cert_serial_number = utils.read_only_property(
        "_authority_cert_serial_number"
    )


@utils.register_interface(ExtensionType)
class SubjectKeyIdentifier(object):
    oid = ExtensionOID.SUBJECT_KEY_IDENTIFIER

    def __init__(self, digest):
        self._digest = digest

    @classmethod
    def from_public_key(cls, public_key):
        return cls(_key_identifier_from_public_key(public_key))

    digest = utils.read_only_property("_digest")

    def __repr__(self):
        return "<SubjectKeyIdentifier(digest={0!r})>".format(self.digest)

    def __eq__(self, other):
        if not isinstance(other, SubjectKeyIdentifier):
            return NotImplemented

        return constant_time.bytes_eq(self.digest, other.digest)

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.digest)


@utils.register_interface(ExtensionType)
class AuthorityInformationAccess(object):
    oid = ExtensionOID.AUTHORITY_INFORMATION_ACCESS

    def __init__(self, descriptions):
        descriptions = list(descriptions)
        if not all(isinstance(x, AccessDescription) for x in descriptions):
            raise TypeError(
                "Every item in the descriptions list must be an "
                "AccessDescription"
            )

        self._descriptions = descriptions

    def __iter__(self):
        return iter(self._descriptions)

    def __len__(self):
        return len(self._descriptions)

    def __repr__(self):
        return "<AuthorityInformationAccess({0})>".format(self._descriptions)

    def __eq__(self, other):
        if not isinstance(other, AuthorityInformationAccess):
            return NotImplemented

        return self._descriptions == other._descriptions

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._descriptions[idx]


class AccessDescription(object):
    def __init__(self, access_method, access_location):
        if not isinstance(access_method, ObjectIdentifier):
            raise TypeError("access_method must be an ObjectIdentifier")

        if not isinstance(access_location, GeneralName):
            raise TypeError("access_location must be a GeneralName")

        self._access_method = access_method
        self._access_location = access_location

    def __repr__(self):
        return (
            "<AccessDescription(access_method={0.access_method}, access_locati"
            "on={0.access_location})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, AccessDescription):
            return NotImplemented

        return (
            self.access_method == other.access_method and
            self.access_location == other.access_location
        )

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.access_method, self.access_location))

    access_method = utils.read_only_property("_access_method")
    access_location = utils.read_only_property("_access_location")


@utils.register_interface(ExtensionType)
class BasicConstraints(object):
    oid = ExtensionOID.BASIC_CONSTRAINTS

    def __init__(self, ca, path_length):
        if not isinstance(ca, bool):
            raise TypeError("ca must be a boolean value")

        if path_length is not None and not ca:
            raise ValueError("path_length must be None when ca is False")

        if (
            path_length is not None and
            (not isinstance(path_length, six.integer_types) or path_length < 0)
        ):
            raise TypeError(
                "path_length must be a non-negative integer or None"
            )

        self._ca = ca
        self._path_length = path_length

    ca = utils.read_only_property("_ca")
    path_length = utils.read_only_property("_path_length")

    def __repr__(self):
        return ("<BasicConstraints(ca={0.ca}, "
                "path_length={0.path_length})>").format(self)

    def __eq__(self, other):
        if not isinstance(other, BasicConstraints):
            return NotImplemented

        return self.ca == other.ca and self.path_length == other.path_length

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.ca, self.path_length))


@utils.register_interface(ExtensionType)
class CRLDistributionPoints(object):
    oid = ExtensionOID.CRL_DISTRIBUTION_POINTS

    def __init__(self, distribution_points):
        distribution_points = list(distribution_points)
        if not all(
            isinstance(x, DistributionPoint) for x in distribution_points
        ):
            raise TypeError(
                "distribution_points must be a list of DistributionPoint "
                "objects"
            )

        self._distribution_points = distribution_points

    def __iter__(self):
        return iter(self._distribution_points)

    def __len__(self):
        return len(self._distribution_points)

    def __repr__(self):
        return "<CRLDistributionPoints({0})>".format(self._distribution_points)

    def __eq__(self, other):
        if not isinstance(other, CRLDistributionPoints):
            return NotImplemented

        return self._distribution_points == other._distribution_points

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._distribution_points[idx]


class DistributionPoint(object):
    def __init__(self, full_name, relative_name, reasons, crl_issuer):
        if full_name and relative_name:
            raise ValueError(
                "You cannot provide both full_name and relative_name, at "
                "least one must be None."
            )

        if full_name:
            full_name = list(full_name)
            if not all(isinstance(x, GeneralName) for x in full_name):
                raise TypeError(
                    "full_name must be a list of GeneralName objects"
                )

        if relative_name:
            if isinstance(relative_name, Name):
                warnings.warn(
                    "relative_name=<Name> is deprecated and will "
                    "be removed in a future version; use "
                    "<RelativeDistinguishedName> instead.",
                    utils.DeprecatedIn16,
                    stacklevel=2
                )
                relative_name = RelativeDistinguishedName(relative_name)
            elif not isinstance(relative_name, RelativeDistinguishedName):
                raise TypeError(
                    "relative_name must be a RelativeDistinguishedName"
                )

        if crl_issuer:
            crl_issuer = list(crl_issuer)
            if not all(isinstance(x, GeneralName) for x in crl_issuer):
                raise TypeError(
                    "crl_issuer must be None or a list of general names"
                )

        if reasons and (not isinstance(reasons, frozenset) or not all(
            isinstance(x, ReasonFlags) for x in reasons
        )):
            raise TypeError("reasons must be None or frozenset of ReasonFlags")

        if reasons and (
            ReasonFlags.unspecified in reasons or
            ReasonFlags.remove_from_crl in reasons
        ):
            raise ValueError(
                "unspecified and remove_from_crl are not valid reasons in a "
                "DistributionPoint"
            )

        if reasons and not crl_issuer and not (full_name or relative_name):
            raise ValueError(
                "You must supply crl_issuer, full_name, or relative_name when "
                "reasons is not None"
            )

        self._full_name = full_name
        self._relative_name = relative_name
        self._reasons = reasons
        self._crl_issuer = crl_issuer

    def __repr__(self):
        return (
            "<DistributionPoint(full_name={0.full_name}, relative_name={0.rela"
            "tive_name}, reasons={0.reasons}, crl_issuer={0.crl_is"
            "suer})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, DistributionPoint):
            return NotImplemented

        return (
            self.full_name == other.full_name and
            self.relative_name == other.relative_name and
            self.reasons == other.reasons and
            self.crl_issuer == other.crl_issuer
        )

    def __ne__(self, other):
        return not self == other

    full_name = utils.read_only_property("_full_name")
    relative_name = utils.read_only_property("_relative_name")
    reasons = utils.read_only_property("_reasons")
    crl_issuer = utils.read_only_property("_crl_issuer")


class ReasonFlags(Enum):
    unspecified = "unspecified"
    key_compromise = "keyCompromise"
    ca_compromise = "cACompromise"
    affiliation_changed = "affiliationChanged"
    superseded = "superseded"
    cessation_of_operation = "cessationOfOperation"
    certificate_hold = "certificateHold"
    privilege_withdrawn = "privilegeWithdrawn"
    aa_compromise = "aACompromise"
    remove_from_crl = "removeFromCRL"


@utils.register_interface(ExtensionType)
class PolicyConstraints(object):
    oid = ExtensionOID.POLICY_CONSTRAINTS

    def __init__(self, require_explicit_policy, inhibit_policy_mapping):
        if require_explicit_policy is not None and not isinstance(
            require_explicit_policy, six.integer_types
        ):
            raise TypeError(
                "require_explicit_policy must be a non-negative integer or "
                "None"
            )

        if inhibit_policy_mapping is not None and not isinstance(
            inhibit_policy_mapping, six.integer_types
        ):
            raise TypeError(
                "inhibit_policy_mapping must be a non-negative integer or None"
            )

        if inhibit_policy_mapping is None and require_explicit_policy is None:
            raise ValueError(
                "At least one of require_explicit_policy and "
                "inhibit_policy_mapping must not be None"
            )

        self._require_explicit_policy = require_explicit_policy
        self._inhibit_policy_mapping = inhibit_policy_mapping

    def __repr__(self):
        return (
            u"<PolicyConstraints(require_explicit_policy={0.require_explicit"
            u"_policy}, inhibit_policy_mapping={0.inhibit_policy_"
            u"mapping})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, PolicyConstraints):
            return NotImplemented

        return (
            self.require_explicit_policy == other.require_explicit_policy and
            self.inhibit_policy_mapping == other.inhibit_policy_mapping
        )

    def __ne__(self, other):
        return not self == other

    require_explicit_policy = utils.read_only_property(
        "_require_explicit_policy"
    )
    inhibit_policy_mapping = utils.read_only_property(
        "_inhibit_policy_mapping"
    )


@utils.register_interface(ExtensionType)
class CertificatePolicies(object):
    oid = ExtensionOID.CERTIFICATE_POLICIES

    def __init__(self, policies):
        policies = list(policies)
        if not all(isinstance(x, PolicyInformation) for x in policies):
            raise TypeError(
                "Every item in the policies list must be a "
                "PolicyInformation"
            )

        self._policies = policies

    def __iter__(self):
        return iter(self._policies)

    def __len__(self):
        return len(self._policies)

    def __repr__(self):
        return "<CertificatePolicies({0})>".format(self._policies)

    def __eq__(self, other):
        if not isinstance(other, CertificatePolicies):
            return NotImplemented

        return self._policies == other._policies

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._policies[idx]


class PolicyInformation(object):
    def __init__(self, policy_identifier, policy_qualifiers):
        if not isinstance(policy_identifier, ObjectIdentifier):
            raise TypeError("policy_identifier must be an ObjectIdentifier")

        self._policy_identifier = policy_identifier

        if policy_qualifiers:
            policy_qualifiers = list(policy_qualifiers)
            if not all(
                    isinstance(x, (six.text_type, UserNotice))
                    for x in policy_qualifiers
            ):
                raise TypeError(
                    "policy_qualifiers must be a list of strings and/or "
                    "UserNotice objects or None"
                )

        self._policy_qualifiers = policy_qualifiers

    def __repr__(self):
        return (
            "<PolicyInformation(policy_identifier={0.policy_identifier}, polic"
            "y_qualifiers={0.policy_qualifiers})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, PolicyInformation):
            return NotImplemented

        return (
            self.policy_identifier == other.policy_identifier and
            self.policy_qualifiers == other.policy_qualifiers
        )

    def __ne__(self, other):
        return not self == other

    policy_identifier = utils.read_only_property("_policy_identifier")
    policy_qualifiers = utils.read_only_property("_policy_qualifiers")


class UserNotice(object):
    def __init__(self, notice_reference, explicit_text):
        if notice_reference and not isinstance(
            notice_reference, NoticeReference
        ):
            raise TypeError(
                "notice_reference must be None or a NoticeReference"
            )

        self._notice_reference = notice_reference
        self._explicit_text = explicit_text

    def __repr__(self):
        return (
            "<UserNotice(notice_reference={0.notice_reference}, explicit_text="
            "{0.explicit_text!r})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, UserNotice):
            return NotImplemented

        return (
            self.notice_reference == other.notice_reference and
            self.explicit_text == other.explicit_text
        )

    def __ne__(self, other):
        return not self == other

    notice_reference = utils.read_only_property("_notice_reference")
    explicit_text = utils.read_only_property("_explicit_text")


class NoticeReference(object):
    def __init__(self, organization, notice_numbers):
        self._organization = organization
        notice_numbers = list(notice_numbers)
        if not all(isinstance(x, int) for x in notice_numbers):
            raise TypeError(
                "notice_numbers must be a list of integers"
            )

        self._notice_numbers = notice_numbers

    def __repr__(self):
        return (
            "<NoticeReference(organization={0.organization!r}, notice_numbers="
            "{0.notice_numbers})>".format(self)
        )

    def __eq__(self, other):
        if not isinstance(other, NoticeReference):
            return NotImplemented

        return (
            self.organization == other.organization and
            self.notice_numbers == other.notice_numbers
        )

    def __ne__(self, other):
        return not self == other

    organization = utils.read_only_property("_organization")
    notice_numbers = utils.read_only_property("_notice_numbers")


@utils.register_interface(ExtensionType)
class ExtendedKeyUsage(object):
    oid = ExtensionOID.EXTENDED_KEY_USAGE

    def __init__(self, usages):
        usages = list(usages)
        if not all(isinstance(x, ObjectIdentifier) for x in usages):
            raise TypeError(
                "Every item in the usages list must be an ObjectIdentifier"
            )

        self._usages = usages

    def __iter__(self):
        return iter(self._usages)

    def __len__(self):
        return len(self._usages)

    def __repr__(self):
        return "<ExtendedKeyUsage({0})>".format(self._usages)

    def __eq__(self, other):
        if not isinstance(other, ExtendedKeyUsage):
            return NotImplemented

        return self._usages == other._usages

    def __ne__(self, other):
        return not self == other


@utils.register_interface(ExtensionType)
class OCSPNoCheck(object):
    oid = ExtensionOID.OCSP_NO_CHECK


@utils.register_interface(ExtensionType)
class InhibitAnyPolicy(object):
    oid = ExtensionOID.INHIBIT_ANY_POLICY

    def __init__(self, skip_certs):
        if not isinstance(skip_certs, six.integer_types):
            raise TypeError("skip_certs must be an integer")

        if skip_certs < 0:
            raise ValueError("skip_certs must be a non-negative integer")

        self._skip_certs = skip_certs

    def __repr__(self):
        return "<InhibitAnyPolicy(skip_certs={0.skip_certs})>".format(self)

    def __eq__(self, other):
        if not isinstance(other, InhibitAnyPolicy):
            return NotImplemented

        return self.skip_certs == other.skip_certs

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.skip_certs)

    skip_certs = utils.read_only_property("_skip_certs")


@utils.register_interface(ExtensionType)
class KeyUsage(object):
    oid = ExtensionOID.KEY_USAGE

    def __init__(self, digital_signature, content_commitment, key_encipherment,
                 data_encipherment, key_agreement, key_cert_sign, crl_sign,
                 encipher_only, decipher_only):
        if not key_agreement and (encipher_only or decipher_only):
            raise ValueError(
                "encipher_only and decipher_only can only be true when "
                "key_agreement is true"
            )

        self._digital_signature = digital_signature
        self._content_commitment = content_commitment
        self._key_encipherment = key_encipherment
        self._data_encipherment = data_encipherment
        self._key_agreement = key_agreement
        self._key_cert_sign = key_cert_sign
        self._crl_sign = crl_sign
        self._encipher_only = encipher_only
        self._decipher_only = decipher_only

    digital_signature = utils.read_only_property("_digital_signature")
    content_commitment = utils.read_only_property("_content_commitment")
    key_encipherment = utils.read_only_property("_key_encipherment")
    data_encipherment = utils.read_only_property("_data_encipherment")
    key_agreement = utils.read_only_property("_key_agreement")
    key_cert_sign = utils.read_only_property("_key_cert_sign")
    crl_sign = utils.read_only_property("_crl_sign")

    @property
    def encipher_only(self):
        if not self.key_agreement:
            raise ValueError(
                "encipher_only is undefined unless key_agreement is true"
            )
        else:
            return self._encipher_only

    @property
    def decipher_only(self):
        if not self.key_agreement:
            raise ValueError(
                "decipher_only is undefined unless key_agreement is true"
            )
        else:
            return self._decipher_only

    def __repr__(self):
        try:
            encipher_only = self.encipher_only
            decipher_only = self.decipher_only
        except ValueError:
            encipher_only = None
            decipher_only = None

        return ("<KeyUsage(digital_signature={0.digital_signature}, "
                "content_commitment={0.content_commitment}, "
                "key_encipherment={0.key_encipherment}, "
                "data_encipherment={0.data_encipherment}, "
                "key_agreement={0.key_agreement}, "
                "key_cert_sign={0.key_cert_sign}, crl_sign={0.crl_sign}, "
                "encipher_only={1}, decipher_only={2})>").format(
                    self, encipher_only, decipher_only)

    def __eq__(self, other):
        if not isinstance(other, KeyUsage):
            return NotImplemented

        return (
            self.digital_signature == other.digital_signature and
            self.content_commitment == other.content_commitment and
            self.key_encipherment == other.key_encipherment and
            self.data_encipherment == other.data_encipherment and
            self.key_agreement == other.key_agreement and
            self.key_cert_sign == other.key_cert_sign and
            self.crl_sign == other.crl_sign and
            self._encipher_only == other._encipher_only and
            self._decipher_only == other._decipher_only
        )

    def __ne__(self, other):
        return not self == other


@utils.register_interface(ExtensionType)
class NameConstraints(object):
    oid = ExtensionOID.NAME_CONSTRAINTS

    def __init__(self, permitted_subtrees, excluded_subtrees):
        if permitted_subtrees is not None:
            permitted_subtrees = list(permitted_subtrees)
            if not all(
                isinstance(x, GeneralName) for x in permitted_subtrees
            ):
                raise TypeError(
                    "permitted_subtrees must be a list of GeneralName objects "
                    "or None"
                )

            self._validate_ip_name(permitted_subtrees)

        if excluded_subtrees is not None:
            excluded_subtrees = list(excluded_subtrees)
            if not all(
                isinstance(x, GeneralName) for x in excluded_subtrees
            ):
                raise TypeError(
                    "excluded_subtrees must be a list of GeneralName objects "
                    "or None"
                )

            self._validate_ip_name(excluded_subtrees)

        if permitted_subtrees is None and excluded_subtrees is None:
            raise ValueError(
                "At least one of permitted_subtrees and excluded_subtrees "
                "must not be None"
            )

        self._permitted_subtrees = permitted_subtrees
        self._excluded_subtrees = excluded_subtrees

    def __eq__(self, other):
        if not isinstance(other, NameConstraints):
            return NotImplemented

        return (
            self.excluded_subtrees == other.excluded_subtrees and
            self.permitted_subtrees == other.permitted_subtrees
        )

    def __ne__(self, other):
        return not self == other

    def _validate_ip_name(self, tree):
        if any(isinstance(name, IPAddress) and not isinstance(
            name.value, (ipaddress.IPv4Network, ipaddress.IPv6Network)
        ) for name in tree):
            raise TypeError(
                "IPAddress name constraints must be an IPv4Network or"
                " IPv6Network object"
            )

    def __repr__(self):
        return (
            u"<NameConstraints(permitted_subtrees={0.permitted_subtrees}, "
            u"excluded_subtrees={0.excluded_subtrees})>".format(self)
        )

    permitted_subtrees = utils.read_only_property("_permitted_subtrees")
    excluded_subtrees = utils.read_only_property("_excluded_subtrees")


class Extension(object):
    def __init__(self, oid, critical, value):
        if not isinstance(oid, ObjectIdentifier):
            raise TypeError(
                "oid argument must be an ObjectIdentifier instance."
            )

        if not isinstance(critical, bool):
            raise TypeError("critical must be a boolean value")

        self._oid = oid
        self._critical = critical
        self._value = value

    oid = utils.read_only_property("_oid")
    critical = utils.read_only_property("_critical")
    value = utils.read_only_property("_value")

    def __repr__(self):
        return ("<Extension(oid={0.oid}, critical={0.critical}, "
                "value={0.value})>").format(self)

    def __eq__(self, other):
        if not isinstance(other, Extension):
            return NotImplemented

        return (
            self.oid == other.oid and
            self.critical == other.critical and
            self.value == other.value
        )

    def __ne__(self, other):
        return not self == other


class GeneralNames(object):
    def __init__(self, general_names):
        general_names = list(general_names)
        if not all(isinstance(x, GeneralName) for x in general_names):
            raise TypeError(
                "Every item in the general_names list must be an "
                "object conforming to the GeneralName interface"
            )

        self._general_names = general_names

    def __iter__(self):
        return iter(self._general_names)

    def __len__(self):
        return len(self._general_names)

    def get_values_for_type(self, type):
        # Return the value of each GeneralName, except for OtherName instances
        # which we return directly because it has two important properties not
        # just one value.
        objs = (i for i in self if isinstance(i, type))
        if type != OtherName:
            objs = (i.value for i in objs)
        return list(objs)

    def __repr__(self):
        return "<GeneralNames({0})>".format(self._general_names)

    def __eq__(self, other):
        if not isinstance(other, GeneralNames):
            return NotImplemented

        return self._general_names == other._general_names

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._general_names[idx]


@utils.register_interface(ExtensionType)
class SubjectAlternativeName(object):
    oid = ExtensionOID.SUBJECT_ALTERNATIVE_NAME

    def __init__(self, general_names):
        self._general_names = GeneralNames(general_names)

    def __iter__(self):
        return iter(self._general_names)

    def __len__(self):
        return len(self._general_names)

    def get_values_for_type(self, type):
        return self._general_names.get_values_for_type(type)

    def __repr__(self):
        return "<SubjectAlternativeName({0})>".format(self._general_names)

    def __eq__(self, other):
        if not isinstance(other, SubjectAlternativeName):
            return NotImplemented

        return self._general_names == other._general_names

    def __getitem__(self, idx):
        return self._general_names[idx]

    def __ne__(self, other):
        return not self == other


@utils.register_interface(ExtensionType)
class IssuerAlternativeName(object):
    oid = ExtensionOID.ISSUER_ALTERNATIVE_NAME

    def __init__(self, general_names):
        self._general_names = GeneralNames(general_names)

    def __iter__(self):
        return iter(self._general_names)

    def __len__(self):
        return len(self._general_names)

    def get_values_for_type(self, type):
        return self._general_names.get_values_for_type(type)

    def __repr__(self):
        return "<IssuerAlternativeName({0})>".format(self._general_names)

    def __eq__(self, other):
        if not isinstance(other, IssuerAlternativeName):
            return NotImplemented

        return self._general_names == other._general_names

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._general_names[idx]


@utils.register_interface(ExtensionType)
class CertificateIssuer(object):
    oid = CRLEntryExtensionOID.CERTIFICATE_ISSUER

    def __init__(self, general_names):
        self._general_names = GeneralNames(general_names)

    def __iter__(self):
        return iter(self._general_names)

    def __len__(self):
        return len(self._general_names)

    def get_values_for_type(self, type):
        return self._general_names.get_values_for_type(type)

    def __repr__(self):
        return "<CertificateIssuer({0})>".format(self._general_names)

    def __eq__(self, other):
        if not isinstance(other, CertificateIssuer):
            return NotImplemented

        return self._general_names == other._general_names

    def __ne__(self, other):
        return not self == other

    def __getitem__(self, idx):
        return self._general_names[idx]


@utils.register_interface(ExtensionType)
class CRLReason(object):
    oid = CRLEntryExtensionOID.CRL_REASON

    def __init__(self, reason):
        if not isinstance(reason, ReasonFlags):
            raise TypeError("reason must be an element from ReasonFlags")

        self._reason = reason

    def __repr__(self):
        return "<CRLReason(reason={0})>".format(self._reason)

    def __eq__(self, other):
        if not isinstance(other, CRLReason):
            return NotImplemented

        return self.reason == other.reason

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.reason)

    reason = utils.read_only_property("_reason")


@utils.register_interface(ExtensionType)
class InvalidityDate(object):
    oid = CRLEntryExtensionOID.INVALIDITY_DATE

    def __init__(self, invalidity_date):
        if not isinstance(invalidity_date, datetime.datetime):
            raise TypeError("invalidity_date must be a datetime.datetime")

        self._invalidity_date = invalidity_date

    def __repr__(self):
        return "<InvalidityDate(invalidity_date={0})>".format(
            self._invalidity_date
        )

    def __eq__(self, other):
        if not isinstance(other, InvalidityDate):
            return NotImplemented

        return self.invalidity_date == other.invalidity_date

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.invalidity_date)

    invalidity_date = utils.read_only_property("_invalidity_date")


@utils.register_interface(ExtensionType)
class UnrecognizedExtension(object):
    def __init__(self, oid, value):
        if not isinstance(oid, ObjectIdentifier):
            raise TypeError("oid must be an ObjectIdentifier")
        self._oid = oid
        self._value = value

    oid = utils.read_only_property("_oid")
    value = utils.read_only_property("_value")

    def __repr__(self):
        return (
            "<UnrecognizedExtension(oid={0.oid}, value={0.value!r})>".format(
                self
            )
        )

    def __eq__(self, other):
        if not isinstance(other, UnrecognizedExtension):
            return NotImplemented

        return self.oid == other.oid and self.value == other.value

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.oid, self.value))
