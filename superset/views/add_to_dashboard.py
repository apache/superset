import logging
import simplejson as json

from flask import g 

from superset import db 
from superset.connectors.sqla.models import SqlaTable
import superset.models.core as models
from superset.utils import core as utils
from superset.views.default_slice_metadata import update_slice_metadata

def get_table_columns(columns):
    table_columns = []
    TableColumn = SqlaTable.column_class
    for column in columns:
        table_column = TableColumn()
        for prop in column:
            setattr(table_column, prop, column[prop])
        table_columns.append(table_column)
    return table_columns

def create_table(args):
    database_id = int(args.get('database_id'))
    table_name =  args.get('table_name')
    schema =  args.get('schema')

    database = db.session.query(models.Database).filter_by(id=database_id).one()
    columns = json.loads(args.get('columns'))
    table_columns = get_table_columns(columns)
    table_model = SqlaTable(
        table_name=table_name,
        schema=schema,
        database_id=database_id,
        database = database,
        columns= table_columns,
    )
    db.session.add(table_model)
    db.session.commit()
    logging.info('table is created with id = '+str(table_model.id)+' and linked with database id = '+str(database_id))
    return {
        'id' : table_model.id,
        'type' : table_model.type,
        'name' : table_model.name
    }

    
def add_slice_to_dashboard(request,args, datasource_type=None, datasource_id=None):
    form_data = json.loads(args.get('form_data'))
    datasource_id = args.get('datasource_id')
    datasource_type = args.get('datasource_type')
    datasource_name = args.get('datasource_name')
    viz_type = form_data.get('viz_type')  
    
    form_data['datasource'] = str(datasource_id) + '__' + datasource_type

    # On explore, merge legacy and extra filters into the form data
    utils.convert_legacy_filters_into_adhoc(form_data)
    utils.merge_extra_filters(form_data)

    """Save or overwrite a slice"""
    slice_name = args.get('slice_name')
    action = args.get('action')
    #saving slice
    slc = models.Slice(owners=[g.user] if g.user else [])
    slc.params = json.dumps(form_data, indent=2, sort_keys=True)
    slc.datasource_name = datasource_name
    slc.viz_type = form_data['viz_type']
    slc.datasource_type = datasource_type
    slc.datasource_id = datasource_id
    slc.slice_name = slice_name
    session = db.session()
    session.add(slc)
    session.commit()
    
    #adding slice to dashboard
    dash = (
        db.session.query(models.Dashboard)
        .filter_by(id=int(args.get('save_to_dashboard_id')))
        .one()
    )

    dash.slices.append(slc)
    db.session.commit()
    logging.info(
    'Slice [{}] was added to dashboard [{}]'.format(
        slc.slice_name,
        dash.dashboard_title),
    'info')

    return {
        'form_data': slc.form_data,
        'slice': slc.data,
    }


def add_to_dashboard(request):
    # create database  connection
    database_name = request.form.get('database_name')
    sqlalchemy_uri = request.form.get('sqlalchemy_uri')
    extra = request.form.get('extra')
    impersonate_user = eval(request.form.get('impersonate_user'))
    db_model = models.Database(
        database_name=database_name,
        sqlalchemy_uri=sqlalchemy_uri,
        extra=extra,
        impersonate_user=impersonate_user
    )
    db.session.add(db_model)
    db.session.commit()
    database_id = db_model.id 
    logging.info('database connection is created with id = '+str(database_id))
    

    # create dashboard
    dash_model = models.Dashboard(
        dashboard_title= request.form.get('dashboard_title'),
        slug=request.form.get('slug'),
    )
    db.session.add(dash_model)
    db.session.commit()
    dashboard_id = dash_model.id
    logging.info('new dashboard created with id = ' + str(dashboard_id))


    slices = json.loads(request.form.get('slices'))
    for _slice in slices:
        columns = json.dumps([])
        if 'columns' in _slice:
            columns = json.dumps(_slice['columns'])
        params = {
            'database_id':database_id ,
            'table_name':_slice['table_name'],
            'schema':_slice['schema'],
            'columns':columns,
            }
        
        # create table for slice
        table_model = create_table(params)
        
        # add slice into dashboard
        _slice = update_slice_metadata(_slice)
        slice_param_data = {
        'action':'saveas',
        'slice_name':_slice['slice_name'],
        'add_to_dash':'existing',
        'save_to_dashboard_id':dashboard_id,
        'goto_dash':'false',
        'form_data':json.dumps(_slice),
        'datasource_id' : table_model['id'],
        'datasource_type' : table_model['type'],
        'datasource_name' : table_model['name']
        }

        add_slice_to_dashboard(request,slice_param_data)