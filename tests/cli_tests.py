import gzip
import json
import logging
import os
import struct
import tarfile
import tempfile

import pandas as pd

from superset import app, cli, db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.core import Dashboard, Database, Slice
from superset.utils.core import get_or_create_db_by_name
from tests.base_tests import SupersetTestCase

config = app.config


class SupersetCliTestCase(SupersetTestCase):

    @classmethod
    def setUp(cls):
        cls.runner = app.test_cli_runner()

    @classmethod
    def get_uncompressed_size(cls, file_path):
        """Last 4 bytes of a gzip file contain uncompressed size"""
        with open(file_path, 'rb') as f:
            f.seek(-4, 2)
            return struct.unpack('I', f.read(4))[0]

    @classmethod
    def gzip_file_line_count(cls, file_path):
        """Get the line count of a gzip'd CSV file"""
        with gzip.open(file_path, 'r') as f:
            for i, l in enumerate(f):
                pass
        return i + 1

    def test_version(self):
        """Test `superset version`"""
        version_result = self.runner.invoke(app.cli, ['version'])
        # Version result should contain version string
        self.assertTrue(config.get('VERSION_STRING') in version_result.output)

    def test_export_all_test_dashboards(self):
        """Test `superset export_dashboards`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(app.cli, ['export_dashboards'])
        data = json.loads(result.output)

        # Should export at least all 5 test dashboards
        self.assertGreaterEqual(len(data['dashboards']), 5)

    def test_export_dashboard_by_id(self):
        """Test `superset export_dashboards -i 3`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(app.cli, ['export_dashboards', '-i', '5'])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(lambda d: d['__Dashboard__']['id'], data['dashboards']))
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0], 5)

    def test_export_dashboard_by_title(self):
        """Test `superset export_dashboards -t World's Bank Data`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(
            app.cli, ['export_dashboards', '-t', "World's Bank Data"])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(
            lambda d: d['__Dashboard__']['dashboard_title'], data['dashboards']))
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0], "World's Bank Data")

    def test_examples_menu(self):
        """Test `superset examples` menu"""
        result = self.runner.invoke(app.cli, ['examples'])
        self.assertIn('import', result.output)
        self.assertIn('list', result.output)
        self.assertIn('remove', result.output)
        self.assertIn('export', result.output)

    def test_examples_list(self):
        """Test `superset examples list`"""
        result = self.runner.invoke(app.cli, ['examples', 'list'])

        found = False
        for i, line in enumerate(result.output.split('\n')):
            # skip header
            if i < 3:
                continue
            # Odd lines have data
            if (i % 2) != 0:
                row = line[1:-1]
                parts = [i.strip() for i in row.split('|')]
                if parts[0] == 'World Bank Health Nutrition and Population Stats':
                    found = True

        # Did we find the example in the list?
        self.assertEqual(found, True)

    def test_examples_import(self):
        """Test `superset examples import`"""
        self.runner.invoke(
            app.cli,
            [
                'examples', 'import', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )

        # Did the dashboard get imported to the main DB?
        dashboard = db.session.query(Dashboard).filter(
            Dashboard.dashboard_title.in_(["World's Bank Data"])).one()
        self.assertEqual(dashboard.dashboard_title, "World's Bank Data")

        # Temporary - substitute default
        db_name = 'main'

        # Did the data table get imported?
        SqlaTable = ConnectorRegistry.sources['table']
        table = (
            db.session.query(SqlaTable)
            .join(Database)
            .filter(
                Database.database_name == db_name and
                SqlaTable.table_name == 'wb_health_population')
        ).one()
        self.assertEqual(table.name, 'wb_health_population')

        # Did all rows get imported?
        df = pd.read_sql('SELECT * FROM wb_health_population',
                         get_or_create_db_by_name(db_name='main').get_sqla_engine())
        self.assertEqual(len(df.index), 11770)

    def test_examples_import_duplicate(self):
        """Test `superset examples import` when existing dashboard/diff uuid is present"""
        # Load a pre-existing "World's Bank" Dashboard via `superset load_examples`
        self.runner.invoke(
            app.cli,
            ['load_examples']
        )
        # Load the same dashboard but different uuids
        self.runner.invoke(
            app.cli,
            [
                'examples', 'import', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )

        # Did the dashboard get imported to the main DB more than once?
        dashboards = db.session.query(Dashboard).filter(
            Dashboard.dashboard_title.in_(["World's Bank Data"])).all()
        self.assertEqual(len(dashboards), 2)

        # Did the slices get imported to the main DB more than once?
        slices = db.session.query(Slice).filter(
            Slice.slice_name.in_(["World's Population"])
        ).all()
        self.assertEqual(len(slices), 2)

    def test_examples_import_duplicate_uuid(self):
        """Test `superset examples import` when existing dashboard/same uuid is present"""
        # Load a pre-existing "World's Bank" Dashboard
        self.runner.invoke(
            app.cli,
            [
                'examples', 'import', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )
        # Load the same dashboard but different uuids
        self.runner.invoke(
            app.cli,
            [
                'examples', 'import', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )

        # Did the dashboard get imported to the main DB just once?
        dashboards = db.session.query(Dashboard).filter(
            Dashboard.dashboard_title.in_(["World's Bank Data"])).all()
        self.assertEqual(len(dashboards), 1)

        # Did the slices get imported just once?
        slices = db.session.query(Slice).filter(
            Slice.slice_name.in_(["World's Population"])
        ).all()
        self.assertEqual(len(slices), 1)

    def test_examples_remove(self):
        """Test `superset examples remove`"""
        # First add the example...
        self.runner.invoke(
            app.cli,
            [
                'examples', 'import', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )

        # Then remove the example...
        self.runner.invoke(
            app.cli,
            [
                'examples', 'remove', '-e',
                'World Bank Health Nutrition and Population Stats',
            ],
        )

        # Is the dashboard still in the main db?
        total = db.session.query(Dashboard).filter(
            Dashboard.dashboard_title.in_(["World's Bank Data"])).count()
        self.assertEqual(total, 0)

        # Is the data table gone?
        db_name = 'main'

        # Did the data table get removed?
        SqlaTable = ConnectorRegistry.sources['table']
        total = (
            db.session.query(SqlaTable)
            .join(Database)
            .filter(
                Database.database_name == db_name and
                SqlaTable.table_name == 'wb_health_population')
        ).count()
        self.assertEqual(total, 0)

    def test_examples_export(self):
        """Test `superset examples export`"""
        # self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(
            app.cli,
            [
                'examples', 'export', '-e',
                'World Bank Health Nutrition and Population Stats', '-t',
                "World's Bank Data", '-d',
                'Health Nutrition and Population Statistics database provides key ' +
                'health, nutrition and population statistics gathered from a ' +
                'variety of international and national sources. Themes include ' +
                'global surgery, health financing, HIV/AIDS, immunization, ' +
                'infectious diseases, medical resources and usage, noncommunicable ' +
                'diseases, nutrition, population dynamics, reproductive health, ' +
                'universal health coverage, and water and sanitation.',
                '-l', 'Apache 2.0', '-u',
                'https://datacatalog.worldbank.org/dataset/' +
                'health-nutrition-and-population-statistics',
            ])
        logging.info(result.output)

        # Inspect the tarball
        with tarfile.open('dashboard.tar.gz', 'r:gz') as tar:

            # Extract all exported files to a temporary directory
            out_d = tempfile.TemporaryDirectory()

            tar.extractall(out_d.name)
            world_health_path = f'{out_d.name}{os.path.sep}world_health{os.path.sep}'

            # Check the Dashboard metadata export
            json_f = open(f'{world_health_path}/dashboard.json', 'r')
            dashboard = json.loads(json_f.read())
            desc = dashboard['description']
            self.assertEqual(
                desc['title'], 'World Bank Health Nutrition and Population Stats')
            self.assertEqual(
                desc['description'][0:30], 'Health Nutrition and Populatio')

            # Check the data export by writing out the tarball, getting the file size
            # and comparing to the metadata size
            data_file_path = f'{world_health_path}/wb_health_population.csv.gz'

            file_size = SupersetCliTestCase.get_uncompressed_size(data_file_path)
            file_size = os.path.getsize(data_file_path)
            self.assertEqual(
                desc['total_size'],
                file_size)

            # Check the data export row count against the example's description metadata
            self.assertEqual(
                desc['total_rows'],
                SupersetCliTestCase.gzip_file_line_count(data_file_path))

            out_d.cleanup()
