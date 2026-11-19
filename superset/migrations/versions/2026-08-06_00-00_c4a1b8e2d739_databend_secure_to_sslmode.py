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
"""migrate Databend connections to an explicit sslmode

``databend-sqlalchemy`` moved from the pure-Python ``databend-py`` client to a
Rust core, and the two disagree about TLS in ways that silently break stored
connections.

``databend-py`` took ``secure``, defaulting to ``False``, and selected an
``http`` scheme unless it was set. The Rust core takes ``sslmode`` and defaults
the scheme to ``https``; an unrecognised parameter is not rejected but stored as
a session variable. A Databend connection therefore keeps whatever ``secure``
value it was saved with, has it quietly ignored, and switches to TLS against a
server that may not speak it.

Both affected shapes are rewritten to the parameter the driver now reads:

* an explicit ``secure`` becomes the equivalent ``sslmode``. Values were parsed
  as booleans by ``databend-py``, so ``secure=True`` counted as encrypted and
  casing is not significant here either.
* no TLS parameter at all becomes ``sslmode=disable``. These connections were
  plaintext under ``databend-py``'s ``http`` default -- Superset only ever wrote
  ``secure=true``, never ``secure=false`` -- so this preserves how they have
  always behaved rather than downgrading them. Leaving them untouched would let
  the new ``https`` default break exactly the connections this migration exists
  to protect.

The query string is edited one parameter at a time instead of being parsed and
re-rendered through ``URL``. ``URL.render_as_string`` sorts the query keys and
re-encodes every value, which would reorder and rewrite unrelated parameters on
every row it touched; editing in place leaves everything but the TLS parameter
byte-identical.

``downgrade`` restores ``secure``, which is semantically but not textually exact:
a row that had no TLS parameter before ``upgrade`` comes back as ``secure=false``
rather than bare, and non-canonical casing is normalised. Both forms mean the
same thing to ``databend-py``.

Revision ID: c4a1b8e2d739
Revises: 1a27941d5352
Create Date: 2026-08-06 00:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update

# revision identifiers, used by Alembic.
revision = "c4a1b8e2d739"
down_revision = "1a27941d5352"

Base = declarative_base()

_TLS_PARAMETERS = ("sslmode", "secure")

# (parameter, lower-cased value) -> replacement parameter and value
_TO_SSLMODE = {
    ("secure", "true"): ("sslmode", "require"),
    ("secure", "false"): ("sslmode", "disable"),
}
_TO_SECURE = {
    ("sslmode", "require"): ("secure", "true"),
    ("sslmode", "enable"): ("secure", "true"),
    ("sslmode", "disable"): ("secure", "false"),
}


class Database(Base):  # type: ignore
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024), nullable=False)


def _split_query(uri: str) -> tuple[str, list[str]]:
    """
    Separate a URI from its query parameters.

    The delimiter is searched for after the credentials, which are not escaped
    for ``?`` and would otherwise be mistaken for the start of the query.
    """
    start = uri.find("?", uri.rfind("@") + 1)
    if start == -1:
        return uri, []
    return uri[:start], uri[start + 1 :].split("&")


def _rewrite_query_parameters(
    uri: str,
    replacements: dict[tuple[str, str], tuple[str, str]],
    default: tuple[str, str] | None = None,
) -> str | None:
    """
    Swap known TLS parameters in a URI's query string, preserving the rest.

    ``default`` is appended when the URI carries no TLS parameter at all.
    Returns ``None`` when nothing matched, so callers can skip the write.
    """
    base, pairs = _split_query(uri)

    changed = False
    tls_parameter_seen = False
    rewritten = []
    for pair in pairs:
        key, _, value = pair.partition("=")
        tls_parameter_seen = tls_parameter_seen or key in _TLS_PARAMETERS
        if replacement := replacements.get((key, value.lower())):
            rewritten.append("=".join(replacement))
            changed = True
        else:
            rewritten.append(pair)

    if default and not tls_parameter_seen:
        rewritten.append("=".join(default))
        changed = True

    if not changed:
        return None
    return f"{base}?{'&'.join(rewritten)}" if rewritten else base


def _migrate(
    replacements: dict[tuple[str, str], tuple[str, str]],
    default: tuple[str, str] | None = None,
) -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Database).filter(Database.sqlalchemy_uri.like("databend%"))
    for database in paginated_update(query):
        updated = _rewrite_query_parameters(
            database.sqlalchemy_uri, replacements, default
        )
        if updated:
            database.sqlalchemy_uri = updated

    session.commit()


def upgrade() -> None:
    _migrate(_TO_SSLMODE, default=("sslmode", "disable"))


def downgrade() -> None:
    _migrate(_TO_SECURE)
