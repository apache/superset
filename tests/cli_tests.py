import gzip
import json
import logging
import os
import struct
import tarfile
import tempfile

from superset import app, cli
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
        result = self.runner.invoke(
            app.cli, ['examples', 'list'])

        print("results.output", result.output)
        found = False
        for i, line in enumerate(result.output.split('\n')):
            # skip header
            if i < 3:
                continue
            # Odd lines have data
            if (i % 2) != 1:
                row = line[1:-1]
                parts = [i.strip() for i in row.split('|')]
                if parts[0] == 'World Bank Health Information':
                    found = True

        # Did we find the example in the list?
        self.assertEqual(found, True)

    def test_examples_import(self):
        """Test `superset examples import`"""
        result = self.runner.invoke(
            app.cli,
            [
                'examples', 'import', 
            ]
        )

    def test_examples_remove(self):
        """Test `superset examples remove`"""
        pass

    def test_examples_export(self):
        """Test `superset examples export`"""
        # self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(
            app.cli,
            [
                'examples', 'export', '--dashboard-title', 'World\'s Bank Data',
                '--description',
                'World Bank Data example about world health populations from 1960-2010.',
                '--example-title', 'World Bank Health Information',
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
            self.assertEqual(desc['title'], 'World Bank Health Information')
            self.assertEqual(
                desc['description'],
                'World Bank Data example about world health populations from 1960-2010.',
            )

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
