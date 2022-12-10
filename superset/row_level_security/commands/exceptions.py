from flask_babel import lazy_gettext as _

from superset.commands.exceptions import CommandException


class RLSRuleNotFoundError(CommandException):
    status = 404
    message = _("RLS Rule not found.")
