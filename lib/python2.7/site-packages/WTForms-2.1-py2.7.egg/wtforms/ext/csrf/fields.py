from wtforms.fields import HiddenField


class CSRFTokenField(HiddenField):
    current_token = None

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
