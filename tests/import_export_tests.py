"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import pickle
import unittest

from caravel import db, models

from .base_tests import CaravelTestCase


class ImportExportTests(CaravelTestCase):
    """Testing export import functionality for dashboards"""

    def __init__(self, *args, **kwargs):
        super(ImportExportTests, self).__init__(*args, **kwargs)

    def test_export_dashboards(self):
        births_dash = db.session.query(models.Dashboard).filter_by(
            slug='births').first()

        # export 1 dashboard
        export_dash_url_1 = (
            '/dashboardmodelview/export_dashboards_form?id={}&action=go'
            .format(births_dash.id)
        )
        resp_1 = self.client.get(export_dash_url_1)
        exported_dashboards_1 = pickle.loads(resp_1.data)['dashboards']
        self.assertEquals(1, len(exported_dashboards_1))
        self.assertEquals('births', exported_dashboards_1[0].slug)
        self.assertEquals('Births', exported_dashboards_1[0].dashboard_title)
        self.assertEquals(
            births_dash.id,
            json.loads(exported_dashboards_1[0].json_metadata)['remote_id']
        )

        self.assertTrue(exported_dashboards_1[0].position_json)
        self.assertEquals(9, len(exported_dashboards_1[0].slices))

        exported_tables_1 = pickle.loads(resp_1.data)['datasources']
        self.assertEquals(1, len(exported_tables_1))
        self.assertEquals(
            1, len([c for c in [t.columns for t in exported_tables_1]]))
        self.assertEquals(
            1, len([m for m in [t.metrics for t in exported_tables_1]]))

        # export 2 dashboards
        world_health_dash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()
        export_dash_url_2 = (
            '/dashboardmodelview/export_dashboards_form?id={}&id={}&action=go'
            .format(births_dash.id, world_health_dash.id)
        )
        resp_2 = self.client.get(export_dash_url_2)
        exported_dashboards_2 = sorted(pickle.loads(resp_2.data)['dashboards'])
        self.assertEquals(2, len(exported_dashboards_2))
        self.assertEquals(9, len(exported_dashboards_2[0].slices))
        self.assertEquals('births', exported_dashboards_2[0].slug)

        self.assertEquals(10, len(exported_dashboards_2[1].slices))
        self.assertEquals('world_health', exported_dashboards_2[1].slug)
        self.assertEquals(
            world_health_dash.id,
            json.loads(exported_dashboards_2[1].json_metadata)['remote_id']
        )

        exported_tables_2 = sorted(pickle.loads(resp_2.data)['datasources'])
        self.assertEquals(2, len(exported_tables_2))
        table_names = [t.table_name for t in exported_tables_2]
        self.assertEquals(len(set(table_names)), len(table_names))
        self.assertEquals(
            14, len([c for c in t.columns for t in exported_tables_2]))
        self.assertEquals(
            8, len([m for m in t.metrics for t in exported_tables_2]))

    def test_import_slice(self):
        session = db.session

        def create_slice(name, ds_id=666, slc_id=1,
                      db_name='main',
                      table_name='wb_health_population'):
            params = {
                'num_period_compare': '10',
                'remote_id': slc_id,
                'datasource_name': table_name,
                'database_name': db_name,
                'schema': '',
            }
            return models.Slice(
                slice_name=name,
                datasource_type='table',
                viz_type='bubble',
                params=json.dumps(params),
                datasource_id=ds_id,
                id=slc_id
            )

        def get_slice(slc_id):
            return session.query(models.Slice).filter_by(id=slc_id).first()

        # Case 1. Import slice with different datasource id
        slc_id_1 = models.Slice.import_obj(
            create_slice('Import Me 1'), import_time=1989)
        slc_1 = get_slice(slc_id_1)
        table_id = db.session.query(models.SqlaTable).filter_by(
            table_name='wb_health_population').first().id
        self.assertEquals(table_id, slc_1.datasource_id)
        self.assertEquals(
            '[main].[wb_health_population](id:{})'.format(table_id),
            slc_1.perm)
        self.assertEquals('Import Me 1', slc_1.slice_name)
        self.assertEquals('table', slc_1.datasource_type)
        self.assertEquals('bubble', slc_1.viz_type)
        self.assertEquals(
            {'num_period_compare': '10',
             'datasource_name': 'wb_health_population',
             'database_name': 'main',
             'remote_id': 1,
             'schema': '',
             'import_time': 1989,},
            json.loads(slc_1.params))

        # Case 2. Import slice with same datasource id
        slc_id_2 = models.Slice.import_obj(create_slice(
            'Import Me 2', ds_id=table_id, slc_id=2))
        slc_2 = get_slice(slc_id_2)
        self.assertEquals(table_id, slc_2.datasource_id)
        self.assertEquals(
            '[main].[wb_health_population](id:{})'.format(table_id),
            slc_2.perm)

        # Case 3. Import slice with non existent datasource
        with self.assertRaises(IndexError):
            models.Slice.import_obj(create_slice(
                'Import Me 3', slc_id=3, table_name='non_existent'))

        # Case 4. Older version of slice already exists, override
        slc_id_4 = models.Slice.import_obj(
            create_slice('Import Me New 1'), import_time=1990)
        slc_4 = get_slice(slc_id_4)
        self.assertEquals(table_id, slc_4.datasource_id)
        self.assertEquals(
            '[main].[wb_health_population](id:{})'.format(table_id),
            slc_4.perm)
        self.assertEquals('Import Me New 1', slc_4.slice_name)
        self.assertEquals('table', slc_4.datasource_type)
        self.assertEquals('bubble', slc_4.viz_type)
        self.assertEquals(
            {'num_period_compare': '10',
             'datasource_name': 'wb_health_population',
             'database_name': 'main',
             'remote_id': 1,
             'schema': '',
             'import_time': 1990
             },
            json.loads(slc_4.params))
        # override doesn't change the id
        self.assertEquals(slc_id_1, slc_id_4)

        session.delete(slc_2)
        session.delete(slc_4)
        session.commit()

    def test_import_dashboard(self):
        session = db.session

        def create_dashboard(title, id=0, slcs=[]):
            json_metadata = {'remote_id': id}
            return models.Dashboard(
                id=id,
                dashboard_title=title,
                slices=slcs,
                position_json='{"size_y": 2, "size_x": 2}',
                slug='{}_imported'.format(title.lower()),
                json_metadata=json.dumps(json_metadata)
            )

        def get_dash(dash_id):
            return session.query(models.Dashboard).filter_by(
                id=dash_id).first()

        def get_slc(name, table_name, slc_id):
            params = {
                'remote_id': "'{}'".format(slc_id),
                'datasource_name': table_name,
                'database_name': 'main',
                'schema': 'test',
            }
            return models.Slice(
                id=slc_id,
                slice_name=name,
                datasource_type='table',
                params=json.dumps(params)
            )

        # Case 1. Import empty dashboard can be imported
        empty_dash = create_dashboard('empty_dashboard', id=1001)
        imported_dash_id_1 = models.Dashboard.import_obj(
            empty_dash, import_time=1989)
        imported_dash_1 = get_dash(imported_dash_id_1)
        self.assertEquals('empty_dashboard', imported_dash_1.dashboard_title)

        # Case 2. Import dashboard with 1 new slice.
        dash_with_1_slice = create_dashboard(
            'dash_with_1_slice',
            slcs=[get_slc('health_slc', 'wb_health_population', 1001)],
            id=1002)
        imported_dash_id_2 = models.Dashboard.import_obj(
            dash_with_1_slice, import_time=1990)
        imported_dash_2 = get_dash(imported_dash_id_2)
        self.assertEquals('dash_with_1_slice', imported_dash_2.dashboard_title)
        self.assertEquals(1, len(imported_dash_2.slices))
        self.assertEquals('wb_health_population',
                          imported_dash_2.slices[0].datasource.table_name)
        self.assertEquals(
            {"remote_id": 1002, "import_time": 1990},
            json.loads(imported_dash_2.json_metadata))

        # Case 3. Import dashboard with 2 new slices.
        dash_with_2_slices = create_dashboard(
            'dash_with_2_slices',
            slcs=[get_slc('energy_slc', 'energy_usage', 1002),
                  get_slc('birth_slc', 'birth_names', 1003)],
            id=1003)
        imported_dash_id_3 = models.Dashboard.import_obj(
            dash_with_2_slices, import_time=1991)
        imported_dash_3 = get_dash(imported_dash_id_3)
        self.assertEquals('dash_with_2_slices', imported_dash_3.dashboard_title)
        self.assertEquals(2, len(imported_dash_3.slices))
        self.assertEquals(
            {"remote_id": 1003, "import_time": 1991},
            json.loads(imported_dash_3.json_metadata))
        imported_dash_slice_ids_3 = {s.id for s in imported_dash_3.slices}

        # Case 4. Override the dashboard and 2 slices
        dash_with_2_slices_new = create_dashboard(
            'dash_with_2_slices_new',
            slcs=[get_slc('energy_slc', 'energy_usage', 1002),
                  get_slc('birth_slc', 'birth_names', 1003)],
            id=1003)
        imported_dash_id_4 = models.Dashboard.import_obj(
            dash_with_2_slices_new, import_time=1992)
        imported_dash_4 = get_dash(imported_dash_id_4)
        self.assertEquals('dash_with_2_slices_new',
                          imported_dash_4.dashboard_title)
        self.assertEquals(2, len(imported_dash_4.slices))
        self.assertEquals(
            imported_dash_slice_ids_3, {s.id for s in imported_dash_4.slices})
        self.assertEquals(
            {"remote_id": 1003, "import_time": 1992},
            json.loads(imported_dash_4.json_metadata))
        # override doesn't change the id
        self.assertEquals(imported_dash_id_3, imported_dash_id_4)

        # cleanup
        slc_to_delete = set(imported_dash_2.slices)
        slc_to_delete.update(imported_dash_4.slices)
        for slc in slc_to_delete:
            session.delete(slc)

        session.delete(imported_dash_1)
        session.delete(imported_dash_2)
        session.delete(imported_dash_4)
        session.commit()

    def test_import_tables(self):
        session = db.session

        def create_table(
                name, schema='', id=0, cols_names=[], metric_names=[]):
            json_metadata = {'remote_id': id, 'database_name': 'main'}
            table = models.SqlaTable(
                id=id,
                schema=schema,
                table_name=name,
                json_metadata=json.dumps(json_metadata)
            )
            for col_name in cols_names:
                table.columns.append(
                    models.TableColumn(column_name=col_name))
            for metric_name in metric_names:
                table.metrics.append(models.SqlMetric(metric_name=metric_name))
            return table

        def get_table(table_id):
            return session.query(models.SqlaTable).filter_by(
                id=table_id).first()

        # Case 1. Import table with no metrics and columns
        pure_table = create_table('pure_table', id=1001)
        imported_table_1_id = models.SqlaTable.import_obj(
            pure_table, import_time=1989)
        imported_table_1 = get_table(imported_table_1_id)
        self.assertEquals('pure_table', imported_table_1.table_name)

        # Case 2. Import table with 1 column and metric
        table_2 = create_table(
            'table_2', id=1002, cols_names=["col1"], metric_names=["metric1"])
        imported_table_id_2 = models.SqlaTable.import_obj(
            table_2, import_time=1990)
        imported_table_2 = get_table(imported_table_id_2)
        self.assertEquals('table_2', imported_table_2.table_name)
        self.assertEquals(1, len(imported_table_2.columns))
        self.assertEquals('col1', imported_table_2.columns[0].column_name)
        self.assertEquals(1, len(imported_table_2.metrics))
        self.assertEquals('metric1', imported_table_2.metrics[0].metric_name)
        self.assertEquals(
            {'remote_id': 1002, 'import_time': 1990, 'database_name': 'main'},
            json.loads(imported_table_2.json_metadata))

        # Case 3. Import table with 2 metrics and 2 columns
        table_3 = create_table(
            'table_3', id=1003, cols_names=['col1', 'col2'],
            metric_names=['metric1', 'metric2'])
        imported_table_id_3 = models.SqlaTable.import_obj(
            table_3, import_time=1991)

        imported_table_3 = get_table(imported_table_id_3)
        self.assertEquals('table_3', imported_table_3.table_name)
        self.assertEquals(2, len(imported_table_3.columns))
        self.assertEquals(
            {'col1', 'col2'},
            set([c.column_name for c in imported_table_3.columns]))
        self.assertEquals(2, len(imported_table_3.metrics))
        self.assertEquals(
            {'metric1', 'metric2'},
            set([m.metric_name for m in imported_table_3.metrics]))
        imported_table_3_id = imported_table_3.id

        # Case 4. Override table with different metrics and columns
        table_4 = create_table(
            'table_3', id=1003, cols_names=['new_col1', 'col2', 'col3'],
            metric_names=['new_metric1'])
        imported_table_id_4 = models.SqlaTable.import_obj(
            table_4, import_time=1992)

        imported_table_4 = get_table(imported_table_id_4)
        self.assertEquals('table_3', imported_table_4.table_name)
        self.assertEquals(4, len(imported_table_4.columns))
        # metrics and columns are never deleted, only appended
        self.assertEquals(
            {'col1', 'new_col1', 'col2', 'col3'},
            set([c.column_name for c in imported_table_4.columns]))
        self.assertEquals(3, len(imported_table_4.metrics))
        self.assertEquals(
            {'new_metric1', 'metric1', 'metric2'},
            set([m.metric_name for m in imported_table_4.metrics]))
        # override doesn't change the id
        self.assertEquals(imported_table_3_id, imported_table_4.id)

        # Case 5. Override with the identical table
        table_5 = create_table(
            'table_3', id=1003, cols_names=['new_col1', 'col2', 'col3'],
            metric_names=['new_metric1'])
        imported_table_id_5 = models.SqlaTable.import_obj(
            table_5, import_time=1993)

        imported_table_5 = get_table(imported_table_id_5)
        self.assertEquals('table_3', imported_table_5.table_name)
        self.assertEquals(4, len(imported_table_5.columns))
        self.assertEquals(
            {'col1', 'new_col1', 'col2', 'col3'},
            set([c.column_name for c in imported_table_5.columns]))
        self.assertEquals(3, len(imported_table_5.metrics))
        self.assertEquals(
            {'new_metric1', 'metric1', 'metric2'},
            set([m.metric_name for m in imported_table_5.metrics]))

        # cleanup
        # imported_table_3 and 4 are overriden
        for table in [imported_table_1, imported_table_2, imported_table_5]:
            for metric in table.metrics:
                session.delete(metric)
            for column in table.columns:
                session.delete(column)
            session.delete(table)
        session.commit()

if __name__ == '__main__':
    unittest.main()
