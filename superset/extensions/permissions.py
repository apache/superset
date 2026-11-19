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
"""Which FAB resources belong to an extension rather than to the host.

``SupersetSecurityManager._is_gamma_pvm`` is a *denylist*: it recognises the
host's own resources and hands anything it does not recognise to stock Gamma
and Alpha on the next ``superset init``. An extension's resources are, by
construction, things the host has never heard of -- so every permission an
extension registers was granted to Gamma and Alpha the first time an operator
ran init. For a page gated on one of them,
"restricted" lasted until the next role sync.

This is a property of extension permissions in general and not of pages, so
it is fixed once here rather than per contribution. A resource registered
while an extension context is active -- the decorators know, ``context is not
None`` in ``api_impl`` -- is recorded, and role sync classifies its
permissions as admin-only.

Only ``@api`` needs covering. ``@tool`` creates no view menu of its own --
it calls ``security_manager.can_access`` against a permission that already
exists -- so there is nothing for role sync to hand to anybody. A tool
naming a permission the host does not recognise is refused to everyone,
which fails closed; one naming an ``@api`` class's resource is covered
because that resource is recorded here.

A fresh extension permission therefore goes to Admin alone until an operator
grants it to a role of their own.

Custom roles are untouched, because role sync only rebuilds the built-in
roles. A deployment where Gamma or Alpha already holds an extension
permission loses it on the next init; that is called out in ``UPDATING.md``.

Default-deny, and recorded rather than declared: an extension does not have
to remember to ask, and the host does not have to be taught each extension's
resources. An extension that wants a permission to reach everyone in a
workflow grants it to a role of its own, which role sync leaves alone.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_extension_resources: set[str] = set()


def register_extension_resource(resource: str) -> None:
    """Record that ``resource`` is an extension's FAB view menu.

    Called as the extension's API class is registered, with the name FAB
    stores as the view menu -- the class's ``class_permission_name``.
    """
    _extension_resources.add(resource)
    logger.info("extensions: %r recorded as an extension resource", resource)


def is_extension_resource(resource: str) -> bool:
    """Whether an extension registered this FAB view menu.

    Says only that an extension claimed the name. Whether the *host* also
    claims it is a separate question, answered against the app's registered
    views in ``SupersetSecurityManager._host_claims_resource`` -- an
    extension naming ``Dashboard`` must not make the host's ``Dashboard``
    admin-only, and SIP-235 explicitly allows an extension to reuse a host
    permission.
    """
    return resource in _extension_resources


def clear_extension_resources() -> None:
    """Forget every recorded resource. For tests, which share a process."""
    _extension_resources.clear()
