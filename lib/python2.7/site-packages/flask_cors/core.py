# -*- coding: utf-8 -*-
"""
    core
    ~~~~
    Core functionality shared between the extension and the decorator.

    :copyright: (c) 2016 by Cory Dolphin.
    :license: MIT, see LICENSE for more details.
"""
import re
import logging
import collections
from datetime import timedelta
from six import string_types
from flask import request, current_app
from werkzeug.datastructures import Headers, MultiDict

LOG = logging.getLogger(__name__)

# Response Headers
ACL_ORIGIN = 'Access-Control-Allow-Origin'
ACL_METHODS = 'Access-Control-Allow-Methods'
ACL_ALLOW_HEADERS = 'Access-Control-Allow-Headers'
ACL_EXPOSE_HEADERS = 'Access-Control-Expose-Headers'
ACL_CREDENTIALS = 'Access-Control-Allow-Credentials'
ACL_MAX_AGE = 'Access-Control-Max-Age'

# Request Header
ACL_REQUEST_METHOD = 'Access-Control-Request-Method'
ACL_REQUEST_HEADERS = 'Access-Control-Request-Headers'

ALL_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']
CONFIG_OPTIONS = ['CORS_ORIGINS', 'CORS_METHODS', 'CORS_ALLOW_HEADERS',
                  'CORS_EXPOSE_HEADERS', 'CORS_SUPPORTS_CREDENTIALS',
                  'CORS_MAX_AGE', 'CORS_SEND_WILDCARD',
                  'CORS_AUTOMATIC_OPTIONS', 'CORS_VARY_HEADER',
                  'CORS_RESOURCES', 'CORS_INTERCEPT_EXCEPTIONS',
                  'CORS_ALWAYS_SEND']
# Attribute added to request object by decorator to indicate that CORS
# was evaluated, in case the decorator and extension are both applied
# to a view.
FLASK_CORS_EVALUATED = '_FLASK_CORS_EVALUATED'

# Strange, but this gets the type of a compiled regex, which is otherwise not
# exposed in a public API.
RegexObject = type(re.compile(''))
DEFAULT_OPTIONS = dict(origins='*',
                       methods=ALL_METHODS,
                       allow_headers='*',
                       expose_headers=None,
                       supports_credentials=False,
                       max_age=None,
                       send_wildcard=False,
                       automatic_options=True,
                       vary_header=True,
                       resources=r'/*',
                       intercept_exceptions=True,
                       always_send=True)


def parse_resources(resources):
    if isinstance(resources, dict):
        # To make the API more consistent with the decorator, allow a
        # resource of '*', which is not actually a valid regexp.
        resources = [(re_fix(k), v) for k, v in resources.items()]

        # Sort by regex length to provide consistency of matching and
        # to provide a proxy for specificity of match. E.G. longer
        # regular expressions are tried first.
        def pattern_length(pair):
            maybe_regex, _ = pair
            return len(get_regexp_pattern(maybe_regex))

        return sorted(resources,
                      key=pattern_length,
                      reverse=True)

    elif isinstance(resources, string_types):
        return [(re_fix(resources), {})]

    elif isinstance(resources, collections.Iterable):
        return [(re_fix(r), {}) for r in resources]

    # Type of compiled regex is not part of the public API. Test for this
    # at runtime.
    elif isinstance(resources,  RegexObject):
        return [(re_fix(resources), {})]

    else:
        raise ValueError("Unexpected value for resources argument.")


def get_regexp_pattern(regexp):
    """
    Helper that returns regexp pattern from given value.

    :param regexp: regular expression to stringify
    :type regexp: _sre.SRE_Pattern or str
    :returns: string representation of given regexp pattern
    :rtype: str
    """
    try:
        return regexp.pattern
    except AttributeError:
        return str(regexp)


def get_cors_origins(options, request_origin):
    origins = options.get('origins')
    wildcard = r'.*' in origins

    # If the Origin header is not present terminate this set of steps.
    # The request is outside the scope of this specification.-- W3Spec
    if request_origin:
        LOG.debug("CORS request received with 'Origin' %s", request_origin)

        # If the allowed origins is an asterisk or 'wildcard', always match
        if wildcard and options.get('send_wildcard'):
            LOG.debug("Allowed origins are set to '*'. Sending wildcard CORS header.")
            return ['*']
        # If the value of the Origin header is a case-sensitive match
        # for any of the values in list of origins
        elif try_match_any(request_origin, origins):
            LOG.debug("The request's Origin header matches. Sending CORS headers.", )
            # Add a single Access-Control-Allow-Origin header, with either
            # the value of the Origin header or the string "*" as value.
            # -- W3Spec
            return [request_origin]
        else:
            LOG.debug("The request's Origin header does not match any of allowed origins.")
            return None


    elif options.get('always_send'):
        if wildcard:
            # If wildcard is in the origins, even if 'send_wildcard' is False,
            # simply send the wildcard. It is the most-likely to be correct
            # thing to do (the only other option is to return nothing, which)
            # pretty is probably not whawt you want if you specify origins as
            # '*'
            return ['*']
        else:
            # Return all origins that are not regexes.
            return sorted([o for o in origins if not probably_regex(o)])

    # Terminate these steps, return the original request untouched.
    else:
        LOG.debug("The request did not contain an 'Origin' header. This means the browser or client did not request CORS, ensure the Origin Header is set.")
        return None


def get_allow_headers(options, acl_request_headers):
    if acl_request_headers:
        request_headers = [h.strip() for h in acl_request_headers.split(',')]

        # any header that matches in the allow_headers
        matching_headers = filter(
            lambda h: try_match_any(h, options.get('allow_headers')),
            request_headers
        )

        return ', '.join(sorted(matching_headers))

    return None


def get_cors_headers(options, request_headers, request_method):
    origins_to_set = get_cors_origins(options, request_headers.get('Origin'))
    headers = MultiDict()

    if not origins_to_set:  # CORS is not enabled for this route
        return headers

    for origin in origins_to_set:
        headers.add(ACL_ORIGIN, origin)

    headers[ACL_EXPOSE_HEADERS] = options.get('expose_headers')

    if options.get('supports_credentials'):
        headers[ACL_CREDENTIALS] = 'true'  # case sensative

    # This is a preflight request
    # http://www.w3.org/TR/cors/#resource-preflight-requests
    if request_method == 'OPTIONS':
        acl_request_method = request_headers.get(ACL_REQUEST_METHOD, '').upper()

        # If there is no Access-Control-Request-Method header or if parsing
        # failed, do not set any additional headers
        if acl_request_method and acl_request_method in options.get('methods'):

            # If method is not a case-sensitive match for any of the values in
            # list of methods do not set any additional headers and terminate
            # this set of steps.
            headers[ACL_ALLOW_HEADERS] = get_allow_headers(options, request_headers.get(ACL_REQUEST_HEADERS))
            headers[ACL_MAX_AGE] = options.get('max_age')
            headers[ACL_METHODS] = options.get('methods')
        else:
            LOG.info("The request's Access-Control-Request-Method header does not match allowed methods. CORS headers will not be applied.")

    # http://www.w3.org/TR/cors/#resource-implementation
    if options.get('vary_header'):
        # Only set header if the origin returned will vary dynamically,
        # i.e. if we are not returning an asterisk, and there are multiple
        # origins that can be matched.
        if headers[ACL_ORIGIN] == '*':
            pass
        elif (len(options.get('origins')) > 1 or
              len(origins_to_set) > 1 or
              any(map(probably_regex, options.get('origins')))):
            headers.add('Vary', 'Origin')

    return MultiDict((k, v) for k, v in headers.items() if v)


def set_cors_headers(resp, options):
    """
    Performs the actual evaluation of Flas-CORS options and actually
    modifies the response object.

    This function is used both in the decorator and the after_request
    callback
    """

    # If CORS has already been evaluated via the decorator, skip
    if hasattr(resp, FLASK_CORS_EVALUATED):
        LOG.debug('CORS have been already evaluated, skipping')
        return resp

    # Some libraries, like OAuthlib, set resp.headers to non Multidict
    # objects (Werkzeug Headers work as well). This is a problem because
    # headers allow repeated values.
    if (not isinstance(resp.headers, Headers)
           and not isinstance(resp.headers, MultiDict)):
        resp.headers = MultiDict(resp.headers)

    headers_to_set = get_cors_headers(options, request.headers, request.method)

    LOG.debug('Settings CORS headers: %s', str(headers_to_set))

    for k, v in headers_to_set.items():
        resp.headers.add(k, v)

    return resp

def probably_regex(maybe_regex):
    if isinstance(maybe_regex, RegexObject):
        return True
    else:
        common_regex_chars = ['*','\\',']', '?']
        # Use common characters used in regular expressions as a proxy
        # for if this string is in fact a regex.
        return any((c in maybe_regex for c in common_regex_chars))

def re_fix(reg):
    """
        Replace the invalid regex r'*' with the valid, wildcard regex r'/.*' to
        enable the CORS app extension to have a more user friendly api.
    """
    return r'.*' if reg == r'*' else reg


def try_match_any(inst, patterns):
    return any(try_match(inst, pattern) for pattern in patterns)


def try_match(request_origin, maybe_regex):
    """Safely attempts to match a pattern or string to a request origin."""
    if isinstance(maybe_regex, RegexObject):
        return re.match(maybe_regex, request_origin)
    elif probably_regex(maybe_regex):
        return re.match(maybe_regex, request_origin, flags=re.IGNORECASE)
    else:
        try:
            return request_origin.lower() == maybe_regex.lower()
        except AttributeError:
            return request_origin == maybe_regex


def get_cors_options(appInstance, *dicts):
    """
    Compute CORS options for an application by combining the DEFAULT_OPTIONS,
    the app's configuration-specified options and any dictionaries passed. The
    last specified option wins.
    """
    options = DEFAULT_OPTIONS.copy()
    options.update(get_app_kwarg_dict(appInstance))
    if dicts:
        for d in dicts:
            options.update(d)

    return serialize_options(options)


def get_app_kwarg_dict(appInstance=None):
    """Returns the dictionary of CORS specific app configurations."""
    app = (appInstance or current_app)

    # In order to support blueprints which do not have a config attribute
    app_config = getattr(app, 'config', {})

    return dict(
        (k.lower().replace('cors_', ''), app_config.get(k))
        for k in CONFIG_OPTIONS
        if app_config.get(k) is not None
    )


def flexible_str(obj):
    """
    A more flexible str function which intelligently handles stringifying
    strings, lists and other iterables. The results are lexographically sorted
    to ensure generated responses are consistent when iterables such as Set
    are used.
    """
    if obj is None:
        return None
    elif(not isinstance(obj, string_types)
            and isinstance(obj, collections.Iterable)):
        return ', '.join(str(item) for item in sorted(obj))
    else:
        return str(obj)


def serialize_option(options_dict, key, upper=False):
    if key in options_dict:
        value = flexible_str(options_dict[key])
        options_dict[key] = value.upper() if upper else value


def ensure_iterable(inst):
    """
    Wraps scalars or string types as a list, or returns the iterable instance.
    """
    if isinstance(inst, string_types):
        return [inst]
    elif not isinstance(inst, collections.Iterable):
        return [inst]
    else:
        return inst

def sanitize_regex_param(param):
    return [re_fix(x) for x in ensure_iterable(param)]


def serialize_options(opts):
    """
    A helper method to serialize and processes the options dictionary.
    """
    options = (opts or {}).copy()

    for key in opts.keys():
        if key not in DEFAULT_OPTIONS:
             LOG.warn("Unknown option passed to Flask-CORS: %s", key)

    # Ensure origins is a list of allowed origins with at least one entry.
    options['origins'] = sanitize_regex_param(options.get('origins'))
    options['allow_headers'] = sanitize_regex_param(options.get('allow_headers'))

    # This is expressly forbidden by the spec. Raise a value error so people
    # don't get burned in production.
    if r'.*' in options['origins'] and options['supports_credentials'] and options['send_wildcard']:
        raise ValueError("Cannot use supports_credentials in conjunction with"
                         "an origin string of '*'. See: "
                         "http://www.w3.org/TR/cors/#resource-requests")

    serialize_option(options, 'expose_headers')
    serialize_option(options, 'methods', upper=True)

    if isinstance(options.get('max_age'), timedelta):
        options['max_age'] = str(int(options['max_age'].total_seconds()))

    return options
