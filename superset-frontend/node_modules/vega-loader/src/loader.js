import {error, extend, isFunction, stringValue} from 'vega-util';

// Matches absolute URLs with optional protocol
//   https://...    file://...    //...
const protocol_re = /^([A-Za-z]+:)?\/\//;

// Matches allowed URIs. From https://github.com/cure53/DOMPurify/blob/master/src/regexp.js with added file://
const allowed_re = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i; // eslint-disable-line no-useless-escape
const whitespace_re = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205f\u3000]/g; // eslint-disable-line no-control-regex


// Special treatment in node.js for the file: protocol
const fileProtocol = 'file://';

/**
 * Factory for a loader constructor that provides methods for requesting
 * files from either the network or disk, and for sanitizing request URIs.
 * @param {function} fetch - The Fetch API for HTTP network requests.
 *   If null or undefined, HTTP loading will be disabled.
 * @param {object} fs - The file system interface for file loading.
 *   If null or undefined, local file loading will be disabled.
 * @return {function} A loader constructor with the following signature:
 *   param {object} [options] - Optional default loading options to use.
 *   return {object} - A new loader instance.
 */
export default function(fetch, fs) {
  return function(options) {
    return {
      options: options || {},
      sanitize: sanitize,
      load: load,
      fileAccess: !!fs,
      file: fileLoader(fs),
      http: httpLoader(fetch)
    };
  };
}

/**
 * Load an external resource, typically either from the web or from the local
 * filesystem. This function uses {@link sanitize} to first sanitize the uri,
 * then calls either {@link http} (for web requests) or {@link file} (for
 * filesystem loading).
 * @param {string} uri - The resource indicator (e.g., URL or filename).
 * @param {object} [options] - Optional loading options. These options will
 *   override any existing default options.
 * @return {Promise} - A promise that resolves to the loaded content.
 */
async function load(uri, options) {
  const opt = await this.sanitize(uri, options),
        url = opt.href;

  return opt.localFile
    ? this.file(url)
    : this.http(url, options);
}

/**
 * URI sanitizer function.
 * @param {string} uri - The uri (url or filename) to sanity check.
 * @param {object} options - An options hash.
 * @return {Promise} - A promise that resolves to an object containing
 *  sanitized uri data, or rejects it the input uri is deemed invalid.
 *  The properties of the resolved object are assumed to be
 *  valid attributes for an HTML 'a' tag. The sanitized uri *must* be
 *  provided by the 'href' property of the returned object.
 */
async function sanitize(uri, options) {
  options = extend({}, this.options, options);

  const fileAccess = this.fileAccess,
        result = {href: null};

  let isFile, loadFile, base;

  const isAllowed = allowed_re.test(uri.replace(whitespace_re, ''));

  if (uri == null || typeof uri !== 'string' || !isAllowed) {
    error('Sanitize failure, invalid URI: ' + stringValue(uri));
  }

  const hasProtocol = protocol_re.test(uri);

  // if relative url (no protocol/host), prepend baseURL
  if ((base = options.baseURL) && !hasProtocol) {
    // Ensure that there is a slash between the baseURL (e.g. hostname) and url
    if (!uri.startsWith('/') && base[base.length-1] !== '/') {
      uri = '/' + uri;
    }
    uri = base + uri;
  }

  // should we load from file system?
  loadFile = (isFile = uri.startsWith(fileProtocol))
    || options.mode === 'file'
    || options.mode !== 'http' && !hasProtocol && fileAccess;

  if (isFile) {
    // strip file protocol
    uri = uri.slice(fileProtocol.length);
  } else if (uri.startsWith('//')) {
    if (options.defaultProtocol === 'file') {
      // if is file, strip protocol and set loadFile flag
      uri = uri.slice(2);
      loadFile = true;
    } else {
      // if relative protocol (starts with '//'), prepend default protocol
      uri = (options.defaultProtocol || 'http') + ':' + uri;
    }
  }

  // set non-enumerable mode flag to indicate local file load
  Object.defineProperty(result, 'localFile', {value: !!loadFile});

  // set uri
  result.href = uri;

  // set default result target, if specified
  if (options.target) {
    result.target = options.target + '';
  }

  // set default result rel, if specified (#1542)
  if (options.rel) {
    result.rel = options.rel + '';
  }

  // provide control over cross-origin image handling (#2238)
  // https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
  if (options.context === 'image' && options.crossOrigin) {
    result.crossOrigin = options.crossOrigin + '';
  }

  // return
  return result;
}

/**
 * File system loader factory.
 * @param {object} fs - The file system interface.
 * @return {function} - A file loader with the following signature:
 *   param {string} filename - The file system path to load.
 *   param {string} filename - The file system path to load.
 *   return {Promise} A promise that resolves to the file contents.
 */
function fileLoader(fs) {
  return fs
    ? function(filename) {
        return new Promise(function(accept, reject) {
          fs.readFile(filename, function(error, data) {
            if (error) reject(error);
            else accept(data);
          });
        });
      }
    : fileReject;
}

/**
 * Default file system loader that simply rejects.
 */
async function fileReject() {
  error('No file system access.');
}

/**
 * HTTP request handler factory.
 * @param {function} fetch - The Fetch API method.
 * @return {function} - An http loader with the following signature:
 *   param {string} url - The url to request.
 *   param {object} options - An options hash.
 *   return {Promise} - A promise that resolves to the file contents.
 */
function httpLoader(fetch) {
  return fetch
    ? async function(url, options) {
        const opt = extend({}, this.options.http, options),
              type = options && options.response,
              response = await fetch(url, opt);

        return !response.ok
          ? error(response.status + '' + response.statusText)
          : isFunction(response[type]) ? response[type]()
          : response.text();
      }
    : httpReject;
}

/**
 * Default http request handler that simply rejects.
 */
async function httpReject() {
  error('No HTTP fetch method available.');
}
