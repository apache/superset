"""
A provided CSRF implementation which puts CSRF data in a session.

This can be used fairly comfortably with many `request.session` type
objects, including the Werkzeug/Flask session store, Django sessions, and
potentially other similar objects which use a dict-like API for storing
session keys.

The basic concept is a randomly generated value is stored in the user's
session, and an hmac-sha1 of it (along with an optional expiration time,
for extra security) is used as the value of the csrf_token. If this token
validates with the hmac of the random value + expiration time, and the
expiration time is not passed, the CSRF validation will pass.
"""
from __future__ import unicode_literals

import hmac
import os

from hashlib import sha1
from datetime import datetime, timedelta

from ...validators import ValidationError
from .form import SecureForm

__all__ = ('SessionSecureForm', )


class SessionSecureForm(SecureForm):
    TIME_FORMAT = '%Y%m%d%H%M%S'
    TIME_LIMIT = timedelta(minutes=30)
    SECRET_KEY = None

    def generate_csrf_token(self, csrf_context):
        if self.SECRET_KEY is None:
            raise Exception('must set SECRET_KEY in a subclass of this form for it to work')
        if csrf_context is None:
            raise TypeError('Must provide a session-like object as csrf context')

        session = getattr(csrf_context, 'session', csrf_context)

        if 'csrf' not in session:
            session['csrf'] = sha1(os.urandom(64)).hexdigest()

        self.csrf_token.csrf_key = session['csrf']
        if self.TIME_LIMIT:
            expires = (datetime.now() + self.TIME_LIMIT).strftime(self.TIME_FORMAT)
            csrf_build = '%s%s' % (session['csrf'], expires)
        else:
            expires = ''
            csrf_build = session['csrf']

        hmac_csrf = hmac.new(self.SECRET_KEY, csrf_build.encode('utf8'), digestmod=sha1)
        return '%s##%s' % (expires, hmac_csrf.hexdigest())

    def validate_csrf_token(self, field):
        if not field.data or '##' not in field.data:
            raise ValidationError(field.gettext('CSRF token missing'))

        expires, hmac_csrf = field.data.split('##')

        check_val = (field.csrf_key + expires).encode('utf8')

        hmac_compare = hmac.new(self.SECRET_KEY, check_val, digestmod=sha1)
        if hmac_compare.hexdigest() != hmac_csrf:
            raise ValidationError(field.gettext('CSRF failed'))

        if self.TIME_LIMIT:
            now_formatted = datetime.now().strftime(self.TIME_FORMAT)
            if now_formatted > expires:
                raise ValidationError(field.gettext('CSRF token expired'))
