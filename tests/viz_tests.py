import unittest
import pandas as pd
import superset.viz as viz

from superset.utils import DTTM_ALIAS


class PairedTTestTestCase(unittest.TestCase):
    def test_get_data_transforms_dataframe(self):
        form_data = {
            'groupby': ['groupA', 'groupB', 'groupC'],
            'metrics': ['metric1', 'metric2', 'metric3']
        }
        datasource = {'type': 'table'}
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types['paired_ttest'](datasource, form_data)
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            'metric1': [
                {
                    'values': [
                        {'x': 100, 'y': 1},
                        {'x': 200, 'y': 2},
                        {'x': 300, 'y': 3}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 4},
                        {'x': 200, 'y': 5},
                        {'x': 300, 'y': 6}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 7},
                        {'x': 200, 'y': 8},
                        {'x': 300, 'y': 9}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
            'metric2': [
                {
                    'values': [
                        {'x': 100, 'y': 10},
                        {'x': 200, 'y': 20},
                        {'x': 300, 'y': 30}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 40},
                        {'x': 200, 'y': 50},
                        {'x': 300, 'y': 60}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 70},
                        {'x': 200, 'y': 80},
                        {'x': 300, 'y': 90}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
            'metric3': [
                {
                    'values': [
                        {'x': 100, 'y': 100},
                        {'x': 200, 'y': 200},
                        {'x': 300, 'y': 300}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 400},
                        {'x': 200, 'y': 500},
                        {'x': 300, 'y': 600}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 700},
                        {'x': 200, 'y': 800},
                        {'x': 300, 'y': 900}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
        }
        self.assertEquals(data, expected)

    def test_get_data_empty_null_keys(self):
        form_data = {
            'groupby': [],
            'metrics': ['', None]
        }
        datasource = {'type': 'table'}
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300]
        raw[''] = [1, 2, 3]
        raw[None] = [10, 20, 30]

        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types['paired_ttest'](datasource, form_data)
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            'N/A': [
                {
                    'values': [
                        {'x': 100, 'y': 1},
                        {'x': 200, 'y': 2},
                        {'x': 300, 'y': 3}],
                    'group': 'All',
                },
            ],
            'NULL': [
                {
                    'values': [
                        {'x': 100, 'y': 10},
                        {'x': 200, 'y': 20},
                        {'x': 300, 'y': 30}],
                    'group': 'All',
                },
            ],
        }
        self.assertEquals(data, expected)
