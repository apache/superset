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
"""Validation shared by the canvas create and update commands."""

from __future__ import annotations

from typing import Any

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset import db
from superset.daos.canvas import CanvasDAO
from superset.models.core import Theme


def validate_metadata(
    properties: dict[str, Any],
    exceptions: list[ValidationError],
    canvas_id: int | None = None,
) -> None:
    """Check the slug is free and the theme exists."""
    if (slug := properties.get("slug")) and CanvasDAO.slug_in_use(slug, canvas_id):
        exceptions.append(ValidationError(_("Must be unique"), field_name="slug"))
    theme_id = properties.get("theme_id")
    if theme_id is not None and db.session.get(Theme, theme_id) is None:
        exceptions.append(
            ValidationError(_("Theme does not exist"), field_name="theme_id")
        )
