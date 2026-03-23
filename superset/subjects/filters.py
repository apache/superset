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

from typing import Any, Optional

from flask import current_app
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset.subjects.models import Subject
from superset.views.base import BaseFilter


def subject_type_filter(entity_config_key: str | None = None) -> type[BaseFilter]:
    """Return a BaseFilter subclass scoped to a specific entity config.

    The effective allowed types = intersection of the global
    ``SUBJECTS_RELATED_TYPES`` and the per-entity config key (if set).
    When both are ``None``, no filtering is applied.
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

            if global_types is not None and entity_types is not None:
                allowed = set(global_types) & set(entity_types)
            elif global_types is not None:
                allowed = set(global_types)
            elif entity_types is not None:
                allowed = set(entity_types)
            else:
                return query

            return query.filter(Subject.type.in_(allowed))

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
            return query.filter(Subject.type.in_(allowed_types))
        return query


class FilterRelatedSubjects(BaseFilter):
    """ILIKE search on subject label and extra_search.

    Applied as related_field_filters for the async select search.
    """

    name = _("Subject")
    arg_name = "subjects"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if value:
            ilike_value = f"%{value}%"
            return query.filter(
                or_(
                    Subject.label.ilike(ilike_value),
                    Subject.extra_search.ilike(ilike_value),
                )
            )
        return query
