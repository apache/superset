## Summary

The Flask flash message system is a legacy feature from when Superset was a server-rendered application. In the current SPA architecture, these messages are never displayed to users because:
- Flash messages only render on page load via FlashProvider's componentDidMount
- Modern UI interactions use async API calls that don't trigger page reloads
- The main consumer (/explore/ POST endpoint) is already marked @deprecated

All user-facing notifications are already handled by the frontend toast system, including chart save operations (see saveModalActions.ts) which dispatches success toasts for:
- Chart saved/overwritten
- Chart added to dashboard
- New dashboard created with chart

## Changes

### Backend
- Removed all flash() calls from views (14 occurrences in 4 files)
- Converted error flashes to JSON responses or logging
- Removed redirect_with_flash utility function
- Fixed open redirect vulnerability in dashboard access denial

### Frontend
- Deleted FlashProvider component and tests
- Removed flash_messages from CommonBootstrapData type
- Cleaned up context providers and test fixtures
- Removed unused getBootstrapData imports

### Security Fixes
- Fixed open redirect vulnerability by using url_for() instead of request.url
- Dashboard access denial now uses safe URL construction

### Code Cleanup
- Removed unnecessary pass statements and comments
- Converted permalink errors to JSON responses for consistency
- Verified no tests depend on flash functionality

## BREAKING CHANGE
Removes flask.flash() messaging infrastructure. However, no actual functionality is lost as the frontend already handles all notifications through its own toast system.

## TESTING INSTRUCTIONS
1. Save a chart from Explore - verify toast notifications appear
2. Add chart to dashboard - verify success message
3. Try accessing a dashboard without permissions - verify proper redirect
4. Run frontend tests: `npm test`
5. Run backend tests: `pytest`

## ADDITIONAL INFORMATION
The application now relies entirely on client-side toast notifications for user feedback, which properly support async operations and provide a consistent UX.

<!--- Required --->
- [x] Has associated issue: Fixes #35236
- [x] Required feature flags: None
- [x] Changes UI: No (removes unused UI component)
- [x] Includes DB Migration: No

<!--- Check any relevant boxes with "x" --->
- [x] Bugfix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [x] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation (typos, code examples, or any documentation update)
