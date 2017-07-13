
from werkzeug.datastructures import FileStorage

from wtforms import ValidationError, fields
from wtforms.widgets import HTMLString, html_params
from flask_babel import gettext
from .filemanager import ImageManager, FileManager

try:
    from wtforms.fields.core import _unset_value as unset_value
except ImportError:
    from wtforms.utils import unset_value


"""
    Based and thanks to https://github.com/mrjoes/flask-admin/blob/master/flask_admin/form/upload.py
"""

class BS3FileUploadFieldWidget(object):

    empty_template = ('<div class="input-group">'
                    '<span class="input-group-addon"><i class="fa fa-upload"></i>'
                    '</span>'
                    '<input class="form-control" %(file)s/>'
        '</div>'
        )

    data_template = ('<div>'
                     ' <input %(text)s>'
                     ' <input type="checkbox" name="%(marker)s">Delete</input>'
                     '</div>'
                     '<div class="input-group">'
                    '<span class="input-group-addon"><i class="fa fa-upload"></i>'
                    '</span>'
                    '<input class="form-control" %(file)s/>'
        '</div>'
        )

    def __call__(self, field, **kwargs):
        kwargs.setdefault('id', field.id)
        kwargs.setdefault('name', field.name)

        args = {
            'file': html_params(type='file',
                                **kwargs),
            'marker': '_%s-delete' % field.name
        }

        template = self.data_template if field.data else self.empty_template

        return HTMLString(template % {
            'text': html_params(type='text',
                                value=field.data),
            'file': html_params(type='file',
                                **kwargs),
            'marker': '_%s-delete' % field.name
        })


class BS3ImageUploadFieldWidget(object):

    empty_template = ('<div class="input-group">'
                    '<span class="input-group-addon"><span class="glyphicon glyphicon-upload"></span>'
                    '</span>'
                    '<input class="form-control" %(file)s/>'
        '</div>'
        )

    data_template = ('<div class="thumbnail">'
                     ' <img %(image)s>'
                     ' <input type="checkbox" name="%(marker)s">Delete</input>'
                     '</div>'
                     '<div class="input-group">'
                    '<span class="input-group-addon"><span class="glyphicon glyphicon-upload"></span>'
                    '</span>'
                    '<input class="form-control" %(file)s/>'
                    '</div>'
        )

    def __call__(self, field, **kwargs):
        kwargs.setdefault('id', field.id)
        kwargs.setdefault('name', field.name)

        args = {
            'file': html_params(type='file',
                                **kwargs),
            'marker': '_%s-delete' % field.name
        }

        if field.data:
            url = self.get_url(field)
            args['image'] = html_params(src=url)
            template = self.data_template

        else:
            template = self.empty_template

        return HTMLString(template % args)

    def get_url(self, field):
        im = ImageManager()
        return im.get_url(field.data)


# Fields
class FileUploadField(fields.TextField):
    """
        Customizable file-upload field.

        Saves file to configured path, handles updates and deletions. Inherits from `TextField`,
        resulting filename will be stored as string.
    """
    widget = BS3FileUploadFieldWidget()

    def __init__(self, label=None, validators=None,
                 filemanager = None,
                 **kwargs):
        """
            Constructor.

            :param label:
                Display label
            :param validators:
                Validators
        """

        self.filemanager = filemanager or FileManager()
        self._should_delete = False

        super(FileUploadField, self).__init__(label, validators, **kwargs)

    def process_on_delete(self, obj):
        """Override this method to make customised updates to the object 
        when the stored file is going to be deleted."""
        pass

    def process_on_store(self, obj, byte_stream):
        """Override this method to make customised updates to the object 
        when a file is going to be stored.
        
        This may be used to parse file content and extract values for 
        additional fields.
        
        Note: as populate_obj() on form fields my be called in an arbitrary
        order, do not assume that other fields in obj have been correctly set.
        If an extra information (from other fields) is necessary for parsing
        the supplied file content, a form-field validator may be used to copy
        it directly from the form to this field.
        
        :param obj: model object
        :param byte_stream: file contents
        """
        pass

    def pre_validate(self, form):
        if (self.data and
                isinstance(self.data, FileStorage) and
                not self.filemanager.is_file_allowed(self.data.filename)):
            raise ValidationError(gettext('Invalid file extension'))

    def process(self, formdata, data=unset_value):
        if formdata:
            marker = '_%s-delete' % self.name
            if marker in formdata:
                self._should_delete = True
        return super(FileUploadField, self).process(formdata, data)

    def populate_obj(self, obj, name):
        field = getattr(obj, name, None)
        if field:
            # If field should be deleted, clean it up
            if self._should_delete:
                self.process_on_delete(obj)
                self.filemanager.delete_file(field)
                setattr(obj, name, None)
                return

        if self.data and isinstance(self.data, FileStorage):
            if field:
                self.process_on_delete(obj)
                self.filemanager.delete_file(field)

            position = self.data.stream.tell()
            self.process_on_store(obj, self.data.stream)
            self.data.stream.seek(position)

            filename = self.filemanager.generate_name(obj, self.data)
            filename = self.filemanager.save_file(self.data, filename)

            setattr(obj, name, filename)


class ImageUploadField(fields.StringField):
    """
        Image upload field.
    """
    widget = BS3ImageUploadFieldWidget()

    def __init__(self, label=None, validators=None,
                 imagemanager = None,
                 **kwargs):

        self.imagemanager = imagemanager or ImageManager()
        self._should_delete = False
        super(ImageUploadField, self).__init__(label, validators, **kwargs)

    def pre_validate(self, form):
        if (self.data and
                isinstance(self.data, FileStorage) and
                not self.imagemanager.is_file_allowed(self.data.filename)):
            raise ValidationError(gettext('Invalid file extension'))

    def process(self, formdata, data=unset_value):
        if formdata:
            marker = '_%s-delete' % self.name
            if marker in formdata:
                self._should_delete = True
        return super(ImageUploadField, self).process(formdata, data)

    def populate_obj(self, obj, name):
        field = getattr(obj, name, None)
        size = obj.__mapper__.columns[name].type.size
        thumbnail_size = obj.__mapper__.columns[name].type.thumbnail_size
        if field:
            # If field should be deleted, clean it up
            if self._should_delete:
                self.imagemanager.delete_file(field)
                setattr(obj, name, None)
                return

        if self.data and isinstance(self.data, FileStorage):
            if field:
                self.imagemanager.delete_file(field)

            filename = self.imagemanager.generate_name(obj, self.data)
            filename = self.imagemanager.save_file(self.data, filename, size, thumbnail_size)

            setattr(obj, name, filename)

