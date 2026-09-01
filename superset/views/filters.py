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
import logging
from datetime import datetime, timedelta
from typing import Any, cast, ClassVar, Optional

from flask import current_app as app, g
from flask_appbuilder.models.filters import BaseFilter
from flask_babel import lazy_gettext
from sqlalchemy import and_, false as sa_false, or_
from sqlalchemy.orm import Query

from superset import security_manager
from superset.extensions import db
from superset.models.helpers import (
    format_time_humanized,
    SKIP_VISIBILITY_FILTER_CLASSES,
    SoftDeleteMixin,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class FilterRelatedUsers(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    A filter to allow searching for related users of a resource.

    Use in the api by adding something like:
    related_field_filters = {
      "editors": RelatedFieldFilter("first_name", FilterRelatedUsers),
    }
    """

    name = lazy_gettext("User")
    arg_name = "users"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        user_model = security_manager.user_model
        like_value = "%" + cast(str, value) + "%"
        return query.filter(
            or_(
                # could be made to handle spaces between names more gracefully
                (user_model.first_name + " " + user_model.last_name).ilike(like_value),
                user_model.username.ilike(like_value),
            )
        )


class BaseFilterRelatedUsers(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter to apply on related users. Will exclude users in EXCLUDE_USERS_FROM_LISTS

    Use in the api by adding something like:
    ```
    base_related_field_filters = {
        "editors": [["id", BaseFilterRelatedUsers, lambda: []]],
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }
    ```
    """

    name = lazy_gettext("username")
    arg_name = "username"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if extra_filters := app.config["EXTRA_RELATED_QUERY_FILTERS"].get(
            "user",
        ):
            query = extra_filters(query)

        exclude_users = (
            security_manager.get_exclude_users_from_lists()
            if app.config["EXCLUDE_USERS_FROM_LISTS"] is None
            else app.config["EXCLUDE_USERS_FROM_LISTS"]
        )
        if exclude_users:
            user_model = security_manager.user_model
            return query.filter(and_(user_model.username.not_in(exclude_users)))

        return query


class BaseFilterRelatedRoles(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter to apply on related roles.
    """

    name = lazy_gettext("role")
    arg_name = "role"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if extra_filters := app.config["EXTRA_RELATED_QUERY_FILTERS"].get(
            "role",
        ):
            return extra_filters(query)

        return query


class BaseFilterRelatedGroups(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter to apply on related groups.
    """

    name = lazy_gettext("group")
    arg_name = "group"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if extra_filters := app.config["EXTRA_RELATED_QUERY_FILTERS"].get(
            "group",
        ):
            return extra_filters(query)

        return query


class FilterRelatedTables(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    A filter to allow searching for related tables.
    Use in the api by adding something like:
    related_field_filters = {
      "tables": RelatedFieldFilter("table_name", FilterRelatedTables),
    }
    """

    name = lazy_gettext("Table")
    arg_name = "tables"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        from superset.connectors.sqla.models import SqlaTable

        like_value = "%" + cast(str, value) + "%"
        return query.filter(SqlaTable.table_name.ilike(like_value))


AUGMENT_RESPONSE_WITH_DELETED_AT = "_augment_response_with_deleted_at"

# Tracks the classes that ``BaseDeletedStateFilter`` added to
# ``session.info[SKIP_VISIBILITY_FILTER_CLASSES]`` for this request,
# so ``SoftDeleteApiMixin.pre_get_list`` can remove only those (and not
# any entries a programmatic caller — context manager, DAO bypass —
# may have placed there independently).
DELETED_STATE_ADDED_CLASSES = "_deleted_state_added_classes"


class BaseDeletedStateFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Base class for ``*_deleted_state`` rison filters.

    Subclasses set ``arg_name`` (e.g. ``"chart_deleted_state"``) and
    ``model`` (the SoftDeleteMixin model class). Values:

      * ``include``  — return live + soft-deleted rows
      * ``only``     — return only soft-deleted rows
      * absent / any other value — default behaviour (live rows only)

    Scope decisions:

      * The visibility-filter bypass is applied at the **session** level
        and scoped to the filter's own ``model`` class only. FAB list
        endpoints construct multiple statements per request (count, then
        an inner + outer pair for many-to-many ``list_columns``) and the
        outer fetch is built from a fresh ``session.query(self.obj)``
        that drops per-query ``execution_options``. Session-scoped
        bypass survives that reconstruction; per-class scoping prevents
        the bypass from unhiding soft-deleted rows of any *other*
        ``SoftDeleteMixin`` entity that the request might touch.
      * The bypass is **released after the list response is augmented**
        by ``SoftDeleteApiMixin.pre_get_list``, so any code that runs
        later in the same request (audit hooks, ``after_request``
        handlers, dependent operations during response serialisation)
        sees normal filtered visibility. The release is scoped to the
        classes *this filter* added — programmatic callers using the
        ``skip_visibility_filter`` context manager or DAO bypass are
        unaffected. Classes added are tracked in
        ``g._deleted_state_added_classes`` (request-scoped, auto-cleans
        at request teardown).
      * The response-augmentation step (which adds a ``deleted_at``
        field to each result row) is signalled via a separate
        request-scoped flag ``g._augment_response_with_deleted_at``.
        Two concerns, two channels.
    """

    name = lazy_gettext("Deleted state")
    # Subclasses bind ``model`` to a concrete ``SoftDeleteMixin``
    # subclass. Typed as ``type[SoftDeleteMixin]`` so a subclass that
    # accidentally binds to a non-soft-deletable entity fails mypy
    # rather than crashing at runtime on ``.deleted_at``.
    model: ClassVar[type[SoftDeleteMixin]]

    @staticmethod
    def _normalize(value: Any) -> str:
        """Canonical lowercase token for a raw filter value.

        Single source of truth so subclasses that also need the normalized
        value reuse this rather than recomputing (and silently drifting from)
        the expression.
        """
        return str(value).lower().strip() if value is not None else ""

    def apply(self, query: Query, value: Any) -> Query:
        normalized = self._normalize(value)
        if normalized not in {"include", "only"}:
            return query
        self._opt_into_deleted_state(query)
        if normalized == "only":
            query = query.filter(self.model.deleted_at.is_not(None))
        return self._scope_to_restore_audience(query, normalized)

    def _scope_to_restore_audience(self, query: Query, normalized: str) -> Query:
        """Cross-entity contract: non-admins may only enumerate soft-deleted
        rows they can edit — the same audience that can restore them (mirrors
        ``BaseRestoreCommand``'s ``raise_for_editorship``). Live rows are
        unaffected: they keep the entity's normal access filtering.

        Lives on the base so the per-entity filters stay pure declarations
        (``arg_name`` + ``model``) instead of carrying verbatim copies of
        this body. ``any()`` emits an EXISTS subquery so it composes with
        the entity's base access filter without duplicate rows from a join.

        "Mirrors" is deliberately approximate in two known, fail-safe ways:
        editorship granted through ``EXTRA_EDITORS_RESOLVER`` and guest users
        whose editorship derives from roles have no SQL form (the resolver is
        arbitrary per-deployment Python), so both can restore via a direct
        ``POST /restore`` yet see an under-enumerated archive. Narrower than
        the true audience, never wider.

        A model *without* an ``editors`` relationship fails closed for
        non-admins: there is no audience to scope to, so nothing is
        enumerable. Returning the query unfiltered here would hand every
        soft-deleted row of a future ``SoftDeleteMixin`` adopter to anyone
        with list access -- a fail-open default on a security-scoped filter.
        """
        if security_manager.is_admin():
            return query
        editors = getattr(self.model, "editors", None)
        if editors is None:
            if normalized == "only":
                # Nothing is enumerable; emit an always-false predicate rather
                # than an empty result-set hack so pagination stays coherent.
                return query.filter(sa_false())
            return query.filter(self.model.deleted_at.is_(None))
        user_id = get_user_id()
        from superset.subjects.models import Subject  # noqa: PLC0415
        from superset.subjects.utils import (  # noqa: PLC0415
            get_user_subject_ids_subquery,
        )

        editable = editors.any(
            Subject.id.in_(get_user_subject_ids_subquery(user_id))
            if user_id
            else Subject.id.in_([])
        )
        if normalized == "only":
            # ``apply`` already restricted to ``deleted_at IS NOT NULL``.
            return query.filter(editable)
        # ``include``: keep all live rows (normal access) and add only the
        # soft-deleted rows this user can edit.
        return query.filter(or_(self.model.deleted_at.is_(None), editable))

    def _opt_into_deleted_state(self, query: Query) -> None:
        """The two-step opt-in shared by ``include`` and ``only``: install
        the per-class session bypass so the listener stops filtering this
        entity, and signal to ``SoftDeleteApiMixin.pre_get_list`` that
        result rows should carry a ``deleted_at`` field.
        """
        self._add_session_bypass(query)
        self._mark_response_for_deleted_at_augmentation()

    def _add_session_bypass(self, query: Query) -> None:
        """Add ``self.model`` to the session's bypass class set, so the
        listener stops filtering this entity for FAB's count + inner +
        outer queries. The class is removed from the bypass set by
        ``SoftDeleteApiMixin._release_session_bypass`` after
        ``pre_get_list`` augments the response — so any code that runs
        later in the same request sees normal filtered visibility.

        The class is also recorded in ``g._deleted_state_added_classes``
        so the release step removes only the entries *this filter*
        added, leaving any entries placed by the ``skip_visibility_filter``
        context manager or DAO bypass intact.
        """
        bypass = query.session.info.setdefault(SKIP_VISIBILITY_FILTER_CLASSES, set())
        bypass.add(self.model)
        # Track for release in ``SoftDeleteApiMixin._release_session_bypass``.
        added: set[type[SoftDeleteMixin]] = getattr(
            g, DELETED_STATE_ADDED_CLASSES, set()
        ) | {self.model}
        setattr(g, DELETED_STATE_ADDED_CLASSES, added)

    @staticmethod
    def _mark_response_for_deleted_at_augmentation() -> None:
        """Signal to ``SoftDeleteApiMixin.pre_get_list`` that this request
        opted into surfacing soft-deleted rows, so the response rows
        should be augmented with their ``deleted_at`` value.

        Distinct from the visibility-filter bypass, which is applied at
        the session level on the filter's own model class.
        """
        setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)


class BaseDeletedRecencyFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Keep rows archived within the last *value* days, by the server's clock.

    ``deleted_at`` is stamped with the server's naive-local
    ``datetime.now()``, so only a cutoff resolved here -- on the clock that
    stamped the column -- is correct on non-UTC deployments. An absolute
    client-computed cutoff would be shifted by the server offset and frozen
    at page mount (a long-lived tab drifts a day per day). The client sends
    a stable day count, which also survives the URL and stays shareable.

    Subclasses set ``arg_name`` (e.g. ``"chart_deleted_recency"``).
    """

    name = lazy_gettext("Archived within")

    def apply(self, query: Query, value: Any) -> Query:
        try:
            days = int(value)
        except (TypeError, ValueError):
            # Filter values arrive from the URL; refusing loudly would turn a
            # mangled query string into a 500. An unfiltered list is the same
            # answer every other malformed FAB filter value produces.
            return query
        if days <= 0:
            return query
        try:
            cutoff = datetime.now() - timedelta(days=days)
        except OverflowError:
            # int() parses arbitrarily large values, and both timedelta()
            # and the subtraction raise OverflowError beyond their bounds
            # (~2.7 million days) -- which would be exactly the 500 the
            # comment above promises to avoid. A window wider than the
            # datetime range keeps every archived row, so unfiltered is
            # also the semantically correct answer.
            return query
        return query.filter(self.model.deleted_at > cutoff)


class SoftDeleteApiMixin:
    """API mixin that augments list responses with a ``deleted_at``
    field on each row when the request opted into surfacing soft-deleted
    rows via the entity's ``BaseDeletedStateFilter`` subclass.

    Mount this on concrete REST API classes for entities that include
    ``SoftDeleteMixin``::

        class ChartRestApi(SoftDeleteApiMixin, BaseSupersetModelRestApi):
            ...

    The mixin chains via ``super().pre_get_list(data)``, so other
    ``pre_get_list`` behaviour in the inheritance chain still runs.
    When the request has not opted into soft-deleted visibility, the
    augmentation is a no-op.
    """

    # Concrete subclasses bind these via FAB's ModelRestApi machinery.
    datamodel: Any  # SQLAInterface providing get_pk_name() and .obj

    def pre_get_list(self, data: dict[str, Any]) -> None:
        super().pre_get_list(data)  # type: ignore[misc]
        if not self._consume_augmentation_flag():
            return
        try:
            self._inject_deleted_at(data)
        finally:
            # Release the session-scoped bypass now that FAB is done with
            # the list query. Code that runs later in the same request
            # (after_request handlers, post-response audit hooks) sees
            # normal filtered visibility rather than the widened scope
            # the filter installed for the list query.
            self._release_session_bypass()

    @staticmethod
    def _release_session_bypass() -> None:
        """Remove from ``session.info[SKIP_VISIBILITY_FILTER_CLASSES]``
        only the classes ``BaseDeletedStateFilter._add_session_bypass``
        added for this request. Programmatic bypasses installed by the
        ``skip_visibility_filter`` context manager or DAO methods (which
        manage their own lifecycle) remain untouched.
        """
        added: set[type[SoftDeleteMixin]] = getattr(
            g, DELETED_STATE_ADDED_CLASSES, set()
        )
        if not added:
            return
        bypass: set[type[SoftDeleteMixin]] = db.session.info.get(
            SKIP_VISIBILITY_FILTER_CLASSES, set()
        )
        bypass -= added
        setattr(g, DELETED_STATE_ADDED_CLASSES, set())

    @staticmethod
    def _consume_augmentation_flag() -> bool:
        """Read-and-clear the request-scoped augmentation flag. Returning
        ``True`` means the caller should inject ``deleted_at`` into the
        response. Clearing prevents the flag from leaking to a later
        list operation within the same request (e.g., a batch endpoint
        dispatching multiple list views).
        """
        requested = getattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, False)
        setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, False)
        return requested

    def _inject_deleted_at(self, data: dict[str, Any]) -> None:
        """Augment each result row with its ``deleted_at`` value, fetched
        from the DB in a single projection query keyed by the IDs FAB
        already collected.
        """
        ids = cast(list[Any], data.get("ids", []))
        deleted_at_map = self._get_deleted_at_map(ids)
        for row, row_id in zip(data.get("result", []), ids, strict=False):
            iso_value, humanized = deleted_at_map.get(row_id, (None, None))
            row["deleted_at"] = iso_value
            # Humanized on the server, like changed_on_delta_humanized on the
            # sibling list pages: deleted_at is stamped with the server's
            # naive-local clock, so any client-side parse has to guess the
            # timezone -- and the archive UI guessed UTC, shifting every
            # displayed age by the server offset on non-UTC deployments.
            row["deleted_at_delta_humanized"] = humanized

    def _get_deleted_at_map(
        self, ids: list[Any]
    ) -> dict[Any, tuple[str | None, str | None]]:
        if not ids:
            return {}
        # Raw session query — read-only projection of two columns on
        # already-known IDs, not a general entity lookup. The
        # primary-key column is resolved via the datamodel rather than
        # hardcoded to ``id`` so entities with non-integer PKs work
        # without changes here.
        pk_name = self.datamodel.get_pk_name()
        pk_col = getattr(self.datamodel.obj, pk_name)
        rows = (
            db.session.query(pk_col, self.datamodel.obj.deleted_at)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {self.datamodel.obj}})
            .filter(pk_col.in_(ids))
            .all()
        )
        return {
            row_id: (
                self._serialize_deleted_at(deleted_at),
                format_time_humanized(deleted_at) if deleted_at else None,
            )
            for row_id, deleted_at in rows
        }

    @staticmethod
    def _serialize_deleted_at(value: datetime | None) -> str | None:
        return value.isoformat() if value else None
