# -* coding: utf-8 -*-
"""
    flaskext.openid
    ~~~~~~~~~~~~~~~

    Tiny wrapper around python-openid to make working with the basic
    API in a flask application easier.  Adapt this code for your own
    project if necessary.

    :copyright: (c) 2010 by Armin Ronacher.
    :license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import pickle
import tempfile
from functools import wraps
from datetime import date
import sys
import base64

from flask import request, session, redirect, current_app, url_for
from werkzeug.urls import url_quote

from openid.store.filestore import FileOpenIDStore
from openid.extensions import ax
from openid.extensions.sreg import SRegRequest, SRegResponse
from openid.consumer.consumer import Consumer, SUCCESS, CANCEL, FAILURE, \
    SETUP_NEEDED
from openid.consumer import discover

# python-openid is a really stupid library in that regard, we have
# to disable logging by monkey patching.  We still call the original
# implementation if we are in debug mode though.
from openid import oidutil
_original_log = oidutil.log
def _dispatching_log(message, level=None):
    app = current_app._get_current_object()
    if app is None or app.debug:
        return _original_log(message, level)
oidutil.log = _dispatching_log


AX_MAPPING = {
    'nickname':     ['http://axschema.org/namePerson/friendly',
                     'http://schema.openid.net/namePerson/friendly'],
    'email':        ['http://axschema.org/contact/email',
                     'http://schema.openid.net/contact/email'],
    'fullname':     ['http://axschema.org/namePerson',
                     'http://axschema.org/namePerson/first',
                     'http://axschema.org/namePerson/last',
                     'http://schema.openid.net/namePerson'],
    'dob':          ['http://axschema.org/birthDate',
                     'http://axschema.org/birthDate/birthYear',
                     'http://axschema.org/birthDate/birthMonth',
                     'http://schema.openid.net/birthDate'],
    'gender':       ['http://axschema.org/person/gender',
                     'http://schema.openid.net/person/gender'],
    'postcode':     ['http://axschema.org/contact/postalCode/home',
                     'http://schema.openid.net/contact/postalCode/home'],
    'country':      ['http://axschema.org/contact/country/home',
                     'http://schema.openid.net/contact/country/home'],
    'language':     ['http://axschema.org/pref/language',
                     'http://schema.openid.net/pref/language'],
    'timezone':     ['http://axschema.org/pref/timezone',
                     'http://schema.openid.net/pref/timezone'],
    'phone':        ['http://axschema.org/contact/phone/default'],
    'aim':          ['http://axschema.org/contact/IM/AIM'],
    'icq':          ['http://axschema.org/contact/IM/ICQ'],
    'msn':          ['http://axschema.org/contact/IM/MSN'],
    'yahoo':        ['http://axschema.org/contact/IM/Yahoo'],
    'jabber':       ['http://axschema.org/contact/IM/Jabber'],
    'skype':        ['http://axschema.org/contact/IM/Skype'],
    'website':      ['http://axschema.org/contact/web/default',
                     'http://schema.openid.net/contact/web/default'],
    'blog':         ['http://axschema.org/contact/web/blog'],
    'image':        ['http://axschema.org/media/image/default',
                     'http://schema.openid.net/media/image/default']
}
FULL_NAME_URIS = ['http://axschema.org/namePerson',
                  'http://schema.openid.net/namePerson']
FULL_DOB_URIS = ['http://axschema.org/birthDate',
                 'http://schema.openid.net/birthDate']
SREG_KEYS = set(['nickname', 'email', 'fullname', 'dob', 'gender',
                 'postcode', 'country', 'language', 'timezone'])
# these are required if provided, otherwise google will not return
# the information for the application.
REQUIRED_KEYS = set(['country', 'email', 'fullname', 'language'])
ALL_KEYS = set(AX_MAPPING) | SREG_KEYS


COMMON_PROVIDERS = {
    'google':       'https://www.google.com/accounts/o8/id',
    'yahoo':        'https://yahoo.com/',
    'aol':          'http://aol.com/',
    'steam':        'https://steamcommunity.com/openid/'
}


def softint(x):
    try:
        return int(x)
    except (ValueError, TypeError):
        return None


def isstring(x):
    if sys.version_info[0] >= 3:
        return isinstance(x, str)
    else:
        return isinstance(x, basestring)


class SessionWrapper(object):
    name_mapping = {
        '_yadis_services__openid_consumer_':    'yoc',
        '_openid_consumer_last_token':          'lt'
    }

    def __init__(self, ext):
        self.ext = ext

    def __getitem__(self, name):
        rv = session[self.name_mapping.get(name, name)]
        if isinstance(rv, dict) and len(rv) == 1 and ' p' in rv:
            try:
                return pickle.loads(base64.b64decode(rv[' p'].encode('utf-8')))
            except:
                return pickle.loads(rv[' p'])
        return rv

    def __setitem__(self, name, value):
        if not getattr(current_app.session_interface, 'pickle_based', True):
            b64 = base64.b64encode(pickle.dumps(value, 0))
            value = {' p': b64.decode('utf-8')}
        session[self.name_mapping.get(name, name)] = value

    def __delitem__(self, name):
        del session[self.name_mapping.get(name, name)]

    def get(self, name, default=None):
        try:
            return self[name]
        except KeyError:
            return default

    def __contains__(self, name):
        try:
            self[name]
            return True
        except KeyError:
            return False


class RegLookup(object):

    def __init__(self, resp, extensions):
        sreg_resp = SRegResponse.fromSuccessResponse(resp)
        self.sreg = sreg_resp and sreg_resp.data or {}
        self.ax_resp = ax.FetchResponse.fromSuccessResponse(resp) or {}

        # Process the OpenID response with the OpenIDResponse class provided
        self.ext = {}
        for extension in extensions:
            ext_name = getattr(extension, 'ns_alias', extension.__name__)
            self.ext[ext_name] = \
                extension.fromSuccessResponse(resp)

    def get(self, name, default=None):
        assert name in ALL_KEYS, 'unknown key %r' % name
        rv = self.sreg.get(name)
        if rv is not None:
            return rv
        for uri in AX_MAPPING.get(name, ()):
            rv = self.get_uri(uri)
            if rv is not None:
                return rv
        return default

    def get_uri(self, uri):
        try:
            return self.ax_resp.get(uri)[0]
        except (TypeError, IndexError, KeyError):
            return None

    def get_combined(self, sreg_key, ax_uris):
        rv = self.sreg.get(sreg_key)
        if rv is not None:
            return rv
        for uri in ax_uris:
            rv = self.get_uri(uri)
            if rv is not None:
                return rv


class OpenIDResponse(object):
    """Passed to the `after_login` function.  Provides all the information
    sent from the OpenID provider.  The profile information has to be
    requested from the server by passing a list of fields as `ask_for` to
    the :meth:`~OpenID.try_login` function.
    """

    def __init__(self, resp, extensions):
        #: the openid the user used for sign in
        self.identity_url = resp.identity_url
        lookup = RegLookup(resp, extensions)

        #: the full name of the user
        self.fullname = lookup.get_combined('fullname', FULL_NAME_URIS)
        if self.fullname is None:
            first = lookup.get_uri('http://axschema.org/namePerson/first')
            last = lookup.get_uri(u'http://axschema.org/namePerson/last')
            self.fullname = u' '.join(x for x in [first, last] if x) or None

        #: desired nickname of the user
        self.nickname = lookup.get('nickname')

        #: the email address of the user
        self.email = lookup.get('email')

        #: the gender of the user (``f`` for femail and ``m`` for male)
        self.gender = (lookup.get('gender') or '').lower() or None

        #: the country of the user as specified by ISO3166
        self.country = lookup.get('country')

        #: free text that should conform to the user's country's postal system
        self.postcode = lookup.get('postcode')

        #: the user's preferred language as specified by ISO639
        self.language = lookup.get('language')

        #: timezone string from the TimeZone database
        self.timezone = lookup.get('timezone')

        #: date of birth as :class:`~datetime.datetime` object.
        self.date_of_birth = None

        #: the year of birth of the user as integer
        self.year_of_birth = None

        #: the month of birth of the user as integer (1 based)
        self.month_of_birth = None

        # check if we can get the full birthday first
        dobstr = lookup.get_combined('dob', FULL_DOB_URIS)
        if dobstr is not None:
            try:
                pieces = [int(x) for x in dobstr.split('-')]
                if len(pieces) != 3:
                    raise ValueError()
            except (ValueError, TypeError):
                pass
            else:
                if pieces[0]:
                    self.year_of_birth = pieces[0]
                if pieces[1]:
                    self.month_of_birth = pieces[1]
                try:
                    self.date_of_birth = date(*pieces)
                except (ValueError, TypeError, OverflowError):
                    pass

        # next try just year and month
        if self.year_of_birth is None:
            self.year_of_birth = softint(lookup.get_uri(
                'http://axschema.org/birthDate/birthYear'))
            self.month_of_birth = softint(lookup.get_uri(
                'http://axschema.org/birthDate/birthMonth'))

        #: phone number of the user as string
        self.phone = lookup.get('phone')

        #: AIM messenger address as string
        self.aim = lookup.get('aim')

        #: icq messenger number as string
        self.icq = lookup.get('icq')

        #: msn name as string
        self.msn = lookup.get('msn')

        #: yahoo messenger address as string
        self.yahoo = lookup.get('yahoo')

        #: jabber address as string
        self.jabber = lookup.get('jabber')

        #: skype name as string
        self.skype = lookup.get('skype')

        #: URL of website as string
        self.website = lookup.get('website')

        #: URL of blog as string
        self.blog = lookup.get('blog')

        #: URL to profile image as string
        self.image = lookup.get('image')

        #: Hash of the response object from the OpenID Extension by the
        # OpenID Extension class name
        self.extensions = lookup.ext


class OpenID(object):
    """Simple helper class for OpenID auth.  Has to be created in advance
    like a :class:`~flask.Flask` object.

    There are two usage modes which work very similar.  One is binding
    the instance to a very specific Flask application::

        app = Flask(__name__)
        db = OpenID(app)

    The second possibility is to create the object once and configure the
    application later to support it::

        oid = OpenID()

        def create_app():
            app = Flask(__name__)
            oid.init_app(app)
            return app

    :param app: the application to register this openid controller with.
    :param fs_store_path: if given this is the name of a folder where the
                          OpenID auth process can store temporary
                          information.  If neither is provided a temporary
                          folder is assumed.  This is overridden by the
                          ``OPENID_FS_STORE_PATH`` configuration key.
    :param store_factory: alternatively a function that creates a
                          python-openid store object.
    :param fallback_endpoint: optionally a string with the name of an URL
                              endpoint the user should be redirected to
                              if the HTTP referrer is unreliable.  By
                              default the user is redirected back to the
                              application's index in that case.
    :param extension_responses: a list of OpenID Extensions Response class.
    :param safe_roots: a list of trust roots to support returning to
    :param url_root_as_trust_root: whether to use the url_root as trust_root
    """

    def __init__(self, app=None, fs_store_path=None, store_factory=None,
                 fallback_endpoint=None, extension_responses=None,
                 safe_roots=None, url_root_as_trust_root=False):
        # backwards compatibility support
        if isstring(app):
            from warnings import warn
            warn(DeprecationWarning('OpenID constructor expects application '
                                    'as first argument now.  If you want to '
                                    'provide a hardcoded fs_store_path you '
                                    'have to use a keyword argument.  It is '
                                    'recommended though to use the config '
                                    'key.'), stacklevel=2)
            fs_store_path = app
            app = None

        self.app = app
        if app is not None:
            self.init_app(app)

        self.fs_store_path = fs_store_path
        if store_factory is None:
            store_factory = self._default_store_factory
        self.store_factory = store_factory
        self.after_login_func = None
        self.fallback_endpoint = fallback_endpoint
        if not extension_responses:
            extension_responses = []
        self.extension_responses = extension_responses
        if isstring(safe_roots):
            self.safe_roots = [safe_roots]
        else:
            self.safe_roots = safe_roots
        self.url_root_as_trust_root = url_root_as_trust_root

    def init_app(self, app):
        """This callback can be used to initialize an application for the
        use with this openid controller.

        .. versionadded:: 1.0
        """
        app.config.setdefault('OPENID_FS_STORE_PATH', None)

    def _default_store_factory(self):
        """Default store factory that creates a filesystem store from
        the configuration.
        """
        app = self.app if self.app is not None else current_app

        if 'OPENID_FS_STORE_PATH' not in app.config:
            self.init_app(app)
            from warnings import warn
            warn(DeprecationWarning('init_app not called for this '
                 'application.  This is deprecated functionality'))

        path = app.config['OPENID_FS_STORE_PATH'] or self.fs_store_path
        if path is None:
            path = os.path.join(tempfile.gettempdir(), 'flask-openid')
        return FileOpenIDStore(path)

    def signal_error(self, msg):
        """Signals an error.  It does this by storing the message in the
        session.  Use :meth:`errorhandler` to this method.
        """
        session['openid_error'] = msg

    def fetch_error(self):
        """Fetches the error from the session.  This removes it from the
        session and returns that error.  This method is probably useless
        if :meth:`errorhandler` is used.
        """
        return session.pop('openid_error', None)

    def get_next_url(self):
        """Returns the URL where we want to redirect to.  This will
        always return a valid URL.
        """
        return (
            self.check_safe_root(request.values.get('next')) or
            self.check_safe_root(request.referrer) or
            (self.fallback_endpoint and
             self.check_safe_root(url_for(self.fallback_endpoint))) or
            request.url_root
        )

    def check_safe_root(self, url):
        if url is None:
            return None
        if self.safe_roots is None:
            return url
        if url.startswith(request.url_root) or url.startswith('/'):
            # A URL inside the same app is deemed to always be safe
            return url
        for safe_root in self.safe_roots:
            if url.startswith(safe_root):
                return url
        return None

    def get_current_url(self):
        """the current URL + next."""
        return request.base_url + '?next=' + url_quote(self.get_next_url())

    def get_success_url(self):
        """Return the internal success URL.

        :internal:
        """
        return self.get_current_url() + '&openid_complete=yes'

    def attach_reg_info(self, auth_request, keys, optional_keys):
        """Attaches sreg and ax requests to the auth request.

        :internal:
        """
        keys = set(keys or [])
        optional_keys = set(optional_keys or [])
        sreg_keys = list(SREG_KEYS & keys)
        sreg_optional_keys = list(SREG_KEYS & optional_keys)
        auth_request.addExtension(SRegRequest(required=sreg_keys,
                                  optional=sreg_optional_keys))
        ax_req = ax.FetchRequest()
        for key in (keys | optional_keys):
            for uri in AX_MAPPING.get(key, ()):
                ax_req.add(ax.AttrInfo(uri, required=key in REQUIRED_KEYS))
        auth_request.addExtension(ax_req)

    def errorhandler(self, f):
        """Called if an error occurs with the message.  By default
        ``'openid_error'`` is added to the session so that :meth:`fetch_error`
        can fetch that error from the session.  Alternatively it makes sense
        to directly flash the error for example::

            @oid.errorhandler
            def on_error(message):
                flash(u'Error: ' + message)
        """
        self.signal_error = f
        return f

    def after_login(self, f):
        """This function will be called after login.  It must redirect to
        a different place and remember the user somewhere.  The session
        is not modified by SimpleOpenID.  The decorated function is
        passed a :class:`OpenIDResponse` object.
        """
        self.after_login_func = f
        return f

    def loginhandler(self, f):
        """Marks a function as login handler.  This decorator injects some
        more OpenID required logic.  Always decorate your login function with
        this decorator.
        """
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.args.get('openid_complete') != u'yes':
                return f(*args, **kwargs)
            consumer = Consumer(SessionWrapper(self), self.store_factory())
            args = request.args.to_dict()
            args.update(request.form.to_dict())
            openid_response = consumer.complete(args, self.get_current_url())
            if openid_response.status == SUCCESS:
                return self.after_login_func(OpenIDResponse(
                    openid_response, self.extension_responses))
            elif openid_response.status == CANCEL:
                self.signal_error(u'The request was cancelled')
            elif openid_response.status == FAILURE:
                self.signal_error(u'OpenID authentication failure. Mesage: %s'
                                  % openid_response.message)
            elif openid_response.status == SETUP_NEEDED:
                # Unless immediate=True, we should never get here
                self.signal_error(u'OpenID setup was needed')
            else:
                # We should also never get here, as this should be exhaustive
                self.signal_error(u'OpenID authentication weird state: %s' %
                                  openid_response.status)
            return redirect(self.get_current_url())
        return decorated

    def try_login(self, identity_url, ask_for=None, ask_for_optional=None,
                  extensions=None, immediate=False):
        """This tries to login with the given identity URL.  This function
        must be called from the login_handler.  The `ask_for` and
        `ask_for_optional`parameter can be a set of values to be asked
        from the openid provider, where keys in `ask_for` are marked as
        required, and keys in `ask_for_optional` are marked as optional.

        The following strings can be used in the `ask_for` and
        `ask_for_optional` parameters:
        ``aim``, ``blog``, ``country``, ``dob`` (date of birth), ``email``,
        ``fullname``, ``gender``, ``icq``, ``image``, ``jabber``, ``language``,
        ``msn``, ``nickname``, ``phone``, ``postcode``, ``skype``,
        ``timezone``, ``website``, ``yahoo``

        `extensions` can be a list of instances of OpenID extension requests
        that should be passed on with the request. If you use this, please make
        sure to pass the Response classes of these extensions when initializing
        OpenID.

        `immediate` can be used to indicate this request should be a so-called
        checkid_immediate request, resulting in the provider not showing any
        UI.
        Note that this adds a new possible response: SetupNeeded, which is the
        server saying it doesn't have enough information yet to authorized or
        reject the authentication (probably, the user needs to sign in or
        approve the trust root).
        """
        if ask_for and __debug__:
            for key in ask_for:
                if key not in ALL_KEYS:
                    raise ValueError('invalid key %r' % key)
            if ask_for_optional:
                for key in ask_for_optional:
                    if key not in ALL_KEYS:
                        raise ValueError('invalid optional key %r' % key)
        try:
            consumer = Consumer(SessionWrapper(self), self.store_factory())
            auth_request = consumer.begin(identity_url)
            if ask_for or ask_for_optional:
                self.attach_reg_info(auth_request, ask_for, ask_for_optional)
            if extensions:
                for extension in extensions:
                    auth_request.addExtension(extension)
        except discover.DiscoveryFailure:
            self.signal_error(u'The OpenID was invalid')
            return redirect(self.get_current_url())
        if self.url_root_as_trust_root:
            trust_root = request.url_root
        else:
            trust_root = request.host_url
        return redirect(auth_request.redirectURL(trust_root,
                                                 self.get_success_url(),
                                                 immediate=immediate))
