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
"""Helper to populate the reference ``AssetTranslation`` table.

NOT part of Superset core -- see this directory's README. Stands in for a real
authoring surface (an admin UI, CSV import, or Transifex sync). Run inside a
Superset app context, e.g. via ``superset shell``.
"""

from __future__ import annotations


def upsert(
    *,
    model_name: str,
    field_name: str,
    default_text: str,
    language_code: str,
    translated_text: str,
) -> None:
    """Insert or update one translation row."""
    from superset import db

    from .model import AssetTranslation

    row = (
        db.session.query(AssetTranslation)
        .filter_by(
            model_name=model_name,
            field_name=field_name,
            default_text=default_text,
            language_code=language_code,
        )
        .first()
    )
    if row:
        row.translated_text = translated_text
    else:
        db.session.add(
            AssetTranslation(
                model_name=model_name,
                field_name=field_name,
                default_text=default_text,
                language_code=language_code,
                translated_text=translated_text,
            )
        )
    db.session.commit()


def seed_demo() -> None:
    """Populate a few demo translations for manual testing."""
    from .model import create_table

    create_table()
    demo = [
        ("Dashboard", "dashboard_title", "Sales Dashboard", "fr", "Tableau des ventes"),
        ("Dashboard", "dashboard_title", "Sales Dashboard", "mi", "Papatohu Hokohoko"),
        ("Slice", "slice_name", "Sales", "fr", "Ventes"),
        ("Slice", "slice_name", "Sales", "mi", "Hokohoko"),
    ]
    for model_name, field_name, default_text, language_code, translated_text in demo:
        upsert(
            model_name=model_name,
            field_name=field_name,
            default_text=default_text,
            language_code=language_code,
            translated_text=translated_text,
        )
