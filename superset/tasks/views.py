from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import appbuilder
from superset.views.base import SupersetModelView, DeleteMixin

from .manager import task_manager
from .models import CronTask
from .utils import is_valid_crontab_str, is_valid_task_config


class CronTaskModelView(SupersetModelView, DeleteMixin):
    """Model view for all cron tasks"""
    datamodel = SQLAInterface(CronTask)

    list_title = _('List Cron Tasks')
    show_title = _('Show Cron Task')
    add_title = _('Create Cron Task')
    edit_title = _('Edit Cron Task')

    list_columns = [
        'next_execution_date',
        'created_on',
        'description',
    ]
    add_columns = [
        'crontab_str',
        'description',
        'config',
    ]
    edit_columns = add_columns
    show_columns = [
        'description',
        'crontab_str',
        'next_execution_date',
        'time_to_execution_nearest_sec',
        'config',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    base_order = ('created_on', 'desc')
    label_columns = {
        'description': _('Description'),
        'crontab_str': _('Crontab expression'),
        'next_execution_date': _('Next execution date'),
        'config': _('Task config'),
        'time_to_execution_nearest_sec': _('Time until next execution'),
    }
    description_columns = {
        'crontab_str': _(
            'The crontab expression describing when this task should run'),
        'config': _(
            'Configuration describing the `type` of task and its options'),
    }

    def pre_add(self, task):
        # Validate crontab expression and config JSON
        if not is_valid_crontab_str(task.crontab_str):
            raise ValueError(
                "Task has invalid crontab expression: {}"
                .format(task.crontab_str)
            )
        if not is_valid_task_config(task.config):
            raise ValueError(
                "Task has invalid configuration json"
            )

    def post_add(self, task):
        # After adding the task, immediately enqueue it
        task_manager.enqueue_task(task)

    def pre_delete(self, task):
        # cancel the task before it is deleted
        task_manager.cancel_task(task.id)

    def pre_update(self, task):
        self.pre_add(task)

    def post_update(self, task):
        self.post_add(task)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_view(
    CronTaskModelView,
    "Cron Tasks",
    label=__("Cron Tasks"),
    icon="fa-list-ul",
    category="",
    category_icon='')
