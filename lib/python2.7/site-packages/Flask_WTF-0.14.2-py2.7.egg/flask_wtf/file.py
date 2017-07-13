import warnings
from collections import Iterable

from werkzeug.datastructures import FileStorage
from wtforms import FileField as _FileField
from wtforms.validators import DataRequired, StopValidation

from ._compat import FlaskWTFDeprecationWarning


class FileField(_FileField):
    """Werkzeug-aware subclass of :class:`wtforms.fields.FileField`."""

    def process_formdata(self, valuelist):
        valuelist = (x for x in valuelist if isinstance(x, FileStorage) and x)
        data = next(valuelist, None)

        if data is not None:
            self.data = data
        else:
            self.raw_data = ()

    def has_file(self):
        """Return ``True`` if ``self.data`` is a
        :class:`~werkzeug.datastructures.FileStorage` object.

        .. deprecated:: 0.14.1
            ``data`` is no longer set if the input is not a non-empty
            ``FileStorage``. Check ``form.data is not None`` instead.
        """

        warnings.warn(FlaskWTFDeprecationWarning(
            '"has_file" is deprecated and will be removed in 1.0. The data is '
            'checked during processing instead.'
        ))
        return bool(self.data)


class FileRequired(DataRequired):
    """Validates that the data is a Werkzeug
    :class:`~werkzeug.datastructures.FileStorage` object.

    :param message: error message

    You can also use the synonym ``file_required``.
    """

    def __call__(self, form, field):
        if not (isinstance(field.data, FileStorage) and field.data):
            if self.message is None:
                message = field.gettext('This field is required.')
            else:
                message = self.message

            raise StopValidation(message)

file_required = FileRequired


class FileAllowed(object):
    """Validates that the uploaded file is allowed by a given list of
    extensions or a Flask-Uploads :class:`~flaskext.uploads.UploadSet`.

    :param upload_set: A list of extensions or an
        :class:`~flaskext.uploads.UploadSet`
    :param message: error message

    You can also use the synonym ``file_allowed``.
    """

    def __init__(self, upload_set, message=None):
        self.upload_set = upload_set
        self.message = message

    def __call__(self, form, field):
        if not (isinstance(field.data, FileStorage) and field.data):
            return

        filename = field.data.filename.lower()

        if isinstance(self.upload_set, Iterable):
            if any(filename.endswith('.' + x) for x in self.upload_set):
                return

            raise StopValidation(self.message or field.gettext(
                'File does not have an approved extension: {extensions}'
            ).format(extensions=', '.join(self.upload_set)))

        if not self.upload_set.file_allowed(field.data, filename):
            raise StopValidation(self.message or field.gettext(
                'File does not have an approved extension.'
            ))

file_allowed = FileAllowed
