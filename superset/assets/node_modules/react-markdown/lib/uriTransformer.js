'use strict';

var protocols = ['http', 'https', 'mailto', 'tel'];

module.exports = function uriTransformer(uri) {
  var url = (uri || '').trim();
  var first = url.charAt(0);

  if (first === '#' || first === '/') {
    return url;
  }

  var colon = url.indexOf(':');
  if (colon === -1) {
    return url;
  }

  var length = protocols.length;
  var index = -1;

  while (++index < length) {
    var protocol = protocols[index];

    if (colon === protocol.length && url.slice(0, protocol.length) === protocol) {
      return url;
    }
  }

  index = url.indexOf('?');
  if (index !== -1 && colon > index) {
    return url;
  }

  index = url.indexOf('#');
  if (index !== -1 && colon > index) {
    return url;
  }

  // eslint-disable-next-line no-script-url
  return 'javascript:void(0)';
};