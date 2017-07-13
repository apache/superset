# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import six

from cryptography import utils
from cryptography.x509.oid import NameOID, ObjectIdentifier


class NameAttribute(object):
    def __init__(self, oid, value):
        if not isinstance(oid, ObjectIdentifier):
            raise TypeError(
                "oid argument must be an ObjectIdentifier instance."
            )

        if not isinstance(value, six.text_type):
            raise TypeError(
                "value argument must be a text type."
            )

        if oid == NameOID.COUNTRY_NAME and len(value.encode("utf8")) != 2:
            raise ValueError(
                "Country name must be a 2 character country code"
            )

        self._oid = oid
        self._value = value

    oid = utils.read_only_property("_oid")
    value = utils.read_only_property("_value")

    def __eq__(self, other):
        if not isinstance(other, NameAttribute):
            return NotImplemented

        return (
            self.oid == other.oid and
            self.value == other.value
        )

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.oid, self.value))

    def __repr__(self):
        return "<NameAttribute(oid={0.oid}, value={0.value!r})>".format(self)


class RelativeDistinguishedName(object):
    def __init__(self, attributes):
        attributes = frozenset(attributes)
        if not attributes:
            raise ValueError("a relative distinguished name cannot be empty")
        if not all(isinstance(x, NameAttribute) for x in attributes):
            raise TypeError("attributes must be an iterable of NameAttribute")

        self._attributes = attributes

    def get_attributes_for_oid(self, oid):
        return [i for i in self if i.oid == oid]

    def __eq__(self, other):
        if not isinstance(other, RelativeDistinguishedName):
            return NotImplemented

        return self._attributes == other._attributes

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self._attributes)

    def __iter__(self):
        return iter(self._attributes)

    def __len__(self):
        return len(self._attributes)

    def __repr__(self):
        return "<RelativeDistinguishedName({0!r})>".format(list(self))


class Name(object):
    def __init__(self, attributes):
        attributes = list(attributes)
        if all(isinstance(x, NameAttribute) for x in attributes):
            self._attributes = [
                RelativeDistinguishedName([x]) for x in attributes
            ]
        elif all(isinstance(x, RelativeDistinguishedName) for x in attributes):
            self._attributes = attributes
        else:
            raise TypeError(
                "attributes must be a list of NameAttribute"
                " or a list RelativeDistinguishedName"
            )

    def get_attributes_for_oid(self, oid):
        return [i for i in self if i.oid == oid]

    @property
    def rdns(self):
        return self._attributes

    def public_bytes(self, backend):
        return backend.x509_name_bytes(self)

    def __eq__(self, other):
        if not isinstance(other, Name):
            return NotImplemented

        return self._attributes == other._attributes

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        # TODO: this is relatively expensive, if this looks like a bottleneck
        # for you, consider optimizing!
        return hash(tuple(self._attributes))

    def __iter__(self):
        for rdn in self._attributes:
            for ava in rdn:
                yield ava

    def __len__(self):
        return sum(len(rdn) for rdn in self._attributes)

    def __repr__(self):
        return "<Name({0!r})>".format(list(self))
