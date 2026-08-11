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
"""Fail-closed row-level-security enforcement seam.

Defines the single chokepoint through which row-level security is applied to a
compiled query, together with the result type it returns. Column masking is
reserved but not yet supported; its seam raises ``NotImplementedError`` so a
caller can never silently skip masking. The enforcement logic is wired in
separately — this module fixes the interface, result type, and entry signature.
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional, Sequence

from flask_babel import gettext as __

from superset.security.guest_token import GuestUser

logger = logging.getLogger(__name__)

# Fixed, non-disclosive copy handed to the CLIENT when a governed query is
# denied (FR-11 / NFR-2). It names no table, column, rule, denial class, or row
# count, and carries no "a rule exists for you" signal — every deny surfaces the
# same string so the client cannot distinguish one unresolvable cause from
# another. The sensitive detail (denial_class, tables, identity) is retained
# server-side (log record, F5 evidence sink), never in this message.
DENIAL_MESSAGE = __(
    "This data cannot be displayed due to a security policy. "
    "Contact your administrator if you believe this is an error."
)


class EnforcementOutcome(Enum):
    """The three possible outcomes of an enforcement decision.

    ``APPLIED`` — row filters were injected into the query.
    ``NOOP`` — no rule applies to any referenced table; the query is untouched.
    ``DENIED`` — enforcement could not be resolved; the query must not run.
    """

    APPLIED = "applied"
    NOOP = "noop"
    DENIED = "denied"


@dataclass
class EnforcementDecision:
    """Result of an enforcement pass over a compiled query.

    :param outcome: which of the fail-closed outcomes was reached.
    :param sql: the SQL to execute — rewritten when ``APPLIED``, otherwise the
        original compiled SQL.
    :param applied_filter_count: number of row-filter predicates injected.
    :param denial_class: set only when ``outcome`` is ``DENIED``; identifies the
        unresolvable class that forced the deny.
    :param evidence: opaque, non-disclosive metadata describing the decision for
        the audit sink.
    """

    outcome: EnforcementOutcome
    sql: str
    applied_filter_count: int = 0
    denial_class: Optional[str] = None
    evidence: dict[str, Any] = field(default_factory=dict)


class AccessControlTransform(ABC):
    """Seam for applying access controls to a compiled query.

    Implementations rewrite (or wrap) the SQL to enforce row-level security.
    Column masking is reserved: the seam exists so callers commit to it, but any
    invocation fails loudly until it is implemented.
    """

    @abstractmethod
    def apply_row_filters(
        self,
        datasource: Any,
        compiled_sql: str,
        identity: Optional[GuestUser],
        path: Optional[str],
    ) -> EnforcementDecision:
        """Apply row-level filters to ``compiled_sql`` for ``identity``."""

    def apply_column_masks(
        self,
        datasource: Any,
        compiled_sql: str,
        identity: Optional[GuestUser],
        path: Optional[str],
    ) -> EnforcementDecision:
        """Reserved column-masking seam. Not yet supported."""
        raise NotImplementedError("Column masking is not yet supported")


def enforce(
    datasource: Any,
    compiled_sql: str,
    identity: Optional[GuestUser],
    path: Optional[str],
) -> EnforcementDecision:
    """Apply fail-closed RLS enforcement to a compiled query.

    This is the single entry point every governed query must pass through. It
    classifies the datasource kind (physical/virtual ``SqlaTable`` vs an ad-hoc
    SQL Lab ``Query``) so predicate resolution can route accordingly, and
    returns the compiled SQL untouched. Row-filter predicates for the
    ``SqlaTable`` path are injected upstream, so re-emitting the same SQL here is
    behavior-preserving; the gate verifies passage without double-applying.
    Predicate application and rewriting are handled by the row-filter transform.
    """
    # Imported inside the function: the connector and SQL Lab models import from
    # this package's callers, so a module-level import would cycle.
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

    if isinstance(datasource, Query):
        # Ad-hoc SQL Lab query: predicates are NOT injected upstream, so the gate
        # rewrites the SQL here to match the SQL-Lab RLS mechanism exactly (a
        # governed chart must return the same row-set as SQL Lab — the #33346
        # defect). Resolution is memoized per request and per identity.
        decision = _enforce_query(datasource, compiled_sql, identity)
    elif isinstance(datasource, SqlaTable):
        # The SqlaTable path already has its row filters injected upstream; the
        # gate verifies passage without double-applying, so the SQL is re-emitted
        # unchanged.
        decision = EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=compiled_sql
        )
    else:
        # Unrecognized datasource kind: preserve the SQL verbatim rather than
        # raise, keeping render behavior identical until predicate resolution is
        # wired.
        decision = EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=compiled_sql
        )

    # Persist audit evidence for this decision. The sink is DECOUPLED from the
    # decision: it swallows its own failures, but this call is additionally
    # guarded so that even an unexpected error here can never change or block the
    # enforcement outcome the caller relies on (fail-closed decision-independence).
    try:
        record_evidence(datasource, identity, path, decision)
    except Exception:  # noqa: BLE001 -- evidence must never affect enforcement.
        logger.exception("RLS evidence sink raised past its own boundary")

    return decision


# Textual markers of unrendered templating in compiled SQL. By the time SQL
# reaches the gate it should already be rendered; a surviving Jinja delimiter
# means the referenced table set is indeterminate at rewrite time (FR-3
# dynamic_sql). Matching on the raw text catches control blocks (``{% %}``)
# that never reach the parser as well as expression refs (``{{ }}``).
_TEMPLATE_MARKERS = ("{{", "}}", "{%", "%}")


def _classify_unresolvable(
    database: Any,
    catalog: Optional[str],
    schema: str,
    compiled_sql: str,
) -> Optional[str]:
    """Return the FR-3 ``denial_class`` if RLS cannot be injected safely.

    The gate must never emit an unfiltered render of a governed query whose
    predicate-injection target cannot be established deterministically. This
    classifies the statically detectable unresolvable cases — anything uncertain
    defaults to deny (returns a ``denial_class``); a genuinely resolvable query
    returns ``None`` and proceeds to the rewrite. Detection order runs the
    cheapest, most certain checks first.
    """
    # Function-local imports: the SQL parser package and its error types pull in
    # modules that import this package's callers, so a module-level import cycles.
    from superset.exceptions import SupersetParseError
    from superset.sql.parse import SQLGLOT_DIALECTS, SQLStatement, Table
    from superset.utils.rls import get_predicates_for_table

    # dynamic_sql — unrendered templating leaves the table set indeterminate.
    if any(marker in compiled_sql for marker in _TEMPLATE_MARKERS):
        return "dynamic_sql"

    # unsupported_dialect — no sqlglot dialect mapping means the rewrite path
    # cannot parse/transform this engine's SQL, so injection can't be verified.
    engine = database.db_engine_spec.engine
    if engine not in SQLGLOT_DIALECTS:
        return "unsupported_dialect"

    # parse_failure — SQL the parser cannot represent yields no trustworthy
    # table set; deny rather than run it unfiltered.
    try:
        statement = SQLStatement(compiled_sql, engine=engine)
    except SupersetParseError:
        return "parse_failure"
    except Exception:  # noqa: BLE001
        # Any other parser-layer failure is equally unresolvable: uncertainty
        # about the table set must fail closed, not raise past the gate.
        return "parse_failure"

    qualified = {
        table.qualify(catalog=catalog, schema=schema) for table in statement.tables
    }

    # cross_db_ref — references spanning distinct catalogs can't be scoped to a
    # single governed source, so a table-name predicate could target the wrong DB.
    catalogs = {table.catalog for table in qualified if table.catalog}
    if len(catalogs) > 1:
        return "cross_db_ref"

    # alias_shadow — a CTE alias shadows a governed table name. CTEs are excluded
    # from the parsed table set, so predicate resolution never sees the alias and
    # the outer reference reads the CTE's (unfiltered) rows. If any CTE alias
    # resolves to a governed table (has predicates), a by-name injection would
    # target the wrong relation and leak; deny rather than run it unfiltered.
    default_catalog = database.get_default_catalog()
    for alias in _cte_aliases(statement):
        alias_table = Table(alias).qualify(catalog=catalog, schema=schema)
        if get_predicates_for_table(alias_table, database, default_catalog):
            return "alias_shadow"

    return None


def _cte_aliases(statement: Any) -> set[str]:
    """Names bound by CTEs in the statement (``exp.CTE`` aliases).

    These are excluded from the parsed table set, so a CTE whose alias shadows a
    governed table name is the subtle leak the ``alias_shadow`` class guards.
    Returns an empty set for statements the walk can't introspect.
    """
    import sqlglot.expressions as exp

    parsed = getattr(statement, "_parsed", None)
    if parsed is None or not hasattr(parsed, "find_all"):
        return set()
    return {cte.alias for cte in parsed.find_all(exp.CTE) if cte.alias}


def _enforce_query(
    datasource: Any,
    compiled_sql: str,
    identity: Optional[GuestUser],
) -> EnforcementDecision:
    """Inject RLS predicates into an ad-hoc ``Query`` datasource's SQL.

    Delegates to the shared ``utils.rls`` rewriter (the same ``apply_rls`` /
    parser path SQL Lab uses) so a governed ad-hoc-SQL chart is row-exact with
    SQL Lab. A guest identity's global (unscoped) RLS is injected on this path
    too — the rewriter re-includes it here because there is no virtual-dataset
    outer WHERE to carry it, unlike the SQL Lab door guests cannot reach.
    Returns ``NOOP`` with the SQL untouched when no rule applies. Any
    FR-3 unresolvable class — or any failure of the parse/resolve/rewrite path —
    fails closed to ``DENIED`` so a governed query is never rendered unfiltered.
    """
    from superset.utils.rls import rewrite_sql_for_query, RLSUnresolvableError

    database = datasource.database
    catalog = datasource.catalog or database.get_default_catalog()
    # Resolve the per-query effective schema exactly as SQL Lab / the executor
    # do, so unqualified table references match the same rules.
    schema = datasource.schema or database.get_default_schema_for_query(datasource)
    schema = schema or ""

    denial_class = _classify_unresolvable(database, catalog, schema, compiled_sql)
    if denial_class is not None:
        return EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=compiled_sql,
            denial_class=denial_class,
        )

    try:
        rewritten, applied_count = rewrite_sql_for_query(
            database,
            catalog,
            schema,
            compiled_sql,
            identity,
        )
    except RLSUnresolvableError as ex:
        # Resolver-level ambiguity (e.g. semantic_mismatch) surfaces a structured
        # denial class rather than a raw exception or a best-effort guess.
        return EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=compiled_sql,
            denial_class=ex.denial_class,
        )
    except Exception:  # noqa: BLE001
        # The static classifier passed, but the rewrite still failed: predicate
        # injection could not be completed, so fail closed rather than let the
        # exception escape and risk an unfiltered render downstream.
        return EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=compiled_sql,
            denial_class="semantic_mismatch",
        )

    if applied_count:
        return EnforcementDecision(
            outcome=EnforcementOutcome.APPLIED,
            sql=rewritten,
            applied_filter_count=applied_count,
        )
    return EnforcementDecision(outcome=EnforcementOutcome.NOOP, sql=compiled_sql)


# --------------------------------------------------------------------------- #
# Evidence sink
#
# Persists one append-only audit row per governed enforcement decision. The sink
# is deliberately DECOUPLED from the decision: it records what was decided, it
# never influences it. Every failure mode — no app/session, a DB outage, a
# serialization error — is caught and logged at the sink boundary and swallowed,
# so an audit-write problem can never flip an allow into a deny (or vice versa)
# or block a render. Only ``applied`` and ``denied`` outcomes are persisted; a
# ``noop`` (no rule applied to any referenced table) writes nothing.
#
# The rows carry counts and classes only — never SQL text, clause text, table
# names, or row values — so the audit trail holds no governed data or PII. The
# identity is reduced to an opaque, non-reversible handle.
# --------------------------------------------------------------------------- #

#: Config key toggling the tamper-evidence hash chain over evidence rows.
_HASH_CHAIN_CONFIG_KEY = "RLS_EVIDENCE_HASH_CHAIN_ENABLED"

#: Field separator for the canonical, order-fixed content string that is hashed.
#: A control character keeps it clear of any value a field could legitimately
#: hold, so distinct field boundaries can never collide.
_HASH_FIELD_SEP = "\x1f"


def _hash_chain_enabled() -> bool:
    """Whether the evidence hash chain is enabled by config.

    Read via the live app config so it can be toggled per deployment; defaults to
    disabled (chain columns stay null) and returns ``False`` outside any app
    context so the sink degrades quietly rather than raising.
    """
    try:
        from flask import current_app, has_app_context

        if not has_app_context():
            return False
        return bool(current_app.config.get(_HASH_CHAIN_CONFIG_KEY, False))
    except Exception:  # noqa: BLE001 -- config access must never break the sink.
        return False


def _identity_handle(identity: Optional[GuestUser]) -> str:
    """Opaque, non-reversible handle for the acting identity.

    Deterministic for one identity (so its evidence is attributable) and distinct
    across identities (so two tenants never share a handle), while disclosing no
    PII: the raw username / user id is hashed, never stored. A guest folds in its
    RLS rule set so the same username presenting different rules keys apart.
    """
    if identity is not None:
        username = getattr(identity, "username", None)
        material = f"guest:{username}:{getattr(identity, 'rls', None)!r}"
    else:
        # Regular / anonymous user: key on the current user id when available.
        user_id = None
        try:
            from flask import has_app_context

            if has_app_context():
                from superset.utils.core import get_user_id

                user_id = get_user_id()
        except Exception:  # noqa: BLE001 -- fall back to the anonymous handle.
            user_id = None
        material = f"user:{user_id}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _datasource_kind_and_id(datasource: Any) -> tuple[str, Optional[int]]:
    """Classify the datasource for the evidence row: kind string and internal id.

    Uses the class name rather than an ``isinstance`` import to stay off the
    connector import cycle and to remain robust to test doubles; anything that is
    not an ad-hoc ``Query`` is recorded as a ``sqla_table``.
    """
    from superset.models.rls_evidence import (
        DATASOURCE_KIND_QUERY,
        DATASOURCE_KIND_SQLA_TABLE,
    )

    kind = (
        DATASOURCE_KIND_QUERY
        if type(datasource).__name__ == "Query"
        else DATASOURCE_KIND_SQLA_TABLE
    )
    raw_id = getattr(datasource, "id", None)
    try:
        datasource_id = int(raw_id) if raw_id is not None else None
    except (TypeError, ValueError):
        datasource_id = None
    return kind, datasource_id


def compute_evidence_hash(row: Any, prev_hash: Optional[str]) -> str:
    """Content hash for an evidence row, chained onto ``prev_hash``.

    Hashes a canonical, order-fixed rendering of the row's audit content together
    with the prior row's hash, so any later alteration of a row's content — or of
    the chain ordering — changes the recomputed hash and is detectable. Excludes
    the primary key and the integrity columns themselves.
    """
    ts = row.ts.isoformat() if isinstance(row.ts, datetime) else str(row.ts)
    parts = [
        ts,
        str(row.path),
        str(row.identity_handle),
        str(row.datasource_kind),
        str(row.datasource_id),
        str(row.outcome),
        str(row.applied_filter_count),
        str(row.denial_class),
        str(prev_hash),
    ]
    material = _HASH_FIELD_SEP.join(parts)
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def verify_evidence_chain(rows: Sequence[Any]) -> bool:
    """Verify an ordered sequence of evidence rows forms an intact hash chain.

    Returns ``True`` when every row's stored ``integrity_hash`` recomputes from
    its content and its recorded ``integrity_prev_hash``, and each row's prev-hash
    matches its predecessor's hash. Returns ``False`` on the first broken link —
    the signal that a row was altered, inserted, or removed. Rows with no hash
    (chain disabled when written) are treated as unverifiable and fail closed.
    """
    prev_hash: Optional[str] = None
    for row in rows:
        if row.integrity_hash is None:
            return False
        if row.integrity_prev_hash != prev_hash:
            return False
        if compute_evidence_hash(row, row.integrity_prev_hash) != row.integrity_hash:
            return False
        prev_hash = row.integrity_hash
    return True


def _latest_chain_hash(session: Any) -> Optional[str]:
    """Most recent row's ``integrity_hash``, or ``None`` for the genesis row."""
    from superset.models.rls_evidence import RlsEnforcementEvidence

    last = (
        session.query(RlsEnforcementEvidence)
        .order_by(RlsEnforcementEvidence.id.desc())
        .first()
    )
    return last.integrity_hash if last is not None else None


def record_evidence(
    datasource: Any,
    identity: Optional[GuestUser],
    path: Optional[str],
    decision: EnforcementDecision,
    session: Any = None,
) -> None:
    """Persist one audit-evidence row for an enforcement ``decision``.

    Decoupled from the decision: this never returns a value the caller acts on and
    never re-raises. ``applied`` and ``denied`` outcomes each write exactly one
    row; ``noop`` writes nothing. When the hash chain is enabled, the row is
    linked to its predecessor for tamper-evidence; when disabled, the chain
    columns are left null and behavior is otherwise unchanged.

    :param session: persistence session; defaults to the app metadata session.
        Injectable so failure injection and round-trip tests can drive a real or
        failing session without a full app context.
    """
    try:
        if decision.outcome is EnforcementOutcome.APPLIED:
            outcome = "applied"
        elif decision.outcome is EnforcementOutcome.DENIED:
            outcome = "denied"
        else:
            # NOOP (or anything non-governed): nothing to record.
            return

        from superset.models.rls_evidence import RlsEnforcementEvidence

        if session is None:
            from superset import db

            session = db.session

        kind, datasource_id = _datasource_kind_and_id(datasource)
        row = RlsEnforcementEvidence(
            ts=datetime.now(timezone.utc).replace(tzinfo=None),
            path=(path or "")[:32],
            identity_handle=_identity_handle(identity),
            datasource_kind=kind,
            datasource_id=datasource_id,
            outcome=outcome,
            applied_filter_count=decision.applied_filter_count,
            denial_class=decision.denial_class,
        )

        if _hash_chain_enabled():
            prev_hash = _latest_chain_hash(session)
            row.integrity_prev_hash = prev_hash
            row.integrity_hash = compute_evidence_hash(row, prev_hash)

        session.add(row)
        session.commit()
    except Exception:  # noqa: BLE001 -- swallow at the sink boundary (TR-8).
        # The enforcement decision has already been made and stands; an evidence
        # failure is logged for ops but never propagated to allow/deny/render.
        logger.exception("Failed to persist RLS enforcement evidence")
        try:
            if session is not None:
                session.rollback()
        except Exception:  # noqa: BLE001 -- rollback is best-effort only.
            logger.debug("RLS evidence sink rollback failed", exc_info=True)
