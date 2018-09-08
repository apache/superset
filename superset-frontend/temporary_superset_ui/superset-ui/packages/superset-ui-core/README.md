## `@superset-ui/core`

[![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat)

Core modules for Superset:

- `SupersetClient` requests and authentication
- (future) `i18n` locales and translation

### SupersetClient

The `SupersetClient` handles all client-side requests to the Superset backend. It can be configured
for use within the Superset application, or used to issue `CORS` requests in other applications. At
a high-level it supports:

- `CSRF` token authentication
  - queues requests in the case that another request is made before the token is received
  - it checks for a token before every request, an external app that uses this can detect this by
    catching errors, or explicitly checking `SupersetClient.isAuthorized()`
- supports `GET` and `POST` requests (no `PUT` or `DELETE`)
- timeouts
- query aborts through the `AbortController` API

#### Example usage

```javascript
// appSetup.js
import { SupersetClient } from `@superset-ui/core`;
// or import SupersetClient from `@superset-ui/core/lib|esm/SupersetClient`;

SupersetClient.configure(...clientConfig);
SupersetClient.init(); // CSRF auth, can also chain `.configure().init();

// anotherFile.js
import { SupersetClient } from `@superset-ui/core`;

SupersetClient.post(...requestConfig)
  .then(({ request, json }) => ...)
  .catch((error) => ...);
```

#### API

##### Client Configuration

The following flags can be passed in the client config call
`SupersetClient.configure(...clientConfig);`

- `protocol = 'http'`
- `host`
- `headers`
- `credentials = 'same-origin'` (set to `include` for non-Superset apps)
- `mode = 'same-origin'` (set to `cors` for non-Superset apps)
- `timeout`

##### Per-request Configuration

The following flags can be passed on a per-request call `SupersetClient.get/post(...requestConfig);`

- `url` or `endpoint`
- `headers`
- `body`
- `timeout`
- `signal` (for aborting, from `const { signal } = (new AbortController())`)
- for `POST` requests
  - `postPayload` (key values are added to a `new FormData()`)
  - `stringify` whether to call `JSON.stringify` on `postPayload` values

##### Request aborting

Per-request aborting is implemented through the `AbortController` API:

```javascript
import { SupersetClient } from '@superset-ui/core';
import AbortController from 'abortcontroller-polyfill';

const controller = new AbortController();
const { signal } = controller;

SupersetClient.get({ ..., signal }).then(...).catch(...);

if (IWantToCancelForSomeReason) {
  signal.abort(); // Promise is rejected, request `catch` is invoked
}
```

### Development

`@data-ui/build-config` is used to manage the build configuration for this package including babel
builds, jest testing, eslint, and prettier.
