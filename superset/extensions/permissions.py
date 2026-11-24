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
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

logger = logging.getLogger(__name__)

_extension_resources: set[str] = set()

#: The recorded set as this process last read it, or ``None`` before it has.
#:
#: Read once rather than per question. ``is_extension_resource`` is asked
#: about every permission in the database -- ``sync_role_definitions`` walks
#: all of them -- and the answer comes from a transactional read, so asking
#: each time would turn one role sync into hundreds of them.
_persisted_cache: set[str] | None = None


@contextmanager
def _isolated() -> Iterator[None]:
    """Run a metadata-database access so a failure cannot poison the caller.

    Both accesses here are best effort, and both can run inside a
    transaction somebody else owns: ``superset init`` is itself
    ``@transaction()``, and role sync asks ``is_extension_resource`` about
    every permission from inside it.

    ``superset.utils.decorators.transaction`` only rolls back a transaction
    it opened itself -- a nested call sees ``g.in_transaction`` and runs the
    body bare -- so catching a failed statement here is not enough to undo
    it. The session is left dirty, and on PostgreSQL the enclosing
    transaction is aborted: every later statement in the init run, its final
    commit included, then fails with ``InFailedSqlTransaction``. Degrading
    instead of raising is the property these reads exist to have, and
    swallowing the exception alone did not deliver it.

    So the statement runs inside a SAVEPOINT, and a failure rolls back to it
    and leaves the enclosing transaction usable. Note ``begin_nested``
    flushes pending work before opening the savepoint, so a failure in the
    caller's *own* pending writes still surfaces -- that is its transaction
    failing, not this one.
    """
    from superset import db  # noqa: PLC0415

    with db.session.begin_nested():
        yield


def _persisted() -> set[str]:
    """The resources recorded by any earlier process, or an empty set.

    Best effort. This is read while role sync decides what to grant, and a
    metadata database that cannot be reached must not take ``superset init``
    down with it -- so a failure degrades to the names this process knows,
    which is where this started.
    """
    global _persisted_cache  # pylint: disable=global-statement
    if _persisted_cache is not None:
        return _persisted_cache
    try:
        from superset.key_value.shared_entries import (  # noqa: PLC0415
            get_shared_value,
        )
        from superset.key_value.types import SharedKey  # noqa: PLC0415

        with _isolated():
            stored: Any = get_shared_value(SharedKey.EXTENSION_RESOURCES)
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        logger.debug("extensions: could not read recorded resources", exc_info=True)
        # Not cached: a store that was unreachable once may be reachable by
        # the time the next question is asked, and caching the failure would
        # make one bad moment permanent for the life of the process.
        return set()
    _persisted_cache = set(stored) if isinstance(stored, list) else set()
    return _persisted_cache


def _persist(resources: set[str]) -> None:
    """Add ``resources`` to the recorded set, so a later process can read it.

    Best effort for the same reason: an extension registering before the
    metadata database is reachable, or inside a test app with no tables,
    must still install.

    Merged against a fresh read rather than written from what this process
    happens to hold, because the entry is shared by every process pointed at
    this metadata database. Two booting concurrently -- a rolling deploy, or
    one deployment's workers starting beside another's -- would otherwise
    each write their own names over the other's, and whichever wrote last
    would drop the other's resource from the record. A later ``superset
    init`` that loaded no extension would then not recognise the dropped
    name and hand its permissions to the stock roles, which is the widening
    this module exists to prevent.

    Narrowed to a single statement pair rather than closed: the read takes no
    row lock, so two writers can still interleave inside the savepoint. What
    makes that recoverable is that the write is retried on every
    registration, so any later process that loads the extension puts a
    dropped name back.
    """
    try:
        from superset.key_value.shared_entries import (  # noqa: PLC0415
            get_shared_value,
            upsert_shared_value,
        )
        from superset.key_value.types import SharedKey  # noqa: PLC0415

        with _isolated():
            stored: Any = get_shared_value(SharedKey.EXTENSION_RESOURCES)
            merged = resources | (set(stored) if isinstance(stored, list) else set())
            upsert_shared_value(SharedKey.EXTENSION_RESOURCES, sorted(merged))
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        logger.debug("extensions: could not record resources durably", exc_info=True)
        return
    global _persisted_cache  # pylint: disable=global-statement
    _persisted_cache = merged


def register_extension_resource(resource: str) -> None:
    """Record that ``resource`` is an extension's FAB view menu.

    Called as the extension's API class is registered, with the name FAB
    stores as the view menu -- the class's ``class_permission_name``.

    Recorded twice: in this process, and in the metadata database. The second
    is what makes the classification survive a ``superset init`` run where no
    extension loaded -- a feature flag turned off, discovery failing, an
    entrypoint raising, or an extension uninstalled while its permissions
    remain. Without it that run does not recognise the resource and the
    denylist hands every permission on it to the stock Gamma and Alpha roles,
    which is the quiet widening this module exists to prevent.
    """
    if resource not in _extension_resources:
        _extension_resources.add(resource)
        logger.info("extensions: %r recorded as an extension resource", resource)
    # Attempted whenever the durable record does not already hold the name,
    # and not only the first time this process sees it. The write is best
    # effort, and returning early on the in-process set meant a write that
    # failed -- a metadata database briefly unreachable, or not yet migrated
    # -- was never attempted again. The in-process record does not survive
    # the run this is for: a `superset init` where no extension loaded reads
    # the durable one, and without the name there the denylist hands every
    # permission on the resource to the stock Gamma and Alpha roles.
    if resource not in (persisted := _persisted()):
        _persist(persisted | _extension_resources)


def is_extension_resource(resource: str) -> bool:
    """Whether an extension registered this FAB view menu.

    Says only that an extension claimed the name. Whether the *host* also
    claims it is a separate question, answered against the app's registered
    views in ``SupersetSecurityManager._host_claims_resource`` -- an
    extension naming ``Dashboard`` must not make the host's ``Dashboard``
    admin-only, and SIP-235 explicitly allows an extension to reuse a host
    permission.
    """
    return resource in _extension_resources or resource in _persisted()


def clear_extension_resources() -> None:
    """Forget every recorded resource. For tests, which share a process.

    The stored set itself is not touched -- it belongs to a deployment, and a
    test clearing it would be reaching outside its own app -- but the cached
    copy of it is, so the next question reads afresh.
    """
    global _persisted_cache  # pylint: disable=global-statement
    _extension_resources.clear()
    _persisted_cache = None
