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

    examples_loaded = False

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
        self.assertTrue(exported_dashboards_1[0].position_json)
        self.assertEquals(9, len(exported_dashboards_1[0].slices))

        # export 2 dashboards
        world_health_dash = db.session.query(models.Dashboard).filter_by(
            slug='world_health').first()
        export_dash_url_2 = (
            '/dashboardmodelview/export_dashboards_form?id={}&id={}&action=go'
                .format(births_dash.id, world_health_dash.id)
        )
        resp_2 = self.client.get(export_dash_url_2)
        exported_dashboards_2 = pickle.loads(resp_2.data)['dashboards']
        self.assertEquals(2, len(exported_dashboards_2))
        self.assertEquals('births', exported_dashboards_2[0].slug)
        self.assertEquals(9, len(exported_dashboards_2[0].slices))
        self.assertEquals('world_health', exported_dashboards_2[1].slug)
        self.assertEquals(10, len(exported_dashboards_2[1].slices))

    def test_import_slice(self):
        session = db.session

        def get_slice(name, ds_id=666, slc_id=1,
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

        def find_slice(slc_id):
            return session.query(models.Slice).filter_by(id=slc_id).first()

        # Case 1. Import slice with different datasource id
        slc_id_1 = models.Slice.import_slice(
            get_slice('Import Me 1'), import_time=1989)
        slc_1 = find_slice(slc_id_1)
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
        slc_id_2 = models.Slice.import_slice(get_slice(
            'Import Me 2', ds_id=table_id, slc_id=2))
        slc_2 = find_slice(slc_id_2)
        self.assertEquals(table_id, slc_2.datasource_id)
        self.assertEquals(
            '[main].[wb_health_population](id:{})'.format(table_id),
            slc_2.perm)

        # Case 3. Import slice with non existent datasource
        with self.assertRaises(IndexError):
            models.Slice.import_slice(get_slice(
                'Import Me 3', slc_id=3, table_name='non_existent'))

        # Case 4. Older version of slice already exists, override
        slc_id_4 = models.Slice.import_slice(
            get_slice('Import Me New 1'), import_time=1990)
        slc_4 = find_slice(slc_id_4)
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

        session.delete(slc_2)
        session.delete(slc_4)
        session.commit()

    def test_import_dashboard(self):
        session = db.session

        def get_dashboard(title, id=0, slcs=[]):
            return models.Dashboard(
                id=id,
                dashboard_title=title,
                slices=slcs,
                position_json='{"size_y": 2, "size_x": 2}',
                slug='{}_imported'.format(title.lower()),
            )

        def find_dash(dash_id):
            return session.query(models.Dashboard).filter_by(
                id=dash_id).first()

        def get_slc(name, table_name, slc_id):
            params = {
                'remote_id': slc_id,
                'datasource_name': table_name,
                'database_name': 'main',
                'schema': '',
            }
            return models.Slice(
                id=slc_id,
                slice_name=name,
                datasource_type='table',
                params=json.dumps(params)
            )

        # Case 1. Import empty dashboard can be imported
        empty_dash = get_dashboard('empty_dashboard', id=1001)
        imported_dash_id_1 = models.Dashboard.import_dashboard(
            empty_dash, import_time=1989)
        # Dashboard import fails if there are no slices
        self.assertEquals(
            'empty_dashboard', find_dash(imported_dash_id_1).dashboard_title)

        # Case 2. Import dashboard with 1 new slice.
        dash_with_1_slice = get_dashboard(
            'dash_with_1_slice',
            slcs=[get_slc('health_slc', 'wb_health_population', 1001)],
            id=1002)
        imported_dash_id_2 = models.Dashboard.import_dashboard(
            dash_with_1_slice, import_time=1990)
        imported_dash_2 = find_dash(imported_dash_id_2)
        self.assertEquals('dash_with_1_slice', imported_dash_2.dashboard_title)
        self.assertEquals(1, len(imported_dash_2.slices))
        self.assertEquals('wb_health_population',
                          imported_dash_2.slices[0].datasource.table_name)
        self.assertEquals(
            {"remote_id": 1002, "import_time": 1990},
            json.loads(imported_dash_2.json_metadata))

        # Case 3. Import dashboard with 2 new slices.
        dash_with_2_slices = get_dashboard(
            'dash_with_2_slices',
            slcs=[get_slc('energy_slc', 'energy_usage', 1002),
                  get_slc('birth_slc', 'birth_names', 1003)],
            id=1003)
        imported_dash_id_3 = models.Dashboard.import_dashboard(
            dash_with_2_slices, import_time=1991)
        imported_dash_3 = find_dash(imported_dash_id_3)
        self.assertEquals('dash_with_2_slices', imported_dash_3.dashboard_title)
        self.assertEquals(2, len(imported_dash_3.slices))
        self.assertEquals(
            {"remote_id": 1003, "import_time": 1991},
            json.loads(imported_dash_3.json_metadata))
        imported_dash_slice_ids_3 = {s.id for s in imported_dash_3.slices}

        # Case 4. Override the dashboard and 2 slices
        dash_with_2_slices_new = get_dashboard(
            'dash_with_2_slices_new',
            slcs=[get_slc('energy_slc', 'energy_usage', 1002),
                  get_slc('birth_slc', 'birth_names', 1003)],
            id=1003)
        imported_dash_id_4 = models.Dashboard.import_dashboard(
            dash_with_2_slices_new, import_time=1992)
        imported_dash_4 = find_dash(imported_dash_id_4)
        self.assertEquals('dash_with_2_slices_new',
                          imported_dash_4.dashboard_title)
        self.assertEquals(2, len(imported_dash_4.slices))
        self.assertEquals(
            imported_dash_slice_ids_3, {s.id for s in imported_dash_4.slices})
        self.assertEquals(
            {"remote_id": 1003, "import_time": 1992},
            json.loads(imported_dash_4.json_metadata))

        # cleanup
        slc_to_delete = set(imported_dash_2.slices)
        slc_to_delete.update(imported_dash_4.slices)
        for slc in slc_to_delete:
            session.delete(slc)
        session.delete(imported_dash_2)
        session.delete(imported_dash_4)
        session.commit()

if __name__ == '__main__':
    unittest.main()
