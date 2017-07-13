import hashlib
import logging
import os
import warnings
from functools import wraps

from flask import Blueprint, current_app, g, request, session
from itsdangerous import BadData, SignatureExpired, URLSafeTimedSerializer
from werkzeug.exceptions import BadRequest
from werkzeug.security import safe_str_cmp
from wtforms import ValidationError
from wtforms.csrf.core import CSRF

from ._compat import FlaskWTFDeprecationWarning, string_types, urlparse

__all__ = ('generate_csrf', 'validate_csrf', 'CSRFProtect')
logger = logging.getLogger(__name__)


def generate_csrf(secret_key=None, token_key=None):
    """Generate a CSRF token. The token is cached for a request, so multiple
    calls to this function will generate the same token.

    During testing, it might be useful to access the signed token in
    ``g.csrf_token`` and the raw token in ``session['csrf_token']``.

    :param secret_key: Used to securely sign the token. Default is
        ``WTF_CSRF_SECRET_KEY`` or ``SECRET_KEY``.
    :param token_key: Key where token is stored in session for comparision.
        Default is ``WTF_CSRF_FIELD_NAME`` or ``'csrf_token'``.
    """

    secret_key = _get_config(
        secret_key, 'WTF_CSRF_SECRET_KEY', current_app.secret_key,
        message='A secret key is required to use CSRF.'
    )
    field_name = _get_config(
        token_key, 'WTF_CSRF_FIELD_NAME', 'csrf_token',
        message='A field name is required to use CSRF.'
    )

    if field_name not in g:
        if field_name not in session:
            session[field_name] = hashlib.sha1(os.urandom(64)).hexdigest()

        s = URLSafeTimedSerializer(secret_key, salt='wtf-csrf-token')
        setattr(g, field_name, s.dumps(session[field_name]))

    return g.get(field_name)


def validate_csrf(data, secret_key=None, time_limit=None, token_key=None):
    """Check if the given data is a valid CSRF token. This compares the given
    signed token to the one stored in the session.

    :param data: The signed CSRF token to be checked.
    :param secret_key: Used to securely sign the token. Default is
        ``WTF_CSRF_SECRET_KEY`` or ``SECRET_KEY``.
    :param time_limit: Number of seconds that the token is valid. Default is
        ``WTF_CSRF_TIME_LIMIT`` or 3600 seconds (60 minutes).
    :param token_key: Key where token is stored in session for comparision.
        Default is ``WTF_CSRF_FIELD_NAME`` or ``'csrf_token'``.

    :raises ValidationError: Contains the reason that validation failed.

    .. versionchanged:: 0.14
        Raises ``ValidationError`` with a specific error message rather than
        returning ``True`` or ``False``.
    """

    secret_key = _get_config(
        secret_key, 'WTF_CSRF_SECRET_KEY', current_app.secret_key,
        message='A secret key is required to use CSRF.'
    )
    field_name = _get_config(
        token_key, 'WTF_CSRF_FIELD_NAME', 'csrf_token',
        message='A field name is required to use CSRF.'
    )
    time_limit = _get_config(
        time_limit, 'WTF_CSRF_TIME_LIMIT', 3600, required=False
    )

    if not data:
        raise ValidationError('The CSRF token is missing.')

    if field_name not in session:
        raise ValidationError('The CSRF session token is missing.')

    s = URLSafeTimedSerializer(secret_key, salt='wtf-csrf-token')

    try:
        token = s.loads(data, max_age=time_limit)
    except SignatureExpired:
        raise ValidationError('The CSRF token has expired.')
    except BadData:
        raise ValidationError('The CSRF token is invalid.')

    if not safe_str_cmp(session[field_name], token):
        raise ValidationError('The CSRF tokens do not match.')


def _get_config(
    value, config_name, default=None,
    required=True, message='CSRF is not configured.'
):
    """Find config value based on provided value, Flask config, and default
    value.

    :param value: already provided config value
    :param config_name: Flask ``config`` key
    :param default: default value if not provided or configured
    :param required: whether the value must not be ``None``
    :param message: error message if required config is not found
    :raises KeyError: if required config is not found
    """

    if value is None:
        value = current_app.config.get(config_name, default)

    if required and value is None:
        raise KeyError(message)

    return value


class _FlaskFormCSRF(CSRF):
    def setup_form(self, form):
        self.meta = form.meta
        return super(_FlaskFormCSRF, self).setup_form(form)

    def generate_csrf_token(self, csrf_token_field):
        return generate_csrf(
            secret_key=self.meta.csrf_secret,
            token_key=self.meta.csrf_field_name
        )

    def validate_csrf_token(self, form, field):
        if g.get('csrf_valid', False):
            # already validated by CSRFProtect
            return

        try:
            validate_csrf(
                field.data,
                self.meta.csrf_secret,
                self.meta.csrf_time_limit,
                self.meta.csrf_field_name
            )
        except ValidationError as e:
            logger.info(e.args[0])
            raise


class CSRFProtect(object):
    """Enable CSRF protection globally for a Flask app.

    ::

        app = Flask(__name__)
        csrf = CsrfProtect(app)

    Checks the ``csrf_token`` field sent with forms, or the ``X-CSRFToken``
    header sent with JavaScript requests. Render the token in templates using
    ``{{ csrf_token() }}``.

    See the :ref:`csrf` documentation.
    """

    def __init__(self, app=None):
        self._exempt_views = set()
        self._exempt_blueprints = set()

        if app:
            self.init_app(app)

    def init_app(self, app):
        app.extensions['csrf'] = self

        app.config.setdefault('WTF_CSRF_ENABLED', True)
        app.config.setdefault('WTF_CSRF_CHECK_DEFAULT', True)
        app.config['WTF_CSRF_METHODS'] = set(app.config.get(
            'WTF_CSRF_METHODS', ['POST', 'PUT', 'PATCH', 'DELETE']
        ))
        app.config.setdefault('WTF_CSRF_FIELD_NAME', 'csrf_token')
        app.config.setdefault(
            'WTF_CSRF_HEADERS', ['X-CSRFToken', 'X-CSRF-Token']
        )
        app.config.setdefault('WTF_CSRF_TIME_LIMIT', 3600)
        app.config.setdefault('WTF_CSRF_SSL_STRICT', True)

        app.jinja_env.globals['csrf_token'] = generate_csrf
        app.context_processor(lambda: {'csrf_token': generate_csrf})

        @app.before_request
        def csrf_protect():
            if not app.config['WTF_CSRF_ENABLED']:
                return

            if not app.config['WTF_CSRF_CHECK_DEFAULT']:
                return

            if request.method not in app.config['WTF_CSRF_METHODS']:
                return

            if not request.endpoint:
                return

            view = app.view_functions.get(request.endpoint)

            if not view:
                return

            if request.blueprint in self._exempt_blueprints:
                return

            dest = '%s.%s' % (view.__module__, view.__name__)

            if dest in self._exempt_views:
                return

            self.protect()

    def _get_csrf_token(self):
        # find the ``csrf_token`` field in the subitted form
        # if the form had a prefix, the name will be
        # ``{prefix}-csrf_token``
        field_name = current_app.config['WTF_CSRF_FIELD_NAME']

        for key in request.form:
            if key.endswith(field_name):
                csrf_token = request.form[key]

                if csrf_token:
                    return csrf_token

        for header_name in current_app.config['WTF_CSRF_HEADERS']:
            csrf_token = request.headers.get(header_name)

            if csrf_token:
                return csrf_token

        return None

    def protect(self):
        if request.method not in current_app.config['WTF_CSRF_METHODS']:
            return

        try:
            validate_csrf(self._get_csrf_token())
        except ValidationError as e:
            logger.info(e.args[0])
            self._error_response(e.args[0])

        if request.is_secure and current_app.config['WTF_CSRF_SSL_STRICT']:
            if not request.referrer:
                self._error_response('The referrer header is missing.')

            good_referrer = 'https://{0}/'.format(request.host)

            if not same_origin(request.referrer, good_referrer):
                self._error_response('The referrer does not match the host.')

        g.csrf_valid = True  # mark this request as CSRF valid

    def exempt(self, view):
        """Mark a view or blueprint to be excluded from CSRF protection.

        ::

            @app.route('/some-view', methods=['POST'])
            @csrf.exempt
            def some_view():
                ...

        ::

            bp = Blueprint(...)
            csrf.exempt(bp)

        """

        if isinstance(view, Blueprint):
            self._exempt_blueprints.add(view.name)
            return view

        if isinstance(view, string_types):
            view_location = view
        else:
            view_location = '%s.%s' % (view.__module__, view.__name__)

        self._exempt_views.add(view_location)
        return view

    def _error_response(self, reason):
        raise CSRFError(reason)

    def error_handler(self, view):
        """Register a function that will generate the response for CSRF errors.

        .. deprecated:: 0.14
            Use the standard Flask error system with
            ``@app.errorhandler(CSRFError)`` instead. This will be removed in
            version 1.0.

        The function will be passed one argument, ``reason``. By default it will
        raise a :class:`~flask_wtf.csrf.CSRFError`. ::

            @csrf.error_handler
            def csrf_error(reason):
                return render_template('error.html', reason=reason)

        Due to historical reasons, the function may either return a response
        or raise an exception with :func:`flask.abort`.
        """

        warnings.warn(FlaskWTFDeprecationWarning(
            '"@csrf.error_handler" is deprecated. Use the standard Flask error '
            'system with "@app.errorhandler(CSRFError)" instead. This will be'
            'removed in 1.0.'
        ), stacklevel=2)

        @wraps(view)
        def handler(reason):
            response = current_app.make_response(view(reason))
            raise CSRFError(response.get_data(as_text=True), response=response)

        self._error_response = handler
        return view


class CsrfProtect(CSRFProtect):
    """
    .. deprecated:: 0.14
        Renamed to :class:`~flask_wtf.csrf.CSRFProtect`.
    """

    def __init__(self, app=None):
        warnings.warn(FlaskWTFDeprecationWarning(
            '"flask_wtf.CsrfProtect" has been renamed to "CSRFProtect" '
            'and will be removed in 1.0.'
        ), stacklevel=2)
        super(CsrfProtect, self).__init__(app=app)


class CSRFError(BadRequest):
    """Raise if the client sends invalid CSRF data with the request.

    Generates a 400 Bad Request response with the failure reason by default.
    Customize the response by registering a handler with
    :meth:`flask.Flask.errorhandler`.
    """

    description = 'CSRF validation failed.'


def same_origin(current_uri, compare_uri):
    current = urlparse(current_uri)
    compare = urlparse(compare_uri)

    return (
        current.scheme == compare.scheme
        and current.hostname == compare.hostname
        and current.port == compare.port
    )
