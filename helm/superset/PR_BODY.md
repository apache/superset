# PR Title

```
feat(helm): Chart 2.0 refactor and configuration fixes
```

---

# PR Body

### SUMMARY

This PR updates the Superset Helm chart to **0.16.0** with new capabilities, security and operational improvements, and configuration fixes.

**New features and integrations:**
- **Security hardening** – Secure defaults: non-root user (1000), Pod Security Standards compliant security contexts, no default passwords
- **Gateway API** – HTTPRoute template (alternative to Ingress)
- **Observability** – ServiceMonitor (Prometheus Operator) and VPA (Vertical Pod Autoscaler)
- **Autoscaling** – KEDA ScaledObject for Celery workers
- **Security & validation** – NetworkPolicy template, pre-install validation job, dedicated upgrade job for DB migrations
- **Optional dependencies** – Configurable optional pip/uv dependency groups in values and config generation
- **Secret management** – Improved documentation for using existing secrets (works with ESO, Sealed Secrets, Vault, etc.)

**Chart and template improvements:**
- **Labels** – Standardized to Kubernetes recommended labels (`app.kubernetes.io/*`); legacy selectors kept for backward compatibility
- **Helpers** – Refactored `_helpers.tpl` with default init containers, deprecation checks, and component labels
- **Values** – Expanded `values.yaml` with new options and documentation; migration guide in `UPGRADING.md` (0.15.x → 0.16.x)
- **Chart tests** – New tests for deployment, security, secrets, features, labels, pods, RBAC, and deprecation

**Fixes and corrections:**
- **WebSockets** – Ingress and NetworkPolicy adjusted for WebSocket service
- **JWT / cookies** – Correct JWT and cookie configuration in helpers and templates
- **Async queries** – Correct Redis DB reference for async queries in values and helpers; README updated

App version remains 6.0.0. Backward compatibility is preserved and documented in `UPGRADING.md` and `REFACTORING.md`.

### BEFORE/AFTER SCREENSHOTS OR ANIMATED GIF

N/A – Helm chart and template changes only.

### TESTING INSTRUCTIONS

1. **Lint and template check**
   ```bash
   cd helm/superset
   helm lint .
   helm template test . --debug 2>&1 | head -100
   ```

2. **Run chart tests (if available)**
   ```bash
   helm unittest .  # if installed
   ct lint --chart-dir .  # chart-testing
   ```

3. **Install from branch**
   ```bash
   helm install my-superset ./helm/superset -f my-values.yaml --set init.adminUser.password=admin
   ```
   Confirm all main components (web, worker, beat, optional flower/ws) deploy and pods become Ready.

4. **Upgrade from 0.15.x (optional)**
   - Install a 0.15.x chart, then upgrade using this chart and a values set that matches your previous overrides.
   - Confirm no unexpected resource changes and that Superset and Celery still work (login, run a query, trigger a report).

5. **Verify optional features**
   - If using Gateway API: set `gateway.enabled: true` and confirm HTTPRoute is created.
   - If using KEDA for workers: set `supersetWorker.keda.enabled: true` and confirm ScaledObject is created.

### ADDITIONAL INFORMATION

- [ ] Has associated issue:
- [ ] Required feature flags:
- [ ] Changes UI
- [ ] Includes DB Migration (follow approval process in [SIP-59](https://github.com/apache/superset/issues/13351))
  - [ ] Migration is atomic, supports rollback & is backwards-compatible
  - [ ] Confirm DB migration upgrade and downgrade tested
  - [ ] Runtime estimates and downtime expectations provided
- [x] Introduces new feature or API (new chart options, Gateway API, KEDA, VPA, ServiceMonitor, etc.)
- [ ] Removes existing feature or API
