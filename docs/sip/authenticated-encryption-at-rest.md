<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# SIP: Authenticated encryption (AES-GCM) for app-encrypted fields

## [DRAFT — proposal for discussion]

This document is a draft proposal accompanying the code in this PR. It is
intended to seed the formal SIP discussion; the code change here is the
backward-compatible first step (engine selection), **not** the full migration.

## Motivation

Superset app-encrypts a number of sensitive fields before persisting them to
the metadata database, including:

- database connection passwords and `encrypted_extra` (`superset/models/core.py`),
- SSH tunnel credentials — password, private key, private-key password
  (`superset/databases/ssh_tunnel/models.py`),
- OAuth2 tokens and other secrets stored via `EncryptedType`.

These fields are encrypted with `sqlalchemy_utils.EncryptedType`, which
**defaults to `AesEngine` (AES-CBC)**. AES-CBC provides confidentiality but is
**unauthenticated**: it has no integrity tag. An attacker with write access to
the ciphertext (e.g. direct metadata-DB access, a backup, or a compromised
replica) can perform **bit-flipping / chosen-ciphertext manipulation** to
silently alter the decrypted plaintext of a secret without detection.

`AesGcmEngine` (AES-GCM) is authenticated encryption: tampering causes
decryption to fail loudly rather than yielding attacker-influenced plaintext.
Using authenticated encryption for secrets at rest is an ASVS L1 expectation
(11.3.2 / cryptography best practice).

`config.py` already documents that operators *can* switch to GCM by writing a
custom `AbstractEncryptedFieldAdapter`, but:

1. it is opt-in, undocumented as a security recommendation, and easy to miss;
2. there is **no migration path** — flipping the engine on a populated database
   makes every existing secret undecryptable, because GCM ciphertext is not
   format-compatible with CBC.

## Proposed change

A three-part change, delivered incrementally so existing deployments are never
broken:

### Phase 1 — engine selection (this PR)

- Add a `SQLALCHEMY_ENCRYPTED_FIELD_ENGINE` config (`"aes"` | `"aes-gcm"`),
  **defaulting to `"aes"`** (no behavior change for existing installs).
- Teach the default `SQLAlchemyUtilsAdapter` to honor it (an explicit `engine`
  kwarg still wins, so the migrator can pin an engine).
- This lets **new** deployments choose AES-GCM from day one with a one-line
  config, instead of writing a custom adapter.

### Phase 2 — CBC→GCM re-encryption migrator

Extend the existing `SecretsMigrator` (today used for `SECRET_KEY` rotation) to
support an **engine migration** mode that:

1. discovers every `EncryptedType` column (it already does this via
   `discover_encrypted_fields()`),
2. decrypts each value with the **source** engine (AES-CBC) under the current
   `SECRET_KEY`,
3. re-encrypts with the **target** engine (AES-GCM),
4. runs transactionally per the existing all-or-nothing semantics.

Exposed as a CLI command (e.g. `superset re-encrypt-secrets --engine aes-gcm`),
runnable by operators with a DB backup in hand.

### Phase 3 — flip the default for new installs

Once the migrator and docs are in place, change the default to `"aes-gcm"` for
**fresh** installs only (e.g. keyed off an empty metadata DB / documented in
`UPDATING.md`), keeping existing installs on `"aes"` until they run Phase 2.

## New or changed public interfaces

- New config: `SQLALCHEMY_ENCRYPTED_FIELD_ENGINE: Literal["aes", "aes-gcm"]`.
- New (Phase 2) CLI: `superset re-encrypt-secrets --engine <name>`.
- No schema changes; ciphertext format changes per migrated column.

## Migration plan and compatibility

- **Backward compatible by default.** Phase 1 changes nothing unless the
  operator opts in.
- Switching an existing deployment to `"aes-gcm"` **without** running the Phase
  2 migrator will make existing secrets undecryptable — this is called out in
  the config comment and must be in `UPDATING.md`.
- Recommended operator runbook: take a metadata-DB backup → run
  `re-encrypt-secrets --engine aes-gcm` → set
  `SQLALCHEMY_ENCRYPTED_FIELD_ENGINE = "aes-gcm"` → restart.
- `AesEngine` allows queryability over encrypted fields; AES-GCM does not.
  Any code that filters/queries on an encrypted column directly must be audited
  before Phase 3 (none is expected, but it must be verified).

## Rejected alternatives

- **Flip the default immediately.** Rejected: bricks every existing
  deployment's secrets with no migration path.
- **Document-only (custom adapter).** Status quo; high friction and no
  migration tooling — most operators will never do it.

## Open questions

- Should Phase 2 support GCM→CBC rollback for operators who need queryability?
- Should the migrator support concurrent SECRET_KEY rotation + engine change in
  a single pass (it already handles previous-key decryption)?
