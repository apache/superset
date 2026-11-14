---
title: Toasts
sidebar_position: 12
---

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

# Toasts

Extensions can show toasts in Superset's notification area with the `toasts` API.

```typescript
import { toasts } from '@apache-superset/core';

toasts.addSuccessToast('Exported to Google Sheets', {
  link: { href: 'https://docs.google.com/spreadsheets/d/abc', label: 'Open' },
});
```

## Functions

| Function | Description |
| --- | --- |
| `addInfoToast(text, options?)` | Shows an informational toast |
| `addSuccessToast(text, options?)` | Shows a success toast |
| `addWarningToast(text, options?)` | Shows a warning toast |
| `addDangerToast(text, options?)` | Shows an error toast |
| `removeToast(id)` | Closes a toast |

Each `add*Toast` function returns the ID of the toast, which you can pass to `removeToast`.

## Options

```typescript
interface ToastOptions {
  link?: { href: string; label: string };
  duration?: number;
}
```

- `text` is always rendered as plain text, never as HTML.
- `link` adds a button with the given `label`. Clicking it opens `href` in a new tab with `noopener` and `noreferrer`. The URL goes through Superset's navigation guard: absolute URLs must use `http(s)`, `ftp:`, `mailto:` or `tel:`, other values are treated as paths within Superset, and URLs the guard rejects (for example ones with embedded credentials) are logged instead of opened.
- `duration` is the time in milliseconds before the toast closes. The default is 8000. `0` keeps the toast until the user closes it.
- A toast with a `link` never closes on its own, so that keyboard and assistive-technology users are not raced. `duration` is ignored when `link` is set.

## Example

Show a toast while an export runs, then replace it with the result:

```typescript
import { toasts } from '@apache-superset/core';

const id = toasts.addInfoToast('Sending to Google Sheets…', { duration: 0 });
try {
  const url = await sendToSheets();
  toasts.removeToast(id);
  toasts.addSuccessToast('Sent to Google Sheets', {
    link: { href: url, label: 'Open' },
  });
} catch {
  toasts.removeToast(id);
  toasts.addDangerToast('Sending to Google Sheets failed');
}
```
