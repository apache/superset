from flask_babel import lazy_gettext as _


class TeamMixin:  # pylint: disable=too-few-public-methods
    list_title = _("Team")
    show_title = _("Show Team")
    add_title = _("Add Team")
    edit_title = _("Edit Team")

    list_columns = ["id", "name", "is_external", "slug", "roles", "participants"]
    label_columns = {
        "id": _("Id"),
        "name": _("Name"),
        "is_external": _("is_external"),
        "slug": _("Slug"),
        "roles": _("Roles"),
        "participants": _("Participants"),
    }
