from datetime import timedelta
import logging

from flask import request, redirect, flash
from flask.ext.appbuilder.models.sqla.interface import SQLAInterface
from flask.ext.appbuilder import ModelView, CompactCRUDMixin, BaseView, expose
from app import appbuilder, db, models, viz, utils
import config
from wtforms import Form, SelectMultipleField, SelectField, TextField
from wtforms.fields import Field

class OmgWtForm(Form):
    field_order = (
        'viz_type', 'granularity', 'since', 'group_by', 'limit')
    def fields(self):
        fields = []
        for field in self.field_order:
            if hasattr(self, field):
                obj = getattr(self, field)
                if isinstance(obj, Field):
                    fields.append(getattr(self, field))
        return fields


def form_factory(datasource, form_args=None):
    grain = ['all', 'none', 'minute', 'hour', 'day']
    limits = [0, 5, 10, 25, 50, 100, 500]

    if form_args:
        limit = form_args.get("limit")
        try:
            limit = int(limit)
            if limit not in limits:
                limits.append(limit)
                limits = sorted(limits)
        except:
            pass

    class QueryForm(OmgWtForm):
        viz_type = SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz.viz_types.items()])
        metric = SelectField('Metric', choices=datasource.metrics_combo)
        groupby = SelectMultipleField(
            'Group by', choices=[
                (s, s) for s in datasource.groupby_column_names])
        granularity = SelectField(
            'Time Granularity', choices=[(g, g) for g in grain])
        since = SelectField(
            'Since', choices=[(s, s) for s in utils.since_l.keys()],
            default="all")
        limit = SelectField(
            'Limit', choices=[(s, s) for s in limits])
    for i in range(10):
        setattr(QueryForm, 'flt_col_' + str(i), SelectField(
            'Filter 1', choices=[(s, s) for s in datasource.filterable_column_names]))
        setattr(QueryForm, 'flt_op_' + str(i), SelectField(
            'Filter 1', choices=[(m, m) for m in ['==', '!=', 'in',]]))
        setattr(QueryForm, 'flt_eq_' + str(i), TextField("Super"))
    return QueryForm


class ColumnInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.Column)
    edit_columns = [
        'column_name', 'datasource', 'groupby', 'count_distinct',
        'sum', 'min', 'max']
    list_columns = [
        'column_name', 'type', 'groupby', 'count_distinct',
        'sum', 'min', 'max']
    can_delete = False
appbuilder.add_view_no_menu(ColumnInlineView)


class MetricInlineView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(models.Metric)
    list_columns = ['metric_name', 'verbose_name', 'metric_type' ]
    edit_columns = [
        'metric_name', 'verbose_name', 'metric_type', 'datasource', 'json']
    add_columns = [
        'metric_name', 'verbose_name', 'metric_type', 'datasource', 'json']
appbuilder.add_view_no_menu(MetricInlineView)


class DatasourceModelView(ModelView):
    datamodel = SQLAInterface(models.Datasource)
    list_columns = ['datasource_link', 'is_featured', 'is_hidden']
    related_views = [ColumnInlineView, MetricInlineView]
    edit_columns = [
        'datasource_name', 'description', 'is_featured', 'is_hidden',
        'default_endpoint']
    page_size = 100


appbuilder.add_view(
    DatasourceModelView,
    "Datasources",
    icon="fa-cube",
    category_icon='fa-envelope')


class Panoramix(BaseView):
    @expose("/datasource/<datasource_name>/")
    def datasource(self, datasource_name):
        viz_type = request.args.get("viz_type")

        datasource = (
            db.session
            .query(models.Datasource)
            .filter_by(datasource_name=datasource_name)
            .first()
        )
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)
        if not viz_type:
            viz_type = "table"
        obj = viz.viz_types[viz_type](
            datasource,
            form_class=form_factory(datasource, request.args),
            form_data=request.args, view=self)
        if obj.df is None or obj.df.empty:
            return obj.render_no_data()
        return obj.render()


    @expose("/refresh_datasources/")
    def refresh_datasources(self):
        import requests
        import json
        endpoint = (
            "http://{COORDINATOR_HOST}:{COORDINATOR_PORT}/"
            "{COORDINATOR_BASE_ENDPOINT}/datasources"
        ).format(**config.__dict__)
        datasources = json.loads(requests.get(endpoint).text)
        for datasource in datasources:
            try:
                models.Datasource.sync_to_db(datasource)
            except Exception as e:
                logging.exception(e)
                logging.error("Failed at syncing " + datasource)
        flash("Refreshed metadata from Druid!", 'info')
        return redirect("/datasourcemodelview/list/")

appbuilder.add_view_no_menu(Panoramix)
appbuilder.add_link(
    "Refresh Metadata",
    href='/panoramix/refresh_datasources/',
    category='Admin',
    icon="fa-cogs")

#models.Metric.__table__.drop(db.engine)
db.create_all()
