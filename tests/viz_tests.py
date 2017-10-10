import unittest
import pandas as pd
import superset.viz as viz

from superset.utils import DTTM_ALIAS
from mock import Mock, patch


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


class PartitionVizTestCase(unittest.TestCase):

    @patch('superset.viz.BaseViz.query_obj')
    def test_query_obj_time_series_option(self, super_query_obj):
        datasource = Mock()
        form_data = {}
        test_viz = viz.PartitionViz(datasource, form_data)
        super_query_obj.return_value = {}
        query_obj = test_viz.query_obj()
        self.assertFalse(query_obj['is_timeseries'])
        test_viz.form_data['time_series_option'] = 'agg_sum'
        query_obj = test_viz.query_obj()
        self.assertTrue(query_obj['is_timeseries'])

    def test_levels_for_computes_levels(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ['groupA', 'groupB', 'groupC']
        time_op = 'agg_sum'
        test_viz = viz.PartitionViz(Mock(), {})
        levels = test_viz.levels_for(time_op, groups, df)
        self.assertEqual(4, len(levels))
        expected = {
            DTTM_ALIAS: 1800,
            'metric1': 45,
            'metric2': 450,
            'metric3': 4500,
        }
        self.assertEqual(expected, levels[0].to_dict())
        expected = {
            DTTM_ALIAS: {'a1': 600, 'b1': 600, 'c1': 600},
            'metric1': {'a1': 6, 'b1': 15, 'c1': 24},
            'metric2': {'a1': 60, 'b1': 150, 'c1': 240},
            'metric3': {'a1': 600, 'b1': 1500, 'c1': 2400},
        }
        self.assertEqual(expected, levels[1].to_dict())
        self.assertEqual(['groupA', 'groupB'], levels[2].index.names)
        self.assertEqual(
            ['groupA', 'groupB', 'groupC'],
            levels[3].index.names,
        )
        time_op = 'agg_mean'
        levels = test_viz.levels_for(time_op, groups, df)
        self.assertEqual(4, len(levels))
        expected = {
            DTTM_ALIAS: 200.0,
            'metric1': 5.0,
            'metric2': 50.0,
            'metric3': 500.0,
        }
        self.assertEqual(expected, levels[0].to_dict())
        expected = {
            DTTM_ALIAS: {'a1': 200, 'c1': 200, 'b1': 200},
            'metric1': {'a1': 2, 'b1': 5, 'c1': 8},
            'metric2': {'a1': 20, 'b1': 50, 'c1': 80},
            'metric3': {'a1': 200, 'b1': 500, 'c1': 800},
        }
        self.assertEqual(expected, levels[1].to_dict())
        self.assertEqual(['groupA', 'groupB'], levels[2].index.names)
        self.assertEqual(
            ['groupA', 'groupB', 'groupC'],
            levels[3].index.names,
        )

    def test_levels_for_diff_computes_difference(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ['groupA', 'groupB', 'groupC']
        test_viz = viz.PartitionViz(Mock(), {})
        time_op = 'point_diff'
        levels = test_viz.levels_for_diff(time_op, groups, df)
        expected = {
            'metric1': 6,
            'metric2': 60,
            'metric3': 600,
        }
        self.assertEqual(expected, levels[0].to_dict())
        expected = {
            'metric1': {'a1': 2, 'b1': 2, 'c1': 2},
            'metric2': {'a1': 20, 'b1': 20, 'c1': 20},
            'metric3': {'a1': 200, 'b1': 200, 'c1': 200},
        }
        self.assertEqual(expected, levels[1].to_dict())
        self.assertEqual(4, len(levels))
        self.assertEqual(['groupA', 'groupB', 'groupC'], levels[3].index.names)

    def test_levels_for_time_calls_process_data_and_drops_cols(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        groups = ['groupA', 'groupB', 'groupC']
        test_viz = viz.PartitionViz(Mock(), {'groupby': groups})

        def return_args(df_drop, aggregate):
            return df_drop
        test_viz.process_data = Mock(side_effect=return_args)
        levels = test_viz.levels_for_time(groups, df)
        self.assertEqual(4, len(levels))
        cols = [DTTM_ALIAS, 'metric1', 'metric2', 'metric3']
        self.assertEqual(sorted(cols), sorted(levels[0].columns.tolist()))
        cols += ['groupA']
        self.assertEqual(sorted(cols), sorted(levels[1].columns.tolist()))
        cols += ['groupB']
        self.assertEqual(sorted(cols), sorted(levels[2].columns.tolist()))
        cols += ['groupC']
        self.assertEqual(sorted(cols), sorted(levels[3].columns.tolist()))
        self.assertEqual(4, len(test_viz.process_data.mock_calls))

    def test_nest_values_returns_hierarchy(self):
        raw = {}
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        groups = ['groupA', 'groupB', 'groupC']
        levels = test_viz.levels_for('agg_sum', groups, df)
        nest = test_viz.nest_values(levels)
        self.assertEqual(3, len(nest))
        for i in range(0, 3):
            self.assertEqual('metric' + str(i + 1), nest[i]['name'])
        self.assertEqual(3, len(nest[0]['children']))
        self.assertEqual(1, len(nest[0]['children'][0]['children']))
        self.assertEqual(1, len(nest[0]['children'][0]['children'][0]['children']))

    def test_nest_procs_returns_hierarchy(self):
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        test_viz = viz.PartitionViz(Mock(), {})
        groups = ['groupA', 'groupB', 'groupC']
        metrics = ['metric1', 'metric2', 'metric3']
        procs = {}
        for i in range(0, 4):
            df_drop = df.drop(groups[i:], 1)
            pivot = df_drop.pivot_table(
                index=DTTM_ALIAS,
                columns=groups[:i],
                values=metrics,
            )
            procs[i] = pivot
        nest = test_viz.nest_procs(procs)
        self.assertEqual(3, len(nest))
        for i in range(0, 3):
            self.assertEqual('metric' + str(i + 1), nest[i]['name'])
            self.assertEqual(None, nest[i].get('val'))
        self.assertEqual(3, len(nest[0]['children']))
        self.assertEqual(3, len(nest[0]['children'][0]['children']))
        self.assertEqual(1, len(nest[0]['children'][0]['children'][0]['children']))
        self.assertEqual(1,
            len(nest[0]['children']
                [0]['children']
                [0]['children']
                [0]['children'])
        )

    def test_get_data_calls_correct_method(self):
        test_viz = viz.PartitionViz(Mock(), {})
        df = Mock()
        with self.assertRaises(ValueError):
            test_viz.get_data(df)
        test_viz.levels_for = Mock(return_value=1)
        test_viz.nest_values = Mock(return_value=1)
        test_viz.form_data['groupby'] = ['groups']
        test_viz.form_data['time_series_option'] = 'not_time'
        test_viz.get_data(df)
        self.assertEqual('agg_sum', test_viz.levels_for.mock_calls[0][1][0])
        test_viz.form_data['time_series_option'] = 'agg_sum'
        test_viz.get_data(df)
        self.assertEqual('agg_sum', test_viz.levels_for.mock_calls[1][1][0])
        test_viz.form_data['time_series_option'] = 'agg_mean'
        test_viz.get_data(df)
        self.assertEqual('agg_mean', test_viz.levels_for.mock_calls[2][1][0])
        test_viz.form_data['time_series_option'] = 'point_diff'
        test_viz.levels_for_diff = Mock(return_value=1)
        test_viz.get_data(df)
        self.assertEqual('point_diff', test_viz.levels_for_diff.mock_calls[0][1][0])
        test_viz.form_data['time_series_option'] = 'point_percent'
        test_viz.get_data(df)
        self.assertEqual('point_percent', test_viz.levels_for_diff.mock_calls[1][1][0])
        test_viz.form_data['time_series_option'] = 'point_factor'
        test_viz.get_data(df)
        self.assertEqual('point_factor', test_viz.levels_for_diff.mock_calls[2][1][0])
        test_viz.levels_for_time = Mock(return_value=1)
        test_viz.nest_procs = Mock(return_value=1)
        test_viz.form_data['time_series_option'] = 'adv_anal'
        test_viz.get_data(df)
        self.assertEqual(1, len(test_viz.levels_for_time.mock_calls))
        self.assertEqual(1, len(test_viz.nest_procs.mock_calls))
        test_viz.form_data['time_series_option'] = 'time_series'
        test_viz.get_data(df)
        self.assertEqual('agg_sum', test_viz.levels_for.mock_calls[3][1][0])
        self.assertEqual(7, len(test_viz.nest_values.mock_calls))
