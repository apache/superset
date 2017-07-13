from wtforms import fields
from ...upload import BS3FileUploadFieldWidget, BS3ImageUploadFieldWidget
from werkzeug.datastructures import FileStorage

try:
    from wtforms.fields.core import _unset_value as unset_value
except ImportError:
    from wtforms.utils import unset_value


def is_empty(file_object):
    file_object.seek(0)
    first_char = file_object.read(1)
    file_object.seek(0)
    return not bool(first_char)


class MongoFileField(fields.FileField):
    """
        GridFS file field.
    """
    widget = BS3FileUploadFieldWidget()

    def __init__(self, label=None, validators=None, **kwargs):
        super(MongoFileField, self).__init__(label, validators, **kwargs)

        self._should_delete = False

    def process(self, formdata, data=unset_value):
        if formdata:
            marker = '_%s-delete' % self.name
            if marker in formdata:
                self._should_delete = True

        return super(MongoFileField, self).process(formdata, data)

    def populate_obj(self, obj, name):
        field = getattr(obj, name, None)
        if field is not None:
            # If field should be deleted, clean it up
            if self._should_delete:
                field.delete()
                return

            if isinstance(self.data, FileStorage) and not is_empty(self.data.stream):
                if not field.grid_id:
                    func = field.put
                else:
                    func = field.replace

                func(self.data.stream,
                     filename=self.data.filename,
                     content_type=self.data.content_type)


class MongoImageField(MongoFileField):
    """
        GridFS file field.
    """
    widget = BS3ImageUploadFieldWidget()
