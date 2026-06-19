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
"""Reference table for storing asset-metadata translations.

NOT part of Superset core -- see this directory's README. A production version
would live in an extension with its own Alembic migration; here we keep a single
declarative model and a helper to create the table on demand.
"""

from __future__ import annotations

from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class AssetTranslation(Base):  # type: ignore[valid-type, misc]
    """A single translation of one asset field into one language.

    Keyed on the source text plus model/field context so identical strings in
    different fields can be translated independently. ``default_text`` is the
    canonical value stored on the asset (e.g. ``Slice.slice_name``).
    """

    __tablename__ = "asset_translations"

    id = Column(Integer, primary_key=True)
    model_name = Column(String(64), nullable=False)
    field_name = Column(String(64), nullable=False)
    default_text = Column(Text, nullable=False)
    language_code = Column(String(16), nullable=False)
    translated_text = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "model_name",
            "field_name",
            "default_text",
            "language_code",
            name="uq_asset_translation",
        ),
    )


def create_table() -> None:
    """Create the table in Superset's metadata database if it does not exist.

    Convenience for the example. A real deployment should manage this with a
    migration instead.
    """
    from superset import db  # local import: only available within the app

    Base.metadata.create_all(bind=db.session.get_bind())
