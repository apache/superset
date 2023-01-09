
from flask_babel import lazy_gettext as _


class UploadMixin:  # pylint: disable=too-few-public-methods
    list_title = _("Uploads")
    show_title = _("Show Upload")
    add_title = _("Add Upload")
    edit_title = _("Edit Upload")

    list_columns = ["id", "name", "type", "status", "source", "created_at", "created_by"]
    edit_columns = ["name"]
    base_order = ("id", "desc")
    label_columns = {
        "id": _("ID"),
        "source": _("Pilot System"),
    }
