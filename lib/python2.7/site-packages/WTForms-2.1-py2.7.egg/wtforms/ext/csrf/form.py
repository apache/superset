from __future__ import unicode_literals

from wtforms.form import Form
from wtforms.validators import ValidationError

from .fields import CSRFTokenField


class SecureForm(Form):
    """
    Form that enables CSRF processing via subclassing hooks.
    """
    csrf_token = CSRFTokenField()

    def __init__(self, formdata=None, obj=None, prefix='', csrf_context=None, **kwargs):
        """
        :param csrf_context:
            Optional extra data which is passed transparently to your
            CSRF implementation.
        """
        super(SecureForm, self).__init__(formdata, obj, prefix, **kwargs)
        self.csrf_token.current_token = self.generate_csrf_token(csrf_context)

    def generate_csrf_token(self, csrf_context):
        """
        Implementations must override this to provide a method with which one
        can get a CSRF token for this form.

        A CSRF token should be a string which can be generated
        deterministically so that on the form POST, the generated string is
        (usually) the same assuming the user is using the site normally.

        :param csrf_context:
            A transparent object which can be used as contextual info for
            generating the token.
        """
        raise NotImplementedError()

    def validate_csrf_token(self, field):
        """
        Override this method to provide custom CSRF validation logic.

        The default CSRF validation logic simply checks if the recently
        generated token equals the one we received as formdata.
        """
        if field.current_token != field.data:
            raise ValidationError(field.gettext('Invalid CSRF Token'))

    @property
    def data(self):
        d = super(SecureForm, self).data
        d.pop('csrf_token')
        return d
