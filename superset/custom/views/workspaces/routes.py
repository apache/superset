from flask import (render_template, url_for, flash,
                   redirect, request, Blueprint, g, make_response)

from flask import (render_template,Blueprint)
from flask_login import logout_user

import logging
from superset.extensions import appbuilder
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)
workspaces = Blueprint('workspaces', __name__, template_folder='/app/superset/custom/templates/workspaces')


@workspaces.route("/superset/workspaces/")
#@check_auth(login_required, oidc.require_login)
def home():
    from superset.custom.resource_manager import workspace
    wp_resource_manager = workspace.WorkspaceResourceManager()
    if not g.user or not get_user_id():
        return redirect(appbuilder.get_url_for_login)
    wp =wp_resource_manager.list_intern_resource(g.user)
    return render_template(
            'index.html',
            workspaces=wp,
            appbuilder=appbuilder)


@workspaces.route("/workspace/new", methods=['GET', 'POST'])
#@check_auth(login_required, oidc.require_login)
def create_workspace():
    username = None
    from superset.custom.resource_manager import workspace
    wp_resource_manager = workspace.WorkspaceResourceManager()
    if g.user:
        username = g.user.username
    if request.method == 'POST' and username:
        wp_resource_manager.create_intern_resource(
                title=request.form['title'],
                color=request.form['color'],
                created_by=username,
                description=request.form['description']
                )
        flash('New workspace successfully created', 'success')
        return redirect(url_for('workspaces.home'))
    flash('Unable to create the new workspace please resubmit the form',
          'danger')
    return render_template(
            'index.html'
            )


@workspaces.route("/workspace/<int:workspace_id>/dashboards",
                  methods=['GET', 'POST'])
#@check_auth(login_required, oidc.require_login)
def list_dashboard_workspace(workspace_id):
    from superset.custom.resource_manager import workspace
    wp_resource_manager = workspace.WorkspaceResourceManager()
    wp, dashboards = wp_resource_manager.get_intern_resource(workspace_id)
    resp_template = redirect(url_for('DashboardModelView.list'))
    resp = make_response(resp_template)
    resp.set_cookie('workspaceID', str(wp.id))
    return resp


@workspaces.route("/workspace/<int:workspace_id>/update",
                  methods=['GET', 'POST'])
#@check_auth(login_required, oidc.require_login)
def update_workspace(workspace_id):
    from superset.custom.resource_manager import workspace
    wp_resource_manager = workspace.WorkspaceResourceManager()
    username = None
    if request.method == 'POST':
        if g.user:
            username = g.user.username
        wp_resource_manager.update_intern_resource(
                pk=workspace_id,
                title=request.form['title'],
                color=request.form['color'],
                description=request.form['description'],
                created_by=username,
                )
        flash('Workspace successfully updated', 'success')
    return redirect(url_for('workspaces.home'))


@workspaces.route("/workspace/<int:workspace_id>/delete",
                  methods=['POST', 'GET'])
#@check_auth(login_required, oidc.require_login)
def delete_workspace(workspace_id):
    from superset.custom.resource_manager import workspace
    wp_resource_manager = workspace.WorkspaceResourceManager()
    if request.method == 'POST' and request.form['confirm'] == 'DELETE':
        wp_resource_manager.delete_intern_resource(workspace_id)
        flash('Workspace was removed', 'success')
    return redirect(url_for('workspaces.home'))


@workspaces.route("/superset/workspaces/")
def logout():
    logout_user()
    return redirect(url_for('workspaces.home'))
