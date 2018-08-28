## @superset/core

### SupersetClient

Example usage

Configuration

const { protocol = 'http', host = '', headers = {}, mode = 'same-origin', timeout, signal } = config;

- timeout can be per request, or globally
- can cancel requests via AbortController, queryRequest => 'queryController' which has abort method
- once init is called, csrf token will be fetched and all other reuquests will be queued after that response

@TODO should i18n be included in core? useful for error messages, or supersetclient could import i18n ...

test

- async/sync ajax (for document.execCommand('copy'))
- copy text (sync ajax based)
- not sure how to test the link
