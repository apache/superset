/* global window */
let supported;

export function isGeolocationSupported() {
  // not necessary to check again
  if (supported !== undefined) {
    return Promise.resolve(supported);
  }

  if (window.navigator.permissions !== undefined) {
    // navigator.permissions has incomplete browser support
    // http://caniuse.com/#feat=permissions-api
    // Test for the case where a browser disables Geolocation because of an
    // insecure origin
    return window.navigator.permissions.query({name: 'geolocation'}).then(p => {
      supported = p.state !== 'denied';
      return supported;
    });
  }

  supported = Boolean(window.navigator.geolocation);
  return Promise.resolve(supported);
}
