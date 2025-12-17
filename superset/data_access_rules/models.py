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
"""
Data Access Rules models.

This module defines the DataAccessRule model for storing access rules
as JSON documents associated with roles.

Example rule document structure:
{
    "allowed": [
        {
            "database": "sales",
            "schema": "orders",
            "table": "ord_main"
        },
        {
            "database": "logs",
            "catalog": "public"
        },
        {
            "database": "sales",
            "schema": "orders",
            "table": "prices",
            "rls": {
                "predicate": "org = 495",
                "group_key": "org_filter"
            }
        },
        {
            "database": "sales",
            "schema": "orders",
            "table": "user_info",
            "cls": {
                "name": "mask",
                "age": "nullify",
                "email": "hash",
                "lastname": "hide"
            }
        }
    ],
    "denied": [
        {
            "database": "logs",
            "catalog": "public",
            "schema": "pii"
        }
    ]
}
"""

from __future__ import annotations

from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable


class DataAccessRule(Model, AuditMixinNullable):
    """
    Data access rule associated with a role.

    Each rule is a JSON document that describes what databases, catalogs,
    schemas, and tables a role can access, along with optional RLS predicates
    and CLS column restrictions.
    """

    __tablename__ = "data_access_rules"

    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("ab_role.id"), nullable=False)
    rule = Column(Text, nullable=False)

    role = relationship(
        security_manager.role_model,
        backref="data_access_rules",
        foreign_keys=[role_id],
    )

    def __repr__(self) -> str:
        return f"<DataAccessRule(id={self.id}, role_id={self.role_id})>"

    @property
    def rule_dict(self) -> dict[str, Any]:
        """Parse the rule JSON string into a dictionary."""
        import json

        try:
            return json.loads(self.rule) if self.rule else {}
        except json.JSONDecodeError:
            return {}

    @rule_dict.setter
    def rule_dict(self, value: dict[str, Any]) -> None:
        """Serialize a dictionary to JSON for storage."""
        import json

        self.rule = json.dumps(value)
