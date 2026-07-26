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
"""Filters for Subject-related API endpoints (editor/viewer pickers)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional

from flask import current_app
from flask_babel import lazy_gettext as _
from sqlalchemy import or_, Table
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter


def _apply_excluded_users(query: Query) -> Query:
    missing = object()
    configured_excluded_users = current_app.config.get(
        "EXCLUDE_USERS_FROM_LISTS", missing
    )
    if configured_excluded_users is missing:
        return query
    excluded_users = (
        security_manager.get_exclude_users_from_lists()
        if configured_excluded_users is None
        else configured_excluded_users
    )
    if not excluded_users:
        return query
    user_model = security_manager.user_model
    return query.filter(
        or_(
            Subject.type != SubjectType.USER,
            Subject.user_id.is_(None),
            Subject.user.has(user_model.username.not_in(excluded_users)),
        )
    )


def _apply_extra_related_query_filters(query: Query) -> Query:
    extra_filters = current_app.config.get("EXTRA_RELATED_QUERY_FILTERS") or {}
    filter_specs: tuple[
        tuple[str, SubjectType, Any, Callable[[], type[DeclarativeMeta]]],
        ...,
    ] = (
        (
            "user",
            SubjectType.USER,
            Subject.user_id,
            lambda: security_manager.user_model,
        ),
        (
            "role",
            SubjectType.ROLE,
            Subject.role_id,
            lambda: security_manager.role_model,
        ),
        (
            "group",
            SubjectType.GROUP,
            Subject.group_id,
            lambda: security_manager.group_model,
        ),
    )

    for key, subject_type, subject_fk, get_model in filter_specs:
        if extra_filter := extra_filters.get(key):
            model = get_model()
            related_query = extra_filter(db.session.query(model)).with_entities(
                model.id
            )
            query = query.filter(
                or_(Subject.type != subject_type, subject_fk.in_(related_query))
            )

    return query


def _apply_subject_list_filters(query: Query) -> Query:
    return _apply_extra_related_query_filters(_apply_excluded_users(query))


def subject_type_filter(entity_config_key: str | None = None) -> type[BaseFilter]:
    """Return a BaseFilter subclass scoped to a specific entity config.

    The per-entity config key overrides ``SUBJECTS_RELATED_TYPES`` when set.
    When neither is set, no filtering is applied.
    """

    class _Filter(BaseFilter):
        name = _("Subject type")
        arg_name = "subject_type"

        def apply(self, query: Query, value: Any) -> Query:
            global_types: list[int] | None = current_app.config.get(
                "SUBJECTS_RELATED_TYPES"
            )
            entity_types: list[int] | None = (
                current_app.config.get(entity_config_key) if entity_config_key else None
            )

            allowed = entity_types if entity_types is not None else global_types
            if allowed is None:
                return _apply_subject_list_filters(query)

            return _apply_subject_list_filters(query.filter(Subject.type.in_(allowed)))

    return _Filter


class BaseFilterRelatedSubjects(BaseFilter):
    """Filter subject types based on SUBJECTS_RELATED_TYPES config.

    Applied as base_related_field_filters so only configured types
    appear in the editor/viewer picker dropdowns.

    Kept for backwards compatibility — prefer ``subject_type_filter()`` for
    per-entity config support.
    """

    name = _("Subject type")
    arg_name = "subject_type"

    def apply(self, query: Query, value: Any) -> Query:
        allowed_types: list[int] | None = current_app.config.get(
            "SUBJECTS_RELATED_TYPES"
        )
        if allowed_types is not None:
            return _apply_subject_list_filters(
                query.filter(Subject.type.in_(allowed_types))
            )
        return _apply_subject_list_filters(query)


class FilterRelatedSubjects(BaseFilter):
    """ILIKE search on subject label and extra_search.

    Applied as related_field_filters for the async select search.
    """

    name = _("Subject")
    arg_name = "subjects"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if value:
            ilike_value = f"%{value}%"
            return _apply_subject_list_filters(
                query.filter(
                    or_(
                        Subject.label.ilike(ilike_value),
                        Subject.extra_search.ilike(ilike_value),
                    )
                )
            )
        return _apply_subject_list_filters(query)


class SubjectAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """ILIKE search across a subject's textual columns.

    Used by the Subject REST API ``search_filters`` for free-text search.
    """

    name = _("All Text")
    arg_name = "subject_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                Subject.label.ilike(ilike_value),
                Subject.secondary_label.ilike(ilike_value),
                Subject.extra_search.ilike(ilike_value),
            )
        )


def filter_subject_relation_by_current_user(
    query: Query,
    *,
    model: type[DeclarativeMeta],
    relation_table: Table,
    fk_column: str,
) -> Query:
    """Filter resources whose subject relation includes the current user."""
    from superset.subjects.utils import get_user_subject_ids_subquery

    user_id = get_user_id()
    if not user_id:
        return query.filter(model.id < 0)

    fk_col = relation_table.c[fk_column]
    subject_subquery = get_user_subject_ids_subquery(user_id)
    related_query = db.session.query(fk_col).filter(
        relation_table.c.subject_id.in_(subject_subquery)
    )
    return query.filter(model.id.in_(related_query))


def subject_relation_exists_for_current_user(
    relation_table: Table,
    *,
    subject_column: str = "subject_id",
) -> Any:
    """Return an ``IN`` predicate for a relation table and current user subjects."""
    from superset.subjects.utils import get_user_subject_ids_subquery

    user_id = get_user_id()
    if not user_id:
        return relation_table.c[subject_column].in_([])
    return relation_table.c[subject_column].in_(get_user_subject_ids_subquery(user_id))


class EditableFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Filter resources the current user can edit (subject-based).

    Checks all user subjects (user + roles + groups) so list filters match the
    actual editorship check.
    Admin: no filter (sees everything).

    Subclasses must set ``model`` and ``editors_table``.
    """

    name = _("Editable")
    arg_name = "is_editable"

    model: type[DeclarativeMeta]
    editors_table: Table
    editors_fk_column: str  # e.g. "dashboard_id", "chart_id"

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.is_admin():
            return query

        return filter_subject_relation_by_current_user(
            query,
            model=self.model,
            relation_table=self.editors_table,
            fk_column=self.editors_fk_column,
        )
