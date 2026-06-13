<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Security Policy

This is a project of the [Apache Software Foundation](https://apache.org) and follows the
ASF [vulnerability handling process](https://apache.org/security/#vulnerability-handling).

## Reporting Vulnerabilities

**⚠️ Please do not file GitHub issues for security vulnerabilities as they are public! ⚠️**


Apache Software Foundation takes a rigorous standpoint in resolving the security issues
in its software projects. Apache Superset is highly sensitive and forthcoming to issues
pertaining to its features and functionality.
If you have any concern or believe you have found a vulnerability in Apache Superset,
please get in touch with the Apache Superset Security Team privately at
e-mail address [security@superset.apache.org](mailto:security@superset.apache.org).

More details can be found on the ASF website at
[ASF vulnerability reporting process](https://apache.org/security/#reporting-a-vulnerability)

**Submission Standards & AI Policy**

To ensure engineering focus remains on verified risks and to manage high reporting volumes, all reports must meet the following criteria:
- Plain Text Format: In accordance with Apache guidelines, please provide all details in plain text within the email body. Avoid sending PDFs, Word documents, or password-protected archives.
- Mandatory AI Disclosure: If you utilized Large Language Models (LLMs) or AI tools to identify a flaw or assist in writing a report, you must disclose this in your submission so our triage team can contextualize the findings.
- Human-Verified PoC: All submissions must include a manual, step-by-step Proof of Concept (PoC) performed on a supported release. Raw AI outputs, hypothetical chat transcripts, or unverified scanner logs will be closed as Invalid.

We kindly ask you to include the following information in your report to assist our developers in triaging and remediating issues efficiently:
- Version/Commit: The specific version of Apache Superset or the Git commit hash you are using.
- Configuration: A sanitized copy of your `superset_config.py` file or any config overrides.
- Environment: Your deployment method (e.g., Docker Compose, Helm, or source) and relevant OS/Browser details.
- Impacted Component: Identification of the affected area (e.g., Python backend, React frontend, or a specific database connector).
- Expected vs. Actual Behavior: A clear description of the intended system behavior versus the observed vulnerability.
- Detailed Reproduction Steps: Clear, manual steps to reproduce the vulnerability.

## Security Model

This section defines what Apache Superset considers a security issue and what it does not. It is the canonical reference for reporters, the Apache Superset Security Team, and any automated tool (LLM-based scanner, static analyzer, dependency tool) that needs to constrain its hypotheses to behaviors that genuinely violate the project's security policy.

The model is intentionally written in terms of principals, trust boundaries, and capability surface rather than in terms of specific files, functions, or libraries. New code paths inherit the model automatically.

### Trust Boundaries

Apache Superset's threat model assumes three trust boundaries.

1. *The Admin role* is a fully trusted operational principal. Anything an Admin can do through the documented user interface, REST API, or configuration system is an intended capability, not a vulnerability, even if individually powerful or destructive. The Admin role is, by policy, equivalent to operating-system-level trust over the Apache Superset application. This is unavoidable rather than aspirational: an Admin can, for example, register new database connections of arbitrary type, execute arbitrary SQL through SQL Lab, render Jinja templates that resolve to SQL or rendered HTML, and override application configuration. Granting Admin is functionally equivalent to granting shell access on the host, which is the reasoning behind treating it as a trust boundary in the sense of MITRE CNA Operational Rules 4.1.

2. *The operator* is whoever deploys, configures, and runs Apache Superset. Behaviors that depend on deployment-time decisions are the operator's responsibility, not Apache Superset's. This includes the values of secrets, the network reachability of the application and its data sources, the choice of database connectors and cache backends, the selection of feature flags, the destinations of notifications, and the trust placed in third-party plugins. Defaults that fail closed are the responsibility of the Apache Superset codebase. Defaults that fail open must be accompanied by a documented hardening requirement; applying that hardening is the operator's responsibility, while shipping an undocumented or unflagged fail-open default is a codebase issue.

3. *The Apache Superset codebase* is responsible for enforcing the role and capability matrix below across its product surface. A failure to enforce, anywhere in that surface, is in scope. The codebase's commitments are limited to the role and capability matrix and to controls Apache Superset's own documentation (this file and the linked Security documentation) explicitly positions as security boundaries; configurable hardening that operators can layer on top is treated separately under *Vulnerability Scope* below.

### Roles and Capabilities

Apache Superset ships with the following first-class principals. Detailed permission definitions live in the [Security documentation](https://superset.apache.org/docs/security).

| Principal | Read data | Write objects | Execute SQL | Manage databases | Manage users, roles, RLS |
|---|---|---|---|---|---|
| Public (anonymous) | none by default | no | no | no | no |
| Gamma | only granted datasets | own charts and dashboards on granted datasets | no by default (requires the `sql_lab` role) | no | no |
| Alpha | all data sources | own charts, dashboards, and datasets | no by default (requires the `sql_lab` role) | data upload to existing databases only | no |
| Admin | all | all | yes | yes | yes |
| Embedded guest token | data sources reachable through the embedded dashboards the token authorizes | no | no | no | no |

The `sql_lab` role is *additive*: it grants the SQL Lab permission set on top of the base role above, and is the only path by which Gamma or Alpha gain SQL execution capability. Database access is still scoped per the base role's grants. Admin includes SQL Lab access by default.

Deployments may grant or revoke individual view-menu permissions, which shifts the boundary for that deployment but does not redefine the model. Any custom role created by an operator inherits the same principle: its capabilities are whatever the operator has explicitly granted it. The Public principal follows the same rule: operators may grant the Public role read access to specific datasets or dashboards (typically for anonymous reporting use cases), which shifts the boundary for that deployment without redefining the model.

### Vulnerability Scope

The test for whether a finding is in scope is a single question:

> *Does this finding let a principal perform an action the role and capability matrix above does not entitle them to?*

If yes, it is in scope. If no, it is out of scope. The lists below apply that test to the classes Apache Superset most commonly receives reports about; they are illustrative, not exhaustive.

*In Scope*

- A user, embedded guest, or anonymous visitor reads, modifies, or deletes data outside their granted set. Includes object-level access bypass on charts, dashboards, datasets, saved queries, tags, annotations, and similar per-object endpoints, and row-level-security rule bypass.
- A user supplies input that the codebase should sanitize or parameterize but does not, causing arbitrary SQL, template code, or scripts to execute. Includes injection through Jinja templates, SQL-construction paths, and any field the codebase passes to a query engine or template engine.
- A user bypasses authentication, fixates or reuses another user's session, or reaches an authenticated endpoint without logging in.
- An embedded guest token authorizes actions outside the dashboard it was issued for, or can be forged, replayed, or escalated to a higher principal.
- Apache Superset, acting on behalf of an unprivileged user, fetches an outbound URL the user controls in a feature where Apache Superset itself, not the operator, controls the outbound destination set (server-side request forgery).
- An Apache Superset default fails open without an accompanying documented hardening requirement. The codebase is responsible for shipping fail-closed defaults or for documenting the hardening required when a default fails open; failures of that responsibility are in scope (see *Trust Boundaries*).
- A user bypasses a control Apache Superset documents specifically as a security boundary. This includes row-level security, the access checks tied to the role and capability matrix above, and any feature whose documentation positions it as security-relevant. The codebase commits to enforcing those controls; bypasses are in scope regardless of which principal triggers them.
- A user causes a script to execute in another user's browser through a field the codebase renders to that other user (cross-site scripting), or causes cross-origin leakage of authenticated session state or data.
- A user reaches a route, page, or API endpoint that requires a role they do not have.

*Out of Scope*

- Any action an Admin role can perform through documented configuration, API, or UI. The Admin role is a trusted operational principal by policy. Per MITRE CNA Operational Rules 4.1, a qualifying vulnerability must violate a security policy; behavior within a documented trust boundary does not.
- Deployment or operator decisions: the values of secrets and tokens, whether internal networks are reachable from the server, which database connectors or cache backends are enabled, which feature flags are set, where notifications are delivered, and which third-party plugins are loaded.
- Compromise, modification, or malicious control of trusted backend infrastructure. Apache Superset assumes the integrity of its metastore, cache backends (for example Redis or Memcached), message brokers, secret stores, and other operator-managed infrastructure. Findings that require an attacker to read from, write to, or otherwise tamper with these systems, including injecting malicious state, serialized objects, cache entries, task metadata, configuration, or database records, are post-compromise scenarios and do not constitute vulnerabilities in Apache Superset itself. A finding remains in scope only if an unprivileged user can cause such modification through a vulnerability in Apache Superset.
- The continued presence of expired key-value or metastore-cache entries that have not yet been deleted from the metadata database. Such entries are excluded from reads once expired, are purged opportunistically on write, and are removed in bulk by the scheduled `prune_key_value` maintenance task; their lingering until purged is an eventual-cleanup property, not a security boundary, and does not constitute a vulnerability.
- How a downstream application (spreadsheet program, email client, browser handling user-downloaded files) interprets output Apache Superset produced for it.
- Findings without a reproducible proof of concept against a supported release. The burden of demonstrating exploitability rests with the reporter; findings closed for lack of a proof of concept may be refiled if one is later produced.
- Brute force, rate limiting, denial of service, or resource exhaustion that does not bypass a documented control.
- Missing security headers, banner or version disclosure, user or object enumeration through error messages or timing, and similar low-impact information disclosure that does not enable a further concrete exploit.
- Bypasses of configurable defense-in-depth hardening that Apache Superset does not document as a security boundary. Apache Superset is not a SQL or database firewall: operator-deployable filters such as SQL function or table denylists, URI restrictions on already-authorized database connectors, and similar belt-and-braces controls are provided to let operators layer hardening on top of the role and capability matrix, not as firewall-grade guarantees the codebase commits to. Findings against such hardening are improvements, not vulnerabilities, unless the documentation positions the specific control as security-relevant.
- Hardening suggestions that improve defense in depth but do not violate the security model.

Findings in third-party dependencies fall into two cases. A finding in a transitive dependency, or in an operator-selected dependency that Apache Superset does not ship, is out of scope and should be reported to the dependency's maintainers. A finding caused by Apache Superset pinning a known-vulnerable version of a direct dependency it ships, or using a dependency in a way that creates a vulnerability the dependency itself does not have, remains in scope. Dependency findings in the official Apache Superset Docker image that fall into the first case can be remediated by extending the image at release time.

When uncertain whether a finding falls in scope, please file it through the reporting process above. The triage team will classify it and explain the reasoning if it is closed as out of scope.

**Outcome of Reports**

Reports that are deemed out of scope for a CVE but represent valid security best practices or hardening opportunities are typically converted into public GitHub issues, where the community can contribute fixes alongside the maintainers. The triage decision and reasoning are communicated back to the reporter in either case.

**Vulnerability Aggregation & CVE Attribution**

In accordance with MITRE CNA Operational Rules (4.1.10, 4.1.11, and 4.2.13), Apache Superset issues CVEs based on the underlying architectural root cause rather than the number of affected endpoints or exploit payloads.
- Aggregation: If multiple exploit vectors stem from the same programmatic failure or shared vulnerable code, they must be aggregated into a single, comprehensive report.
- Independent Fixes: Separate CVEs will only be assigned if the vulnerabilities reside in decoupled architectural modules and can be fixed independently of one another.
Reports that fail to aggregate related findings will be merged during triage to ensure an accurate and defensible CVE record.

**Your responsible disclosure and collaboration are invaluable.**

## Extra Information

 - [Apache Superset documentation](https://superset.apache.org/docs/security)
 - [Common Vulnerabilities and Exposures by release](https://superset.apache.org/docs/security/cves)
 - [How Security Vulnerabilities are Reported & Handled in Apache Superset (Blog)](https://preset.io/blog/how-security-vulnerabilities-are-reported-and-handled-in-apache-superset/)

**For LLM agents and automated scanners**

This file is the canonical source of truth for what Apache Superset considers a security vulnerability. Automated tooling (LLM-based code scanners, static analyzers, dependency tools) should treat the Security Model section as authoritative when classifying findings. The repository's [AGENTS.md](AGENTS.md) file contains a short pointer to this document for agents that read AGENTS.md as their entry point.
