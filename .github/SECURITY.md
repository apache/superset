# Security Policy

This is a project of the [Apache Software Foundation](https://apache.org) and follows the
ASF [vulnerability handling process](https://apache.org/security/#vulnerability-handling).

## Reporting Vulnerabilities

**⚠️ Please do not file GitHub issues for security vulnerabilities as they are public! ⚠️**


Apache Software Foundation takes a rigorous standpoint in annihilating the security issues
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

**Out of Scope Vulnerabilities**

To prioritize engineering efforts on genuine architectural risks, the following scenarios are explicitly out of scope and will not be issued a CVE:
- Attacks requiring Admin privileges: (e.g., CSS injection, template manipulation, dashboard ownership overrides, or modifying global system settings). Per the CVE vulnerability definition in CNA Operational Rules 4.1, a qualifying vulnerability must allow violation of a security policy. The Admin role is a fully trusted operational boundary defined by Apache Superset's security policy; actions within this boundary do not violate that policy and are therefore considered intended capabilities 'by design,' not vulnerabilities.
- Brute Force and Rate Limiting: Reports targeting a lack of resource exhaustion protections, generic rate-limiting, or volumetric Denial of Service (DoS) attempts.
- Theoretical attack vectors: Issues without a demonstrable, reproducible exploit path.
- Non-Exploitable Findings: Missing security headers, generic banner disclosures, or descriptive error messages that do not lead to a direct, documented exploit.

**Outcome of Reports**

Reports that are deemed out-of-scope for a CVE but represent valid security best practices or hardening opportunities may be converted into public GitHub issues. This allows the community to contribute to the general hardening of the platform even when a specific vulnerability threshold is not met.

Note that Apache Superset is not responsible for any third-party dependencies that may
have security issues. Any vulnerabilities found in third-party dependencies should be
reported to the maintainers of those projects. Results from security scans of Apache
Superset dependencies found on its official Docker image can be remediated at release time
by extending the image itself.

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
