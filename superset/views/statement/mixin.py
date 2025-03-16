from flask_babel import lazy_gettext as _


class StatementMixin:  # pylint: disable=too-few-public-methods
    list_title = _("Statements")
    show_title = _("Show Statement")
    add_title = _("Add Statement")
    edit_title = _("Edit Statement")

    list_columns = [
        "user",
        "finished",
        "team",
        "is_new_team",
        "team_slug",
        "is_external",
        "created_datetime",
        "request_roles",
        "last_changed_datetime",
    ]
    label_columns = {
        "is_external": _("is_external"),
        "team": _("Team"),
        "is_new_team": _("is_new_team"),
        "team_slug": _("Team slug"),
        "finished": _("Finished"),
        "user": _("User"),
        "request_roles": _("Request roles"),
        "created_datetime": _("Created datetime"),
        "last_changed_datetime": _("Last changed datetime"),
    }
