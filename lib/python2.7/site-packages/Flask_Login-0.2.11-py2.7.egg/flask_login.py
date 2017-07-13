# -*- coding: utf-8 -*-
'''
    flask.ext.login
    ---------------

    This module provides user session management for Flask. It lets you log
    your users in and out in a database-independent manner.

    :copyright: (c) 2011 by Matthew Frazier.
    :license: MIT/X11, see LICENSE for more details.
'''

__version_info__ = ('0', '2', '11')
__version__ = '.'.join(__version_info__)
__author__ = 'Matthew Frazier'
__license__ = 'MIT/X11'
__copyright__ = '(c) 2011 by Matthew Frazier'
__all__ = ['LoginManager']

from flask import (_request_ctx_stack, abort, current_app, flash, redirect,
                   request, session, url_for, has_request_context)
from flask.signals import Namespace

from werkzeug.local import LocalProxy
from werkzeug.security import safe_str_cmp
from werkzeug.urls import url_decode, url_encode

from datetime import datetime, timedelta
from functools import wraps
from hashlib import sha1, md5

import hmac
import warnings
import sys

if sys.version < '3':  # pragma: no cover
    from urlparse import urlparse, urlunparse
else:  # pragma: no cover
    from urllib.parse import urlparse, urlunparse
    unicode = str

_signals = Namespace()

#: A proxy for the current user. If no user is logged in, this will be an
#: anonymous user
current_user = LocalProxy(lambda: _get_user())

#: The default name of the "remember me" cookie (``remember_token``)
COOKIE_NAME = 'remember_token'

#: The default time before the "remember me" cookie expires (365 days).
COOKIE_DURATION = timedelta(days=365)

#: Whether the "remember me" cookie requires Secure; defaults to ``None``
COOKIE_SECURE = None

#: Whether the "remember me" cookie uses HttpOnly or not; defaults to ``False``
COOKIE_HTTPONLY = False

#: The default flash message to display when users need to log in.
LOGIN_MESSAGE = u'Please log in to access this page.'

#: The default flash message category to display when users need to log in.
LOGIN_MESSAGE_CATEGORY = 'message'

#: The default flash message to display when users need to reauthenticate.
REFRESH_MESSAGE = u'Please reauthenticate to access this page.'

#: The default flash message category to display when users need to
#: reauthenticate.
REFRESH_MESSAGE_CATEGORY = 'message'

#: The default attribute to retreive the unicode id of the user
ID_ATTRIBUTE = 'get_id'

#: Default name of the auth header (``Authorization``)
AUTH_HEADER_NAME = 'Authorization'


class LoginManager(object):
    '''
    This object is used to hold the settings used for logging in. Instances of
    :class:`LoginManager` are *not* bound to specific apps, so you can create
    one in the main body of your code and then bind it to your
    app in a factory function.
    '''
    def __init__(self, app=None, add_context_processor=True):
        #: A class or factory function that produces an anonymous user, which
        #: is used when no one is logged in.
        self.anonymous_user = AnonymousUserMixin

        #: The name of the view to redirect to when the user needs to log in.
        #: (This can be an absolute URL as well, if your authentication
        #: machinery is external to your application.)
        self.login_view = None

        #: The message to flash when a user is redirected to the login page.
        self.login_message = LOGIN_MESSAGE

        #: The message category to flash when a user is redirected to the login
        #: page.
        self.login_message_category = LOGIN_MESSAGE_CATEGORY

        #: The name of the view to redirect to when the user needs to
        #: reauthenticate.
        self.refresh_view = None

        #: The message to flash when a user is redirected to the 'needs
        #: refresh' page.
        self.needs_refresh_message = REFRESH_MESSAGE

        #: The message category to flash when a user is redirected to the
        #: 'needs refresh' page.
        self.needs_refresh_message_category = REFRESH_MESSAGE_CATEGORY

        #: The mode to use session protection in. This can be either
        #: ``'basic'`` (the default) or ``'strong'``, or ``None`` to disable
        #: it.
        self.session_protection = 'basic'

        #: If present, used to translate flash messages ``self.login_message``
        #: and ``self.needs_refresh_message``
        self.localize_callback = None

        self.token_callback = None

        self.user_callback = None

        self.unauthorized_callback = None

        self.needs_refresh_callback = None

        self.id_attribute = ID_ATTRIBUTE

        self.header_callback = None

        self.request_callback = None

        if app is not None:
            self.init_app(app, add_context_processor)

    def setup_app(self, app, add_context_processor=True):  # pragma: no cover
        '''
        This method has been deprecated. Please use
        :meth:`LoginManager.init_app` instead.
        '''
        warnings.warn('Warning setup_app is deprecated. Please use init_app.',
                      DeprecationWarning)
        self.init_app(app, add_context_processor)

    def init_app(self, app, add_context_processor=True):
        '''
        Configures an application. This registers an `after_request` call, and
        attaches this `LoginManager` to it as `app.login_manager`.

        :param app: The :class:`flask.Flask` object to configure.
        :type app: :class:`flask.Flask`
        :param add_context_processor: Whether to add a context processor to
            the app that adds a `current_user` variable to the template.
            Defaults to ``True``.
        :type add_context_processor: bool
        '''
        app.login_manager = self
        app.after_request(self._update_remember_cookie)

        self._login_disabled = app.config.get('LOGIN_DISABLED',
                                              app.config.get('TESTING', False))

        if add_context_processor:
            app.context_processor(_user_context_processor)

    def unauthorized(self):
        '''
        This is called when the user is required to log in. If you register a
        callback with :meth:`LoginManager.unauthorized_handler`, then it will
        be called. Otherwise, it will take the following actions:

            - Flash :attr:`LoginManager.login_message` to the user.

            - Redirect the user to `login_view`. (The page they were attempting
              to access will be passed in the ``next`` query string variable,
              so you can redirect there if present instead of the homepage.)

        If :attr:`LoginManager.login_view` is not defined, then it will simply
        raise a HTTP 401 (Unauthorized) error instead.

        This should be returned from a view or before/after_request function,
        otherwise the redirect will have no effect.
        '''
        user_unauthorized.send(current_app._get_current_object())

        if self.unauthorized_callback:
            return self.unauthorized_callback()

        if not self.login_view:
            abort(401)

        if self.login_message:
            if self.localize_callback is not None:
                flash(self.localize_callback(self.login_message),
                      category=self.login_message_category)
            else:
                flash(self.login_message, category=self.login_message_category)

        return redirect(login_url(self.login_view, request.url))

    def user_loader(self, callback):
        '''
        This sets the callback for reloading a user from the session. The
        function you set should take a user ID (a ``unicode``) and return a
        user object, or ``None`` if the user does not exist.

        :param callback: The callback for retrieving a user object.
        :type callback: unicode
        '''
        self.user_callback = callback
        return callback

    def header_loader(self, callback):
        '''
        This sets the callback for loading a user from a header value.
        The function you set should take an authentication token and
        return a user object, or `None` if the user does not exist.

        :param callback: The callback for retrieving a user object.
        '''
        self.header_callback = callback
        return callback

    def request_loader(self, callback):
        '''
        This sets the callback for loading a user from a Flask request.
        The function you set should take Flask request object and
        return a user object, or `None` if the user does not exist.

        :param callback: The callback for retrieving a user object.
        '''
        self.request_callback = callback
        return callback

    def token_loader(self, callback):
        '''
        This sets the callback for loading a user from an authentication
        token. The function you set should take an authentication token
        (a ``unicode``, as returned by a user's `get_auth_token` method) and
        return a user object, or ``None`` if the user does not exist.

        :param callback: The callback for retrieving a user object.
        :type callback: unicode
        '''
        self.token_callback = callback
        return callback

    def unauthorized_handler(self, callback):
        '''
        This will set the callback for the `unauthorized` method, which among
        other things is used by `login_required`. It takes no arguments, and
        should return a response to be sent to the user instead of their
        normal view.

        :param callback: The callback for unauthorized users.
        :type callback: function
        '''
        self.unauthorized_callback = callback
        return callback

    def needs_refresh_handler(self, callback):
        '''
        This will set the callback for the `needs_refresh` method, which among
        other things is used by `fresh_login_required`. It takes no arguments,
        and should return a response to be sent to the user instead of their
        normal view.

        :param callback: The callback for unauthorized users.
        :type callback: function
        '''
        self.needs_refresh_callback = callback
        return callback

    def needs_refresh(self):
        '''
        This is called when the user is logged in, but they need to be
        reauthenticated because their session is stale. If you register a
        callback with `needs_refresh_handler`, then it will be called.
        Otherwise, it will take the following actions:

            - Flash :attr:`LoginManager.needs_refresh_message` to the user.

            - Redirect the user to :attr:`LoginManager.refresh_view`. (The page
              they were attempting to access will be passed in the ``next``
              query string variable, so you can redirect there if present
              instead of the homepage.)

        If :attr:`LoginManager.refresh_view` is not defined, then it will
        simply raise a HTTP 403 (Forbidden) error instead.

        This should be returned from a view or before/after_request function,
        otherwise the redirect will have no effect.
        '''
        user_needs_refresh.send(current_app._get_current_object())

        if self.needs_refresh_callback:
            return self.needs_refresh_callback()

        if not self.refresh_view:
            abort(403)

        if self.localize_callback is not None:
            flash(self.localize_callback(self.needs_refresh_message),
                  category=self.needs_refresh_message_category)
        else:
            flash(self.needs_refresh_message,
                  category=self.needs_refresh_message_category)

        return redirect(login_url(self.refresh_view, request.url))

    def reload_user(self, user=None):
        ctx = _request_ctx_stack.top

        if user is None:
            user_id = session.get('user_id')
            if user_id is None:
                ctx.user = self.anonymous_user()
            else:
                user = self.user_callback(user_id)
                if user is None:
                    logout_user()
                else:
                    ctx.user = user
        else:
            ctx.user = user

    def _load_user(self):
        '''Loads user from session or remember_me cookie as applicable'''
        user_accessed.send(current_app._get_current_object())

        # first check SESSION_PROTECTION
        config = current_app.config
        if config.get('SESSION_PROTECTION', self.session_protection):
            deleted = self._session_protection()
            if deleted:
                return self.reload_user()

        # If a remember cookie is set, and the session is not, move the
        # cookie user ID to the session.
        #
        # However, the session may have been set if the user has been
        # logged out on this request, 'remember' would be set to clear,
        # so we should check for that and not restore the session.
        is_missing_user_id = 'user_id' not in session
        if is_missing_user_id:
            cookie_name = config.get('REMEMBER_COOKIE_NAME', COOKIE_NAME)
            header_name = config.get('AUTH_HEADER_NAME', AUTH_HEADER_NAME)
            has_cookie = (cookie_name in request.cookies and
                          session.get('remember') != 'clear')
            if has_cookie:
                return self._load_from_cookie(request.cookies[cookie_name])
            elif self.request_callback:
                return self._load_from_request(request)
            elif header_name in request.headers:
                return self._load_from_header(request.headers[header_name])

        return self.reload_user()

    def _session_protection(self):
        sess = session._get_current_object()
        ident = _create_identifier()

        app = current_app._get_current_object()
        mode = app.config.get('SESSION_PROTECTION', self.session_protection)

        # if there is no '_id', then take the current one for good
        if '_id' not in sess:
            sess['_id'] = ident

        # if the sess is empty, it's an anonymous user, or just logged out
        #  so we can skip this, unless 'strong' protection is active,
        #  in which case we need to double check for the remember me token
        check_protection = sess or mode == 'strong'

        if check_protection and ident != sess.get('_id', None):
            if mode == 'basic' or sess.permanent:
                sess['_fresh'] = False
                session_protected.send(app)
                return False
            elif mode == 'strong':
                sess.clear()
                sess['remember'] = 'clear'
                session_protected.send(app)
                return True

        return False

    def _load_from_cookie(self, cookie):
        if self.token_callback:
            user = self.token_callback(cookie)
            if user is not None:
                session['user_id'] = getattr(user, self.id_attribute)()
                session['_fresh'] = False
                _request_ctx_stack.top.user = user
            else:
                self.reload_user()
        else:
            user_id = decode_cookie(cookie)
            if user_id is not None:
                session['user_id'] = user_id
                session['_fresh'] = False

            self.reload_user()

        if _request_ctx_stack.top.user is not None:
            app = current_app._get_current_object()
            user_loaded_from_cookie.send(app, user=_get_user())

    def _load_from_header(self, header):
        user = None
        if self.header_callback:
            user = self.header_callback(header)
        if user is not None:
            self.reload_user(user=user)
            app = current_app._get_current_object()
            user_loaded_from_header.send(app, user=_get_user())
        else:
            self.reload_user()

    def _load_from_request(self, request):
        user = None
        if self.request_callback:
            user = self.request_callback(request)
        if user is not None:
            self.reload_user(user=user)
            app = current_app._get_current_object()
            user_loaded_from_request.send(app, user=_get_user())
        else:
            self.reload_user()

    def _update_remember_cookie(self, response):
        # Don't modify the session unless there's something to do.
        if 'remember' in session:
            operation = session.pop('remember', None)

            if operation == 'set' and 'user_id' in session:
                self._set_cookie(response)
            elif operation == 'clear':
                self._clear_cookie(response)

        return response

    def _set_cookie(self, response):
        # cookie settings
        config = current_app.config
        cookie_name = config.get('REMEMBER_COOKIE_NAME', COOKIE_NAME)
        duration = config.get('REMEMBER_COOKIE_DURATION', COOKIE_DURATION)
        domain = config.get('REMEMBER_COOKIE_DOMAIN')

        secure = config.get('REMEMBER_COOKIE_SECURE', COOKIE_SECURE)
        httponly = config.get('REMEMBER_COOKIE_HTTPONLY', COOKIE_HTTPONLY)

        # prepare data
        if self.token_callback:
            data = current_user.get_auth_token()
        else:
            data = encode_cookie(str(session['user_id']))
        expires = datetime.utcnow() + duration

        # actually set it
        response.set_cookie(cookie_name,
                            value=data,
                            expires=expires,
                            domain=domain,
                            secure=secure,
                            httponly=httponly)

    def _clear_cookie(self, response):
        config = current_app.config
        cookie_name = config.get('REMEMBER_COOKIE_NAME', COOKIE_NAME)
        domain = config.get('REMEMBER_COOKIE_DOMAIN')
        response.delete_cookie(cookie_name, domain=domain)


class UserMixin(object):
    '''
    This provides default implementations for the methods that Flask-Login
    expects user objects to have.
    '''
    def is_active(self):
        return True

    def is_authenticated(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        try:
            return unicode(self.id)
        except AttributeError:
            raise NotImplementedError('No `id` attribute - override `get_id`')

    def __eq__(self, other):
        '''
        Checks the equality of two `UserMixin` objects using `get_id`.
        '''
        if isinstance(other, UserMixin):
            return self.get_id() == other.get_id()
        return NotImplemented

    def __ne__(self, other):
        '''
        Checks the inequality of two `UserMixin` objects using `get_id`.
        '''
        equal = self.__eq__(other)
        if equal is NotImplemented:
            return NotImplemented
        return not equal

    if sys.version_info[0] != 2:  # pragma: no cover
        # Python 3 implicitly set __hash__ to None if we override __eq__
        # We set it back to its default implementation
        __hash__ = object.__hash__


class AnonymousUserMixin(object):
    '''
    This is the default object for representing an anonymous user.
    '''
    def is_authenticated(self):
        return False

    def is_active(self):
        return False

    def is_anonymous(self):
        return True

    def get_id(self):
        return


def encode_cookie(payload):
    '''
    This will encode a ``unicode`` value into a cookie, and sign that cookie
    with the app's secret key.

    :param payload: The value to encode, as `unicode`.
    :type payload: unicode
    '''
    return u'{0}|{1}'.format(payload, _cookie_digest(payload))


def decode_cookie(cookie):
    '''
    This decodes a cookie given by `encode_cookie`. If verification of the
    cookie fails, ``None`` will be implicitly returned.

    :param cookie: An encoded cookie.
    :type cookie: str
    '''
    try:
        payload, digest = cookie.rsplit(u'|', 1)
        if hasattr(digest, 'decode'):
            digest = digest.decode('ascii')  # pragma: no cover
    except ValueError:
        return

    if safe_str_cmp(_cookie_digest(payload), digest):
        return payload


def make_next_param(login_url, current_url):
    '''
    Reduces the scheme and host from a given URL so it can be passed to
    the given `login` URL more efficiently.

    :param login_url: The login URL being redirected to.
    :type login_url: str
    :param current_url: The URL to reduce.
    :type current_url: str
    '''
    l = urlparse(login_url)
    c = urlparse(current_url)

    if (not l.scheme or l.scheme == c.scheme) and \
            (not l.netloc or l.netloc == c.netloc):
        return urlunparse(('', '', c.path, c.params, c.query, ''))
    return current_url


def login_url(login_view, next_url=None, next_field='next'):
    '''
    Creates a URL for redirecting to a login page. If only `login_view` is
    provided, this will just return the URL for it. If `next_url` is provided,
    however, this will append a ``next=URL`` parameter to the query string
    so that the login view can redirect back to that URL.

    :param login_view: The name of the login view. (Alternately, the actual
                       URL to the login view.)
    :type login_view: str
    :param next_url: The URL to give the login view for redirection.
    :type next_url: str
    :param next_field: What field to store the next URL in. (It defaults to
                       ``next``.)
    :type next_field: str
    '''
    if login_view.startswith(('https://', 'http://', '/')):
        base = login_view
    else:
        base = url_for(login_view)

    if next_url is None:
        return base

    parts = list(urlparse(base))
    md = url_decode(parts[4])
    md[next_field] = make_next_param(base, next_url)
    parts[4] = url_encode(md, sort=True)
    return urlunparse(parts)


def make_secure_token(*args, **options):
    '''
    This will create a secure token that you can use as an authentication
    token for your users. It uses heavy-duty HMAC encryption to prevent people
    from guessing the information. (To make it even more effective, if you
    will never need to regenerate the token, you can  pass some random data
    as one of the arguments.)

    :param \*args: The data to include in the token.
    :type args: args
    :param \*\*options: To manually specify a secret key, pass ``key=THE_KEY``.
        Otherwise, the ``current_app`` secret key will be used.
    :type \*\*options: kwargs
    '''
    key = options.get('key')
    key = _secret_key(key)

    l = [s if isinstance(s, bytes) else s.encode('utf-8') for s in args]

    payload = b'\0'.join(l)

    token_value = hmac.new(key, payload, sha1).hexdigest()

    if hasattr(token_value, 'decode'):  # pragma: no cover
        token_value = token_value.decode('utf-8')  # ensure bytes

    return token_value


def login_fresh():
    '''
    This returns ``True`` if the current login is fresh.
    '''
    return session.get('_fresh', False)


def login_user(user, remember=False, force=False):
    '''
    Logs a user in. You should pass the actual user object to this. If the
    user's `is_active` method returns ``False``, they will not be logged in
    unless `force` is ``True``.

    This will return ``True`` if the log in attempt succeeds, and ``False`` if
    it fails (i.e. because the user is inactive).

    :param user: The user object to log in.
    :type user: object
    :param remember: Whether to remember the user after their session expires.
        Defaults to ``False``.
    :type remember: bool
    :param force: If the user is inactive, setting this to ``True`` will log
        them in regardless. Defaults to ``False``.
    :type force: bool
    '''
    if not force and not user.is_active():
        return False

    user_id = getattr(user, current_app.login_manager.id_attribute)()
    session['user_id'] = user_id
    session['_fresh'] = True
    session['_id'] = _create_identifier()

    if remember:
        session['remember'] = 'set'

    _request_ctx_stack.top.user = user
    user_logged_in.send(current_app._get_current_object(), user=_get_user())
    return True


def logout_user():
    '''
    Logs a user out. (You do not need to pass the actual user.) This will
    also clean up the remember me cookie if it exists.
    '''
    if 'user_id' in session:
        session.pop('user_id')

    if '_fresh' in session:
        session.pop('_fresh')

    cookie_name = current_app.config.get('REMEMBER_COOKIE_NAME', COOKIE_NAME)
    if cookie_name in request.cookies:
        session['remember'] = 'clear'

    user = _get_user()
    if user is not None and not user.is_anonymous():
        user_logged_out.send(current_app._get_current_object(), user=user)

    current_app.login_manager.reload_user()
    return True


def confirm_login():
    '''
    This sets the current session as fresh. Sessions become stale when they
    are reloaded from a cookie.
    '''
    session['_fresh'] = True
    session['_id'] = _create_identifier()
    user_login_confirmed.send(current_app._get_current_object())


def login_required(func):
    '''
    If you decorate a view with this, it will ensure that the current user is
    logged in and authenticated before calling the actual view. (If they are
    not, it calls the :attr:`LoginManager.unauthorized` callback.) For
    example::

        @app.route('/post')
        @login_required
        def post():
            pass

    If there are only certain times you need to require that your user is
    logged in, you can do so with::

        if not current_user.is_authenticated():
            return current_app.login_manager.unauthorized()

    ...which is essentially the code that this function adds to your views.

    It can be convenient to globally turn off authentication when unit
    testing. To enable this, if either of the application
    configuration variables `LOGIN_DISABLED` or `TESTING` is set to
    `True`, this decorator will be ignored.

    :param func: The view function to decorate.
    :type func: function
    '''
    @wraps(func)
    def decorated_view(*args, **kwargs):
        if current_app.login_manager._login_disabled:
            return func(*args, **kwargs)
        elif not current_user.is_authenticated():
            return current_app.login_manager.unauthorized()
        return func(*args, **kwargs)
    return decorated_view


def fresh_login_required(func):
    '''
    If you decorate a view with this, it will ensure that the current user's
    login is fresh - i.e. there session was not restored from a 'remember me'
    cookie. Sensitive operations, like changing a password or e-mail, should
    be protected with this, to impede the efforts of cookie thieves.

    If the user is not authenticated, :meth:`LoginManager.unauthorized` is
    called as normal. If they are authenticated, but their session is not
    fresh, it will call :meth:`LoginManager.needs_refresh` instead. (In that
    case, you will need to provide a :attr:`LoginManager.refresh_view`.)

    Behaves identically to the :func:`login_required` decorator with respect
    to configutation variables.

    :param func: The view function to decorate.
    :type func: function
    '''
    @wraps(func)
    def decorated_view(*args, **kwargs):
        if current_app.login_manager._login_disabled:
            return func(*args, **kwargs)
        elif not current_user.is_authenticated():
            return current_app.login_manager.unauthorized()
        elif not login_fresh():
            return current_app.login_manager.needs_refresh()
        return func(*args, **kwargs)
    return decorated_view


def _get_user():
    if has_request_context() and not hasattr(_request_ctx_stack.top, 'user'):
        current_app.login_manager._load_user()

    return getattr(_request_ctx_stack.top, 'user', None)


def _cookie_digest(payload, key=None):
    key = _secret_key(key)

    return hmac.new(key, payload.encode('utf-8'), sha1).hexdigest()


def _get_remote_addr():
    address = request.headers.get('X-Forwarded-For', request.remote_addr)
    if address is not None:
        address = address.encode('utf-8')
    return address


def _create_identifier():
    user_agent = request.headers.get('User-Agent')
    if user_agent is not None:
        user_agent = user_agent.encode('utf-8')
    base = '{0}|{1}'.format(_get_remote_addr(), user_agent)
    if str is bytes:
        base = unicode(base, 'utf-8', errors='replace')  # pragma: no cover
    h = md5()
    h.update(base.encode('utf8'))
    return h.hexdigest()


def _user_context_processor():
    return dict(current_user=_get_user())


def _secret_key(key=None):
    if key is None:
        key = current_app.config['SECRET_KEY']

    if isinstance(key, unicode):  # pragma: no cover
        key = key.encode('latin1')  # ensure bytes

    return key


# Signals

#: Sent when a user is logged in. In addition to the app (which is the
#: sender), it is passed `user`, which is the user being logged in.
user_logged_in = _signals.signal('logged-in')

#: Sent when a user is logged out. In addition to the app (which is the
#: sender), it is passed `user`, which is the user being logged out.
user_logged_out = _signals.signal('logged-out')

#: Sent when the user is loaded from the cookie. In addition to the app (which
#: is the sender), it is passed `user`, which is the user being reloaded.
user_loaded_from_cookie = _signals.signal('loaded-from-cookie')

#: Sent when the user is loaded from the header. In addition to the app (which
#: is the #: sender), it is passed `user`, which is the user being reloaded.
user_loaded_from_header = _signals.signal('loaded-from-header')

#: Sent when the user is loaded from the request. In addition to the app (which
#: is the #: sender), it is passed `user`, which is the user being reloaded.
user_loaded_from_request = _signals.signal('loaded-from-request')

#: Sent when a user's login is confirmed, marking it as fresh. (It is not
#: called for a normal login.)
#: It receives no additional arguments besides the app.
user_login_confirmed = _signals.signal('login-confirmed')

#: Sent when the `unauthorized` method is called on a `LoginManager`. It
#: receives no additional arguments besides the app.
user_unauthorized = _signals.signal('unauthorized')

#: Sent when the `needs_refresh` method is called on a `LoginManager`. It
#: receives no additional arguments besides the app.
user_needs_refresh = _signals.signal('needs-refresh')

#: Sent whenever the user is accessed/loaded
#: receives no additional arguments besides the app.
user_accessed = _signals.signal('accessed')

#: Sent whenever session protection takes effect, and a session is either
#: marked non-fresh or deleted. It receives no additional arguments besides
#: the app.
session_protected = _signals.signal('session-protected')
