from dataclasses import dataclass
from typing import Any

from flask_babel import gettext as __

from superset import app, ConnectorRegistry, db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.exceptions import (
    DatasourceAccessRequestNotFoundError,
    DatasourceNotFoundValidationError,
    ForbiddenError,
    UserNotFoundValidationError,
)
from superset.models.datasource_access_request import DatasourceAccessRequest
from superset.utils.core import notify_user_about_perm_update
from superset.views.base import check_ownership
from superset.views.utils import DATASOURCE_MISSING_ERR


@dataclass
class ApproveCommandResult:
    role_granted: bool
    role_extended: bool


@dataclass
class ApproveCommand(BaseCommand):
    datasource_type: str
    datasource_id: str
    created_by_username: str
    role_to_grant: str
    role_to_extend: str
    approving_user: Any

    def __init__(self, *args, **kwargs):
        super(*args, **kwargs)
        self._validated = False

    def validate(self):
        if not self.datasource:
            raise DatasourceNotFoundValidationError()
        if not self.requested_by:
            raise UserNotFoundValidationError()
        if not self._requests:
            raise DatasourceAccessRequestNotFoundError()
        if not self._can_perform_operation:
            raise ForbiddenError()
        self._validated = True

    def run(self) -> ApproveCommandResult:
        if not self._validated:
            self.validate()

        if self.role_to_grant:
            self._grant_role()
        if self.role_to_extend:
            self._extend_role()

        self._clean_fulfilled_requests()
        self._clean_referenced_requests()
        db.session.commit()

        return ApproveCommandResult(
            role_granted=bool(self.role_to_grant),
            role_extended=bool(self.role_to_extend),
        )

    def _grant_role(self):
        self.requested_by.roles.append(self._role_to_grant)
        notify_user_about_perm_update(
            self.approving_user,
            self.requested_by,
            self._role_to_grant,
            self.datasource,
            "email/role_granted.txt",
            app.config,
        )

    def _extend_role(self):
        perm_view = security_manager.find_permission_view_menu(
            "email/datasource_access", self.datasource.perm
        )
        security_manager.add_permission_role(self._role_to_extend, perm_view)
        notify_user_about_perm_update(
            self.approving_user,
            self.requested_by,
            self._role_to_extend,
            self.datasource,
            "email/role_extended.txt",
            app.config,
        )

    @staticmethod
    def _clean_fulfilled_requests() -> None:
        for dar in db.session.query(DatasourceAccessRequest).all():
            datasource = ConnectorRegistry.get_datasource(
                dar.datasource_type, dar.datasource_id, db.session
            )
            if not datasource or security_manager.can_access_datasource(datasource):
                # datasource does not exist anymore
                db.session.delete(dar)

    def _clean_referenced_requests(self):
        for request in self._requests:
            db.session.delete(request)

    @property
    def _role_to_grant(self):
        return security_manager.find_role(self.role_to_grant)

    @property
    def _role_to_extend(self):
        return security_manager.find_role(self.role_to_extend)

    @property
    def datasource(self):
        return ConnectorRegistry.get_datasource(
            self.datasource_type, int(self.datasource_id), db.session
        )

    @property
    def requested_by(self):
        return security_manager.find_user(username=self.created_by_username)

    @property
    def _requests(self):
        return (
            db.session.query(DatasourceAccessRequest)
            .filter(
                DatasourceAccessRequest.datasource_id == self.datasource_id,
                DatasourceAccessRequest.datasource_type == self.datasource_type,
                DatasourceAccessRequest.created_by_fk  # pylint: disable=comparison-with-callable
                == self.requested_by.id,
            )
            .all()
        )

    @property
    def _can_perform_operation(self) -> bool:
        return security_manager.can_access_all_datasources() or check_ownership(
            self.datasource, raise_if_false=False
        )


# This is an adapter to make the ApproveCommand work
# with an existing endpoint in the `Superset` class.
# When the endpoint is ported to the new API, the
# adapter should become unnecessary.
class ApproveCommandSupersetAdapter:  # pylint: disable=too-few-public-methods
    def __init__(self, approve_command):
        self.approve_command = approve_command
        self.message = None
        self.flash_level = None
        self.redirect_path = None

    def adapt(self):
        try:
            self.approve_command.validate()
        except DatasourceNotFoundValidationError:
            self.message = DATASOURCE_MISSING_ERR
            self.flash_level = "alert"
            return
        except UserNotFoundValidationError:
            self.message = __("The user seems to have been deleted")
            self.flash_level = "alert"
            return
        except DatasourceAccessRequestNotFoundError:
            self.message = __("The access requests seem to have been deleted")
            self.flash_level = "alert"
        except ForbiddenError:
            self.message = __("You have no permission to approve this request")
            self.flash_level = "danger"
            self.redirect_path = "/accessrequestsmodelview/list/"
            return

        result = self.approve_command.run()
        self.flash_level = "info"
        self.redirect_path = "/accessrequestsmodelview/list/"

        if result.role_granted:
            self.message = __(
                "%(user)s was granted the role %(role)s that gives access "
                "to the %(datasource)s",
                user=self.approve_command.requested_by.username,
                role=self.approve_command.role_to_grant,
                datasource=self.approve_command.datasource.full_name,
            )
        if result.role_extended:
            self.message = __(
                "Role %(r)s was extended to provide the access to "
                "the datasource %(ds)s",
                r=self.approve_command.role_to_extend,
                ds=self.approve_command.datasource.full_name,
            )
