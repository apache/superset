from wtforms.validators import ValidationError
from wtforms.fields import HiddenField

__all__ = ('CSRFTokenField', 'CSRF')


class CSRFTokenField(HiddenField):
    """
    A subclass of HiddenField designed for sending the CSRF token that is used
    for most CSRF protection schemes.

    Notably different from a normal field, this field always renders the
    current token regardless of the submitted value, and also will not be
    populated over to object data via populate_obj
    """
    current_token = None

    def __init__(self, *args, **kw):
        self.csrf_impl = kw.pop('csrf_impl')
        super(CSRFTokenField, self).__init__(*args, **kw)

    def _value(self):
        """
        We want to always return the current token on render, regardless of
        whether a good or bad token was passed.
        """
        return self.current_token

    def populate_obj(self, *args):
        """
        Don't populate objects with the CSRF token
        """
        pass

    def pre_validate(self, form):
        """
        Handle validation of this token field.
        """
        self.csrf_impl.validate_csrf_token(form, self)

    def process(self, *args):
        super(CSRFTokenField, self).process(*args)
        self.current_token = self.csrf_impl.generate_csrf_token(self)


class CSRF(object):
    field_class = CSRFTokenField

    def setup_form(self, form):
        """
        Receive the form we're attached to and set up fields.

        The default implementation creates a single field of
        type :attr:`field_class` with name taken from the
        ``csrf_field_name`` of the class meta.

        :param form:
            The form instance we're attaching to.
        :return:
            A sequence of `(field_name, unbound_field)` 2-tuples which
            are unbound fields to be added to the form.
        """
        meta = form.meta
        field_name = meta.csrf_field_name
        unbound_field = self.field_class(
            label='CSRF Token',
            csrf_impl=self
        )
        return [(field_name, unbound_field)]

    def generate_csrf_token(self, csrf_token_field):
        """
        Implementations must override this to provide a method with which one
        can get a CSRF token for this form.

        A CSRF token is usually a string that is generated deterministically
        based on some sort of user data, though it can be anything which you
        can validate on a subsequent request.

        :param csrf_token_field:
            The field which is being used for CSRF.
        :return:
            A generated CSRF string.
        """
        raise NotImplementedError()

    def validate_csrf_token(self, form, field):
        """
        Override this method to provide custom CSRF validation logic.

        The default CSRF validation logic simply checks if the recently
        generated token equals the one we received as formdata.

        :param form: The form which has this CSRF token.
        :param field: The CSRF token field.
        """
        if field.current_token != field.data:
            raise ValidationError(field.gettext('Invalid CSRF Token'))
