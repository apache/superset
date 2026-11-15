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
Content Security Policy sources that an extension needs on Superset's pages.

Superset sends its pages with a Content Security Policy (CSP) when the host
sets one, as it does by default through Talisman, and a page loads nothing
from another site that its policy doesn't allow. An extension that shows
something from another site, such as a frame from a sandbox domain, declares
the sources it needs with ``add_csp_sources``, and the host adds exactly those
to the policy it sends.

Extensions may add sources only to the directives in ``CSP_DIRECTIVES``, and
only sources that name a site: an origin with its scheme, whose host may
start with ``*.`` (``csp_source_problem`` says why any other is refused).
These rules catch a declaration that would open the host's pages to every
site, such as ``*`` or ``https:``. They are not a boundary against the
extension itself, whose code runs in the host's process.

Usage:
    from superset_core.extensions.csp import add_csp_sources

    add_csp_sources(lambda: {"frame-src": ["https://*.sandbox.example"]})
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping, Sequence

#: What an extension declares: source expressions by directive name.
CspSources = Mapping[str, Sequence[str]]

#: The directives that extensions may add sources to.
CSP_DIRECTIVES: frozenset[str] = frozenset(
    {"connect-src", "font-src", "frame-src", "img-src", "media-src", "style-src"}
)

#: The schemes that a source may name.
CSP_SOURCE_SCHEMES: frozenset[str] = frozenset({"http", "https", "ws", "wss"})

# The CSP grammar's host-source, with its scheme required, a host other than
# "*", and no path past the origin.
_SITE_SOURCE = re.compile(
    r"(?P<scheme>[a-z][a-z0-9+.-]*)://"
    r"(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*"
    r"(?::(?:[0-9]{1,5}|\*))?/?",
    re.IGNORECASE,
)


def csp_source_problem(directive: str, source: str) -> str | None:
    """
    Why the host won't add ``source`` to ``directive``, or ``None`` if it will.

    A source the host adds names one site, with its scheme, such as
    ``https://sandbox.example``, ``https://*.sandbox.example`` or
    ``http://localhost:9001``. The host refuses ``*``, a bare scheme such as
    ``https:``, keywords such as ``'self'`` or ``'unsafe-inline'``, nonces,
    hashes and paths, and any directive outside ``CSP_DIRECTIVES``.
    """
    if directive not in CSP_DIRECTIVES:
        return "extensions add sources only to " + ", ".join(sorted(CSP_DIRECTIVES))
    if not isinstance(source, str):
        return "a source is a string"
    match = _SITE_SOURCE.fullmatch(source)
    if match is None:
        return (
            "a source names one site, with its scheme, such as "
            "https://sandbox.example or https://*.sandbox.example; not *, a "
            "bare scheme, a keyword, a nonce, a hash or a path"
        )
    if match["scheme"].lower() not in CSP_SOURCE_SCHEMES:
        return "a source's scheme is one of " + ", ".join(sorted(CSP_SOURCE_SCHEMES))
    return None


def add_csp_sources(sources: Callable[[], CspSources]) -> None:
    """
    Add the sources that ``sources`` returns to the CSP of the host's pages.

    The host calls ``sources`` for each response it sends a policy with, so
    that the answer can follow what changes while the process runs, such as
    a provider registered after startup; an empty mapping adds nothing.

    Each source joins its directive in the policy, unless it's there already.
    A directive that the policy leaves to a fallback, such as ``frame-src`` to
    ``default-src``, starts from the fallback's sources, so that nothing the
    policy allowed before is lost. The host leaves out, and logs, each source
    that ``csp_source_problem`` refuses, and everything from a call that
    raises. While the host sends no policy, it adds nothing.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param sources: Returns source expressions by directive name, for example
        ``{"frame-src": ["https://*.sandbox.example"]}``.
    :raises NotImplementedError: If called before the host implementation is
        initialized.
    """
    raise NotImplementedError(
        "add_csp_sources not initialized. "
        "This function should be replaced during Superset startup."
    )
