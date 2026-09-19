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
"""Models backing the runtime Content Security Policy (CSP) allowlist."""

from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, UniqueConstraint

from superset.models.helpers import AuditMixinNullable, UUIDMixin

# Default CSP directive a hole is punched into. ``frame-src`` governs which
# origins may be embedded in an <iframe>, which is the primary use case for the
# allowlist (the first-class dashboard iframe component).
DEFAULT_CSP_DIRECTIVE = "frame-src"


class CSPAllowlistEntry(AuditMixinNullable, UUIDMixin, Model):
    """A runtime "punched hole" in the Content Security Policy.

    Each row widens a single CSP directive (``frame-src`` by default) to allow a
    single additional origin. Entries are merged into the response CSP header at
    request time, but only when the ``CSP_RUNTIME_ALLOWLIST`` feature flag is
    enabled, so operators retain full control over whether the static, deploy-time
    policy can be overridden at runtime at all.
    """

    __tablename__ = "csp_allowlist"
    __table_args__ = (
        UniqueConstraint(
            "domain", "directive", name="uq_csp_allowlist_domain_directive"
        ),
    )

    id = Column(Integer, primary_key=True)
    # A bare origin, e.g. ``https://example.com`` or ``https://example.com:8443``.
    # Never a wildcard, path, query or fragment — see ``is_valid_csp_origin``.
    domain = Column(String(255), nullable=False)
    directive = Column(String(64), nullable=False, default=DEFAULT_CSP_DIRECTIVE)
    description = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<CSPAllowlistEntry {self.directive} {self.domain}>"
