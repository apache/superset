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
Simulate a FIPS-enabled host, so FIPS regressions are catchable in plain CI.

A FIPS-enabled OpenSSL rejects an MD5 digest that claims to be used for
security, raising ``UnsupportedDigestmodError``, and accepts the same digest
when ``usedforsecurity=False`` says it carries no such claim. CI does not run
under FIPS, so the policy is reproduced here by patching ``hashlib.md5``.
"""

from __future__ import annotations

import hashlib
from _hashlib import UnsupportedDigestmodError
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import patch

# Bound before patching, so the stand-in can still produce a real digest.
_REAL_MD5 = hashlib.md5


@contextmanager
def fips_restricted_hashlib() -> Iterator[None]:
    """
    Patch ``hashlib.md5`` to refuse calls that omit ``usedforsecurity=False``.

    The raised type is the one OpenSSL surfaces in FIPS mode,
    ``_hashlib.UnsupportedDigestmodError`` -- a ``ValueError`` subclass.
    """

    def md5(data: bytes = b"", *, usedforsecurity: bool = True) -> Any:
        if usedforsecurity:
            raise UnsupportedDigestmodError("[digital envelope routines] unsupported")
        return _REAL_MD5(data, usedforsecurity=False)

    with patch("hashlib.md5", new=md5):
        yield
