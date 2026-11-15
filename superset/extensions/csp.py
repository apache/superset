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
The host's side of the CSP sources that extensions declare
(``superset_core.extensions.csp``).

Talisman takes its policy from ``TALISMAN_CONFIG`` when the app starts,
before any extension loads, and the sources an extension declares can change
while the process runs (a provider's sandbox site, say). So the declared
sources are merged into each response's policy after Talisman has set it,
rather than into Talisman's configuration: ``init_app`` hooks
``merge_declared_sources`` into the app. With nothing declared, every response
keeps the policy that Talisman set, byte for byte.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache

from flask import Flask, Response
from superset_core.extensions.csp import csp_source_problem, CspSources

from superset.extensions.context import get_current_extension_context

logger = logging.getLogger(__name__)

#: The headers a policy is sent in; Talisman's report-only mode uses the second.
CSP_HEADERS = ("Content-Security-Policy", "Content-Security-Policy-Report-Only")

# For each directive that extensions may add sources to, where a browser looks
# when the policy leaves it out, in order (CSP Level 3, "directive fallback
# list").
DIRECTIVE_FALLBACKS: Mapping[str, tuple[str, ...]] = {
    "connect-src": ("default-src",),
    "font-src": ("default-src",),
    "frame-src": ("child-src", "default-src"),
    "img-src": ("default-src",),
    "media-src": ("default-src",),
    "style-src": ("default-src",),
}


@dataclass(frozen=True)
class _Declaration:
    owner: str
    sources: Callable[[], CspSources]


_lock = threading.Lock()
_declarations: list[_Declaration] = []


def add_csp_sources(sources: Callable[[], CspSources]) -> None:
    """
    The host's ``superset_core.extensions.csp.add_csp_sources``.

    Keeps ``sources`` with the id of the extension that declares it, for the
    logs; ``declared_csp_sources`` calls it.
    """
    if not callable(sources):
        raise TypeError(
            "add_csp_sources takes a function that returns the sources, "
            f"not {type(sources).__name__}"
        )
    context = get_current_extension_context()
    owner = f"extension {context.extension.id}" if context else "the host"
    with _lock:
        _declarations.append(_Declaration(owner, sources))


def clear_csp_sources() -> None:
    """Forget every declaration, as in a process that declared none."""
    with _lock:
        _declarations.clear()


# The caches below log each problem once, rather than on every response.


@lru_cache(maxsize=256)
def _refuse(owner: str, directive: str, source: str, problem: str) -> None:
    """Log a refused source."""
    logger.warning(
        "CSP: not adding %s to %s for %s: %s", source, directive, owner, problem
    )


@lru_cache(maxsize=256)
def _report_failure(owner: str, error: str) -> None:
    """Log, with its traceback, the error that a declaration raised."""
    logger.exception(
        "CSP: the sources of %s failed (%s), so none of them are added", owner, error
    )


def declared_csp_sources() -> dict[str, list[str]]:
    """
    What every declaration answers when called: valid sources by directive,
    in the order declared, without duplicates.
    """
    with _lock:
        declarations = tuple(_declarations)
    merged: dict[str, list[str]] = {}
    for declaration in declarations:
        try:
            answer = declaration.sources()
        except Exception as ex:  # pylint: disable=broad-except
            _report_failure(declaration.owner, repr(ex))
            continue
        if not isinstance(answer, Mapping):
            _refuse(declaration.owner, "any directive", repr(answer), "not a mapping")
            continue
        for directive, sources in answer.items():
            if isinstance(sources, str) or not isinstance(sources, Iterable):
                _refuse(
                    declaration.owner,
                    repr(directive),
                    repr(sources),
                    "a directive's sources come as a list",
                )
                continue
            for source in sources:
                if problem := csp_source_problem(directive, source):
                    _refuse(declaration.owner, repr(directive), repr(source), problem)
                    continue
                listed = merged.setdefault(directive, [])
                if source.lower() not in {known.lower() for known in listed}:
                    listed.append(source)
    return merged


def _with_sources(current: list[str], sources: Sequence[str]) -> list[str]:
    """``current`` plus each of ``sources`` it lacks; they replace a ``'none'``."""
    known = {source.lower() for source in current}
    added = []
    for source in sources:
        if source.lower() not in known:
            known.add(source.lower())
            added.append(source)
    if not added:
        return current
    return [source for source in current if source.lower() != "'none'"] + added


def _merge_into_one(policy: str, additions: Mapping[str, Sequence[str]]) -> str:
    directives = [part.strip() for part in policy.split(";") if part.strip()]
    names = [directive.split(None, 1)[0].lower() for directive in directives]
    changed = False
    for name, sources in additions.items():
        if name in names:
            # A browser reads a directive's first occurrence only.
            index = names.index(name)
            written, *current = directives[index].split()
            updated = _with_sources(current, sources)
            if updated != current:
                directives[index] = " ".join([written, *updated])
                changed = True
            continue
        fallback = next(
            (known for known in DIRECTIVE_FALLBACKS.get(name, ()) if known in names),
            None,
        )
        if fallback is None:
            # Nothing restricts this directive, so it allows the sources already.
            continue
        inherited = directives[names.index(fallback)].split()[1:]
        directives.append(" ".join([name, *_with_sources(inherited, sources)]))
        names.append(name)
        changed = True
    return "; ".join(directives) if changed else policy


def merge_policy(policy: str, additions: Mapping[str, Sequence[str]]) -> str:
    """
    ``policy`` with the sources of ``additions`` merged in, by directive.

    A source joins its directive unless the directive lists it already,
    ignoring case, and replaces a ``'none'`` there. A directive the policy
    leaves out starts from the sources of the fallback a browser would use
    instead, so that nothing the fallback allowed is lost; with no fallback
    either, nothing restricts that directive, and it stays out. Each of the
    policies in a header, separated by commas, gets the sources, since a
    browser enforces each one. Answers ``policy`` itself when it allows every
    source already.
    """
    policies = policy.split(",")
    merged = [_merge_into_one(part, additions) for part in policies]
    if merged == policies:
        return policy
    return ", ".join(part.strip() for part in merged)


def merge_declared_sources(response: Response) -> Response:
    """Merge the declared sources into each policy that ``response`` carries."""
    if not any(header in response.headers for header in CSP_HEADERS):
        return response
    additions = declared_csp_sources()
    if not additions:
        return response
    for header in CSP_HEADERS:
        if policy := response.headers.get(header):
            response.headers[header] = merge_policy(policy, additions)
    return response


def init_app(app: Flask) -> None:
    """
    Merge the declared sources into the policy of every response ``app`` sends.

    Call it before Talisman's ``init_app``: Flask runs the ``after_request``
    functions of an app in the reverse of the order they were registered in,
    so this one then runs after Talisman has set the policy.
    """
    app.after_request(merge_declared_sources)
