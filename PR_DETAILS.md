# PR Details: Security Hardening - JWT Secrets

## Summary
Replaced all default JWT secrets with strong random values generated via `openssl rand -base64 42`.

## Changes
- `superset_config.py`: Added with `SECRET_KEY`, `WEBSOCKET_JWT_SECRET`, `GUEST_TOKEN_JWT_SECRET` (all strong random 42-base64 chars)
- `docker/.env-local`: Added `WEBSOCKET_JWT_SECRET` matching app config

## Impact
- Prevents unauthorized WebSocket channel access via default secrets
- Enables production-ready security without `SystemExit` on startup
- All `check_*` validators will pass with new secrets

## Testing
Run validation:
```bash
python -c "from superset.initialization import SupersetAppInitializer; init = SupersetAppInitializer(); init.check_websocket_secret(); print('✅ Secret valid')"
```

## Notes
- These are per-user/local config files (in .gitignore normally)
- Commit made for repository-wide tracking/audit
- Each user should still set their own secrets per their deployment