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
"""Characterization tests for the IV behavior of Superset's default
app-encryption engine (``sqlalchemy_utils`` ``AesEngine``, AES-CBC).

``AesEngine._initialize_engine`` (see
``sqlalchemy_utils.types.encrypted.encrypted_type``) derives its IV as the
first 16 bytes of the SHA-256 digest of the configured key: ``self.iv =
self.secret_key[:16]``. That derivation is a pure function of the key alone,
so every encryption performed under the same key reuses the same IV, unlike
``AesGcmEngine``, which samples a fresh random IV (``os.urandom``) on every
call and embeds it in the output. These tests pin that observable difference:
same-plaintext encryptions are identical under the default engine and distinct
under the GCM engine.
"""

from sqlalchemy import String
from sqlalchemy.engine import make_url

from superset.utils.encrypt import (
    DEFAULT_ENCRYPTION_ENGINE_NAME,
    EncryptedType,
    resolve_encryption_engine,
)

DIALECT = make_url("sqlite://").get_dialect()
SECRET_KEY = "k" * 32


def _field(engine: type) -> EncryptedType:
    return EncryptedType(String(1024), key=lambda: SECRET_KEY, engine=engine)


def test_default_encryption_engine_name_resolves_to_cbc() -> None:
    """The engine name the codebase falls back to when config is unset resolves
    to the unauthenticated AES-CBC family, not the authenticated AES-GCM one.

    Specifically ``BackwardCompatibleAesEngine`` (see ``superset/utils/
    encrypt.py``), a drop-in ``AesEngine`` subclass that pads new writes with
    PKCS5 instead of sqlalchemy_utils' lossy "naive" scheme while still
    decrypting values already stored under naive padding -- so this file's
    deterministic-IV characterization below still holds unchanged.
    """
    from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine

    from superset.utils.encrypt import BackwardCompatibleAesEngine

    engine = resolve_encryption_engine(DEFAULT_ENCRYPTION_ENGINE_NAME)
    assert engine is BackwardCompatibleAesEngine
    assert issubclass(engine, AesEngine)


def test_default_engine_repeats_ciphertext_for_repeated_plaintext() -> None:
    """Encrypting the same plaintext twice under one key produces identical
    ciphertext with the default engine, because its IV is a deterministic
    function of the key rather than freshly sampled per call.
    """
    field = _field(resolve_encryption_engine(DEFAULT_ENCRYPTION_ENGINE_NAME))

    first = field.process_bind_param("hunter2", DIALECT)
    second = field.process_bind_param("hunter2", DIALECT)

    assert first == second


def test_gcm_engine_varies_ciphertext_for_repeated_plaintext() -> None:
    """Contrast case: the authenticated engine samples a fresh random IV each
    call, so encrypting the same plaintext twice under one key produces
    different ciphertext.
    """
    field = _field(resolve_encryption_engine("aes-gcm"))

    first = field.process_bind_param("hunter2", DIALECT)
    second = field.process_bind_param("hunter2", DIALECT)

    assert first != second
