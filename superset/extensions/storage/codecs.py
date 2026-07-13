# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""
Codec registry for extension storage (Tiers 2 and 3).

Maps the codec identifier persisted alongside a stored value (e.g.
`ExtensionStorage.codec`) to the `KeyValueCodec` instance that encodes/
decodes it, so a value written with one codec can be read back without the
caller having to remember which one it used.

Reuses the codec implementations from `superset.key_value.types` rather than
defining new ones, since the encode/decode logic (JSON, pickle) is identical.
"""

from __future__ import annotations

from superset.key_value.types import (
    BinaryKeyValueCodec,
    JsonKeyValueCodec,
    KeyValueCodec,
    PickleKeyValueCodec,
)

#: Default codec identifier used when a caller does not specify one.
DEFAULT_CODEC = "json"

#: Codec identifiers safe to accept from an untrusted caller (e.g. the REST
#: API). Excludes "pickle", since decoding a pickle stream can execute
#: arbitrary code — that codec is only available to backend extension code
#: calling the DAO directly.
SAFE_CODECS = frozenset({"json", "binary"})

#: Codec identifiers whose value is raw bytes rather than a native JSON
#: value. JSON has no byte type, so the REST layer base64-decodes/-encodes
#: the wire value around any codec in this set, before/after it reaches the
#: codec's own `encode`/`decode`.
BYTES_CODECS = frozenset({"binary"})

_CODECS: dict[str, KeyValueCodec] = {
    "json": JsonKeyValueCodec(),
    "pickle": PickleKeyValueCodec(),
    "binary": BinaryKeyValueCodec(),
}


class UnknownCodecError(ValueError):
    """Raised when a codec identifier has no registered `KeyValueCodec`."""


def get_codec(name: str) -> KeyValueCodec:
    """Look up the `KeyValueCodec` registered for a codec identifier.

    :param name: Codec identifier, e.g. "json" or "pickle".
    :raises UnknownCodecError: if no codec is registered under `name`.
    """
    try:
        return _CODECS[name]
    except KeyError:
        raise UnknownCodecError(f"Unknown codec: {name!r}") from None
