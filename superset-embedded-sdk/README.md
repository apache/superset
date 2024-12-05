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

[![Version](https://img.shields.io/npm/v/%40superset-ui%2Fembedded-sdk?style=flat)](https://www.npmjs.com/package/@superset-ui/embedded-sdk)
[![Libraries.io](https://img.shields.io/librariesio/release/npm/%40superset-ui%2Fembedded-sdk?style=flat)](https://libraries.io/npm/@superset-ui%2Fembedded-sdk)

# Superset Embedded SDK

The Embedded SDK allows you to embed dashboards from Superset into your own app,
using your app's authentication.

Embedding is done by inserting an iframe, containing a Superset page, into the host application.

## Prerequisites

* Activate the feature flag `EMBEDDED_SUPERSET`
* Set a strong password in configuration variable `GUEST_TOKEN_JWT_SECRET` (see configuration file config.py). Be aware that its default value must be changed in production.

## Embedding a Dashboard

Using npm:

```sh
npm install --save @superset-ui/embedded-sdk
```

```js
import { embedDashboard } from "@superset-ui/embedded-sdk";

embedDashboard({
  id: "abc123", // given by the Superset embedding UI
  supersetDomain: "https://superset.example.com",
  mountPoint: document.getElementById("my-superset-container"), // any html element that can contain an iframe
  fetchGuestToken: () => fetchGuestTokenFromBackend(),
  dashboardUiConfig: { // dashboard UI config: hideTitle, hideTab, hideChartControls, filters.visible, filters.expanded (optional), urlParams (optional)
      hideTitle: true,
      filters: {
          expanded: true,
      },
      urlParams: {
          foo: 'value1',
          bar: 'value2',
          // ...
      }
  },
    // optional additional iframe sandbox attributes
  iframeSandboxExtras: ['allow-top-navigation', 'allow-popups-to-escape-sandbox']
});
```

You can also load the Embedded SDK from a CDN. The SDK will be available as `supersetEmbeddedSdk` globally:

```html
<script src="https://unpkg.com/@superset-ui/embedded-sdk"></script>

<script>
  supersetEmbeddedSdk.embedDashboard({
    // ... here you supply the same parameters as in the example above
  });
</script>
```

## Authentication/Authorization with Guest Tokens

Embedded resources use a special auth token called a Guest Token to grant Superset access to your users,
without requiring your users to log in to Superset directly. Your backend must create a Guest Token
by requesting Superset's `POST /security/guest_token` endpoint, and pass that guest token to your frontend.

The Embedding SDK takes the guest token and use it to embed a dashboard.

### Creating a Guest Token

From the backend, http `POST` to `/security/guest_token` with some parameters to define what the guest token will grant access to.
Guest tokens can have Row Level Security rules which filter data for the user carrying the token.

The agent making the `POST` request must be authenticated with the `can_grant_guest_token` permission.

Within your app, using the Guest Token will then allow authentication to your Superset instance via creating an Anonymous user object.  This guest anonymous user will default to the public role as per this setting `GUEST_ROLE_NAME = "Public"`.

The user parameters in the example below are optional and are provided as a means of passing user attributes that may be accessed in jinja templates inside your charts.

Example `POST /security/guest_token` payload:

```json
{
  "user": {
    "username": "stan_lee",
    "first_name": "Stan",
    "last_name": "Lee"
  },
  "resources": [{
    "type": "dashboard",
    "id": "abc123"
  }],
  "rls": [
    { "clause": "publisher = 'Nintendo'" }
  ]
}
```

Alternatively, a guest token can be created directly in your app with a json like the following, and then signed
with the secret set in configuration variable `GUEST_TOKEN_JWT_SECRET` (see configuration file config.py)
```
{
  "user": {
    "username": "embedded@embedded.fr",
    "first_name": "embedded",
    "last_name": "embedded"
  },
  "resources": [
    {
      "type": "dashboard",
      "id": "d73e7841-9342-4afd-8e29-b4a416a2498c"
    }
  ],
  "rls_rules": [],
  "iat": 1730883214,
  "exp": 1732956814,
  "aud": "superset",
  "type": "guest"
}
```

### Sandbox iframe

The Embedded SDK creates an iframe with [sandbox](https://developer.mozilla.org/es/docs/Web/HTML/Element/iframe#sandbox) mode by default
which applies certain restrictions to the iframe's content.
To pass additional sandbox attributes you can use `iframeSandboxExtras`:
```js
  // optional additional iframe sandbox attributes
  iframeSandboxExtras: ['allow-top-navigation', 'allow-popups-to-escape-sandbox']
```
