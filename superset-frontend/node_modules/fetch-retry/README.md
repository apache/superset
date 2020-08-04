# fetch-retry

Adds retry functionality to the `Fetch` API.

It wraps any `Fetch` API package (eg: [isomorphic-fetch](https://github.com/matthew-andrews/isomorphic-fetch), [cross-fetch](https://github.com/lquixada/cross-fetch), [isomorphic-unfetch](https://github.com/developit/unfetch) and etc.) and retries requests that fail due to network issues. It can also be configured to retry requests on specific HTTP status codes.

[![Build Status](https://travis-ci.org/jonbern/fetch-retry.svg?branch=master)](https://travis-ci.org/jonbern/fetch-retry)

## npm package

```javascript
npm install fetch-retry --save
```

## Example
`fetch-retry` is used the same way as `fetch`, but also accepts `retries`, `retryDelay`, and `retryOn` on the `options` object.

These properties are optional, and unless different defaults have been specified when requiring `fetch-retry`, these will default to 3 retries, with a 1000ms retry delay, and to only retry on network errors.

```javascript
var originalFetch = require('isomorphic-fetch');
var fetch = require('fetch-retry')(originalFetch);
```

```javascript
fetch(url, {
    retries: 3,
    retryDelay: 1000
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(json) {
    // do something with the result
    console.log(json);
  });
```

or passing your own defaults:

```javascript
var originalFetch = require('isomorphic-fetch');
var fetch = require('fetch-retry')(originalFetch, {
    retries: 5,
    retryDelay: 800
  });
```

## Example: Exponential backoff
The default behavior of `fetch-retry` is to wait a fixed amount of time between attempts, but it is also possible to customize this by passing a function as the `retryDelay` option. The function is supplied three arguments: `attempt` (starting at 0), `error` (in case of a network error), and `response`. It must return a number indicating the delay.

```javascript
fetch(url, {
    retryDelay: function(attempt, error, response) {
      return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
    }
  }).then(function(response) {
    return response.json();
  }).then(function(json) {
    // do something with the result
    console.log(json);
  });
```

## Example: Retry on 503 (Service Unavailable)
The default behavior of `fetch-retry` is to only retry requests on network related issues, but it is also possible to configure it to retry on specific HTTP status codes. This is done by using the `retryOn` property, which expects an array of HTTP status codes.

```javascript
fetch(url, {
    retryOn: [503]
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(json) {
    // do something with the result
    console.log(json);
  });
```

## Example: Retry custom behavior
The `retryOn` option may also be specified as a function, in which case it will be supplied three arguments: `attempt` (starting at 0), `error` (in case of a network error), and `response`. Return a truthy value from this function in order to trigger a retry, any falsy value will result in the call to fetch either resolving (in case the last attempt resulted in a response), or rejecting (in case the last attempt resulted in an error).

```javascript
fetch(url, {
    retryOn: function(attempt, error, response) {
      // retry on any network error, or 4xx or 5xx status codes
      if (error !== null || response.status >= 400) {
        console.log(`retrying, attempt number ${attempt + 1}`);
        return true;
      }
    })
    .then(function(response) {
      return response.json();
    }).then(function(json) {
      // do something with the result
      console.log(json);
    });
```
