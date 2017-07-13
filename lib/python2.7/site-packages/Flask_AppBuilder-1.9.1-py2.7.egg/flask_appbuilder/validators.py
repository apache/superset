from wtforms import ValidationError


class Unique(object):
    """
        Checks field value unicity against specified table field.

        :param datamodel:
            The datamodel class, abstract layer for backend
        :param col_name:
            The unique column name.
        :param message:
            The error message.
    """
    field_flags = ('unique', )

    def __init__(self, datamodel, col_name, message=None):
        self.datamodel = datamodel
        self.col_name = col_name
        self.message = message

    def __call__(self, form, field):
        filters = self.datamodel.get_filters().add_filter(self.col_name,
                                                          self.datamodel.FilterEqual,
                                                          field.data)
        count, obj = self.datamodel.query(filters)
        if count > 0:
            # only test if Unique, if pk value is different on update.
            if not hasattr(form,'_id') or form._id != self.datamodel.get_keys(obj)[0]:
                if self.message is None:
                    self.message = field.gettext(u'Already exists.')
                raise ValidationError(self.message)
