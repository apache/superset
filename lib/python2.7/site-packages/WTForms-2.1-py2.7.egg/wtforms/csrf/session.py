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

from ..validators import ValidationError
from .core import CSRF

__all__ = ('SessionCSRF', )


class SessionCSRF(CSRF):
    TIME_FORMAT = '%Y%m%d%H%M%S'

    def setup_form(self, form):
        self.form_meta = form.meta
        return super(SessionCSRF, self).setup_form(form)

    def generate_csrf_token(self, csrf_token_field):
        meta = self.form_meta
        if meta.csrf_secret is None:
            raise Exception('must set `csrf_secret` on class Meta for SessionCSRF to work')
        if meta.csrf_context is None:
            raise TypeError('Must provide a session-like object as csrf context')

        session = self.session

        if 'csrf' not in session:
            session['csrf'] = sha1(os.urandom(64)).hexdigest()

        if self.time_limit:
            expires = (self.now() + self.time_limit).strftime(self.TIME_FORMAT)
            csrf_build = '%s%s' % (session['csrf'], expires)
        else:
            expires = ''
            csrf_build = session['csrf']

        hmac_csrf = hmac.new(meta.csrf_secret, csrf_build.encode('utf8'), digestmod=sha1)
        return '%s##%s' % (expires, hmac_csrf.hexdigest())

    def validate_csrf_token(self, form, field):
        meta = self.form_meta
        if not field.data or '##' not in field.data:
            raise ValidationError(field.gettext('CSRF token missing'))

        expires, hmac_csrf = field.data.split('##', 1)

        check_val = (self.session['csrf'] + expires).encode('utf8')

        hmac_compare = hmac.new(meta.csrf_secret, check_val, digestmod=sha1)
        if hmac_compare.hexdigest() != hmac_csrf:
            raise ValidationError(field.gettext('CSRF failed'))

        if self.time_limit:
            now_formatted = self.now().strftime(self.TIME_FORMAT)
            if now_formatted > expires:
                raise ValidationError(field.gettext('CSRF token expired'))

    def now(self):
        """
        Get the current time. Used for test mocking/overriding mainly.
        """
        return datetime.now()

    @property
    def time_limit(self):
        return getattr(self.form_meta, 'csrf_time_limit', timedelta(minutes=30))

    @property
    def session(self):
        return getattr(self.form_meta.csrf_context, 'session', self.form_meta.csrf_context)
