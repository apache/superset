"""Tests for Table Schema integration."""
import json
from collections import OrderedDict

import numpy as np
import pandas as pd
import pytest

from pandas import DataFrame
from pandas.core.dtypes.dtypes import (
    PeriodDtype, CategoricalDtype, DatetimeTZDtype)
from pandas.io.json.table_schema import (
    as_json_table_type,
    build_table_schema,
    make_field,
    set_default_names)


class TestBuildSchema(object):

    def setup_method(self, method):
        self.df = DataFrame(
            {'A': [1, 2, 3, 4],
             'B': ['a', 'b', 'c', 'c'],
             'C': pd.date_range('2016-01-01', freq='d', periods=4),
             'D': pd.timedelta_range('1H', periods=4, freq='T'),
             },
            index=pd.Index(range(4), name='idx'))

    def test_build_table_schema(self):
        result = build_table_schema(self.df, version=False)
        expected = {
            'fields': [{'name': 'idx', 'type': 'integer'},
                       {'name': 'A', 'type': 'integer'},
                       {'name': 'B', 'type': 'string'},
                       {'name': 'C', 'type': 'datetime'},
                       {'name': 'D', 'type': 'duration'},
                       ],
            'primaryKey': ['idx']
        }
        assert result == expected
        result = build_table_schema(self.df)
        assert "pandas_version" in result

    def test_series(self):
        s = pd.Series([1, 2, 3], name='foo')
        result = build_table_schema(s, version=False)
        expected = {'fields': [{'name': 'index', 'type': 'integer'},
                               {'name': 'foo', 'type': 'integer'}],
                    'primaryKey': ['index']}
        assert result == expected
        result = build_table_schema(s)
        assert 'pandas_version' in result

    def tets_series_unnamed(self):
        result = build_table_schema(pd.Series([1, 2, 3]), version=False)
        expected = {'fields': [{'name': 'index', 'type': 'integer'},
                               {'name': 'values', 'type': 'integer'}],
                    'primaryKey': ['index']}
        assert result == expected

    def test_multiindex(self):
        df = self.df.copy()
        idx = pd.MultiIndex.from_product([('a', 'b'), (1, 2)])
        df.index = idx

        result = build_table_schema(df, version=False)
        expected = {
            'fields': [{'name': 'level_0', 'type': 'string'},
                       {'name': 'level_1', 'type': 'integer'},
                       {'name': 'A', 'type': 'integer'},
                       {'name': 'B', 'type': 'string'},
                       {'name': 'C', 'type': 'datetime'},
                       {'name': 'D', 'type': 'duration'},
                       ],
            'primaryKey': ['level_0', 'level_1']
        }
        assert result == expected

        df.index.names = ['idx0', None]
        expected['fields'][0]['name'] = 'idx0'
        expected['primaryKey'] = ['idx0', 'level_1']
        result = build_table_schema(df, version=False)
        assert result == expected


class TestTableSchemaType(object):

    def test_as_json_table_type_int_data(self):
        int_data = [1, 2, 3]
        int_types = [np.int, np.int16, np.int32, np.int64]
        for t in int_types:
            assert as_json_table_type(np.array(
                int_data, dtype=t)) == 'integer'

    def test_as_json_table_type_float_data(self):
        float_data = [1., 2., 3.]
        float_types = [np.float, np.float16, np.float32, np.float64]
        for t in float_types:
            assert as_json_table_type(np.array(
                float_data, dtype=t)) == 'number'

    def test_as_json_table_type_bool_data(self):
        bool_data = [True, False]
        bool_types = [bool, np.bool]
        for t in bool_types:
            assert as_json_table_type(np.array(
                bool_data, dtype=t)) == 'boolean'

    def test_as_json_table_type_date_data(self):
        date_data = [pd.to_datetime(['2016']),
                     pd.to_datetime(['2016'], utc=True),
                     pd.Series(pd.to_datetime(['2016'])),
                     pd.Series(pd.to_datetime(['2016'], utc=True)),
                     pd.period_range('2016', freq='A', periods=3)]
        for arr in date_data:
            assert as_json_table_type(arr) == 'datetime'

    def test_as_json_table_type_string_data(self):
        strings = [pd.Series(['a', 'b']), pd.Index(['a', 'b'])]
        for t in strings:
            assert as_json_table_type(t) == 'string'

    def test_as_json_table_type_categorical_data(self):
        assert as_json_table_type(pd.Categorical(['a'])) == 'any'
        assert as_json_table_type(pd.Categorical([1])) == 'any'
        assert as_json_table_type(pd.Series(pd.Categorical([1]))) == 'any'
        assert as_json_table_type(pd.CategoricalIndex([1])) == 'any'
        assert as_json_table_type(pd.Categorical([1])) == 'any'

    # ------
    # dtypes
    # ------
    def test_as_json_table_type_int_dtypes(self):
        integers = [np.int, np.int16, np.int32, np.int64]
        for t in integers:
            assert as_json_table_type(t) == 'integer'

    def test_as_json_table_type_float_dtypes(self):
        floats = [np.float, np.float16, np.float32, np.float64]
        for t in floats:
            assert as_json_table_type(t) == 'number'

    def test_as_json_table_type_bool_dtypes(self):
        bools = [bool, np.bool]
        for t in bools:
            assert as_json_table_type(t) == 'boolean'

    def test_as_json_table_type_date_dtypes(self):
        # TODO: datedate.date? datetime.time?
        dates = [np.datetime64, np.dtype("<M8[ns]"), PeriodDtype(),
                 DatetimeTZDtype('ns', 'US/Central')]
        for t in dates:
            assert as_json_table_type(t) == 'datetime'

    def test_as_json_table_type_timedelta_dtypes(self):
        durations = [np.timedelta64, np.dtype("<m8[ns]")]
        for t in durations:
            assert as_json_table_type(t) == 'duration'

    def test_as_json_table_type_string_dtypes(self):
        strings = [object]  # TODO
        for t in strings:
            assert as_json_table_type(t) == 'string'

    def test_as_json_table_type_categorical_dtypes(self):
        assert as_json_table_type(pd.Categorical) == 'any'
        assert as_json_table_type(CategoricalDtype()) == 'any'


class TestTableOrient(object):

    def setup_method(self, method):
        self.df = DataFrame(
            {'A': [1, 2, 3, 4],
             'B': ['a', 'b', 'c', 'c'],
             'C': pd.date_range('2016-01-01', freq='d', periods=4),
             'D': pd.timedelta_range('1H', periods=4, freq='T'),
             'E': pd.Series(pd.Categorical(['a', 'b', 'c', 'c'])),
             'F': pd.Series(pd.Categorical(['a', 'b', 'c', 'c'],
                                           ordered=True)),
             'G': [1., 2., 3, 4.],
             'H': pd.date_range('2016-01-01', freq='d', periods=4,
                                tz='US/Central'),
             },
            index=pd.Index(range(4), name='idx'))

    def test_build_series(self):
        s = pd.Series([1, 2], name='a')
        s.index.name = 'id'
        result = s.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)

        assert "pandas_version" in result['schema']
        result['schema'].pop('pandas_version')

        fields = [{'name': 'id', 'type': 'integer'},
                  {'name': 'a', 'type': 'integer'}]

        schema = {
            'fields': fields,
            'primaryKey': ['id'],
        }

        expected = OrderedDict([
            ('schema', schema),
            ('data', [OrderedDict([('id', 0), ('a', 1)]),
                      OrderedDict([('id', 1), ('a', 2)])])])
        assert result == expected

    def test_to_json(self):
        df = self.df.copy()
        df.index.name = 'idx'
        result = df.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)

        assert "pandas_version" in result['schema']
        result['schema'].pop('pandas_version')

        fields = [
            {'name': 'idx', 'type': 'integer'},
            {'name': 'A', 'type': 'integer'},
            {'name': 'B', 'type': 'string'},
            {'name': 'C', 'type': 'datetime'},
            {'name': 'D', 'type': 'duration'},
            {'constraints': {'enum': ['a', 'b', 'c']},
             'name': 'E',
             'ordered': False,
             'type': 'any'},
            {'constraints': {'enum': ['a', 'b', 'c']},
             'name': 'F',
             'ordered': True,
             'type': 'any'},
            {'name': 'G', 'type': 'number'},
            {'name': 'H', 'type': 'datetime', 'tz': 'US/Central'}
        ]

        schema = {
            'fields': fields,
            'primaryKey': ['idx'],
        }
        data = [
            OrderedDict([('idx', 0), ('A', 1), ('B', 'a'),
                         ('C', '2016-01-01T00:00:00.000Z'),
                         ('D', 'P0DT1H0M0S'),
                         ('E', 'a'), ('F', 'a'), ('G', 1.),
                         ('H', '2016-01-01T06:00:00.000Z')
                         ]),
            OrderedDict([('idx', 1), ('A', 2), ('B', 'b'),
                         ('C', '2016-01-02T00:00:00.000Z'),
                         ('D', 'P0DT1H1M0S'),
                         ('E', 'b'), ('F', 'b'), ('G', 2.),
                         ('H', '2016-01-02T06:00:00.000Z')
                         ]),
            OrderedDict([('idx', 2), ('A', 3), ('B', 'c'),
                         ('C', '2016-01-03T00:00:00.000Z'),
                         ('D', 'P0DT1H2M0S'),
                         ('E', 'c'), ('F', 'c'), ('G', 3.),
                         ('H', '2016-01-03T06:00:00.000Z')
                         ]),
            OrderedDict([('idx', 3), ('A', 4), ('B', 'c'),
                         ('C', '2016-01-04T00:00:00.000Z'),
                         ('D', 'P0DT1H3M0S'),
                         ('E', 'c'), ('F', 'c'), ('G', 4.),
                         ('H', '2016-01-04T06:00:00.000Z')
                         ]),
        ]
        expected = OrderedDict([('schema', schema), ('data', data)])
        assert result == expected

    def test_to_json_float_index(self):
        data = pd.Series(1, index=[1., 2.])
        result = data.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)
        result['schema'].pop('pandas_version')

        expected = (
            OrderedDict([('schema', {
                'fields': [{'name': 'index', 'type': 'number'},
                           {'name': 'values', 'type': 'integer'}],
                'primaryKey': ['index']
            }),
                ('data', [OrderedDict([('index', 1.0), ('values', 1)]),
                          OrderedDict([('index', 2.0), ('values', 1)])])])
        )
        assert result == expected

    def test_to_json_period_index(self):
        idx = pd.period_range('2016', freq='Q-JAN', periods=2)
        data = pd.Series(1, idx)
        result = data.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)
        result['schema'].pop('pandas_version')

        fields = [{'freq': 'Q-JAN', 'name': 'index', 'type': 'datetime'},
                  {'name': 'values', 'type': 'integer'}]

        schema = {'fields': fields, 'primaryKey': ['index']}
        data = [OrderedDict([('index', '2015-11-01T00:00:00.000Z'),
                             ('values', 1)]),
                OrderedDict([('index', '2016-02-01T00:00:00.000Z'),
                             ('values', 1)])]
        expected = OrderedDict([('schema', schema), ('data', data)])
        assert result == expected

    def test_to_json_categorical_index(self):
        data = pd.Series(1, pd.CategoricalIndex(['a', 'b']))
        result = data.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)
        result['schema'].pop('pandas_version')

        expected = (
            OrderedDict([('schema',
                          {'fields': [{'name': 'index', 'type': 'any',
                                       'constraints': {'enum': ['a', 'b']},
                                       'ordered': False},
                                      {'name': 'values', 'type': 'integer'}],
                           'primaryKey': ['index']}),
                         ('data', [
                             OrderedDict([('index', 'a'),
                                          ('values', 1)]),
                             OrderedDict([('index', 'b'), ('values', 1)])])])
        )
        assert result == expected

    def test_date_format_raises(self):
        with pytest.raises(ValueError):
            self.df.to_json(orient='table', date_format='epoch')

        # others work
        self.df.to_json(orient='table', date_format='iso')
        self.df.to_json(orient='table')

    def test_make_field_int(self):
        data = [1, 2, 3]
        kinds = [pd.Series(data, name='name'), pd.Index(data, name='name')]
        for kind in kinds:
            result = make_field(kind)
            expected = {"name": "name", "type": 'integer'}
            assert result == expected

    def test_make_field_float(self):
        data = [1., 2., 3.]
        kinds = [pd.Series(data, name='name'), pd.Index(data, name='name')]
        for kind in kinds:
            result = make_field(kind)
            expected = {"name": "name", "type": 'number'}
            assert result == expected

    def test_make_field_datetime(self):
        data = [1., 2., 3.]
        kinds = [pd.Series(pd.to_datetime(data), name='values'),
                 pd.to_datetime(data)]
        for kind in kinds:
            result = make_field(kind)
            expected = {"name": "values", "type": 'datetime'}
            assert result == expected

        kinds = [pd.Series(pd.to_datetime(data, utc=True), name='values'),
                 pd.to_datetime(data, utc=True)]
        for kind in kinds:
            result = make_field(kind)
            expected = {"name": "values", "type": 'datetime', "tz": "UTC"}
            assert result == expected

        arr = pd.period_range('2016', freq='A-DEC', periods=4)
        result = make_field(arr)
        expected = {"name": "values", "type": 'datetime', "freq": "A-DEC"}
        assert result == expected

    def test_make_field_categorical(self):
        data = ['a', 'b', 'c']
        ordereds = [True, False]

        for ordered in ordereds:
            arr = pd.Series(pd.Categorical(data, ordered=ordered), name='cats')
            result = make_field(arr)
            expected = {"name": "cats", "type": "any",
                        "constraints": {"enum": data},
                        "ordered": ordered}
            assert result == expected

            arr = pd.CategoricalIndex(data, ordered=ordered, name='cats')
            result = make_field(arr)
            expected = {"name": "cats", "type": "any",
                        "constraints": {"enum": data},
                        "ordered": ordered}
            assert result == expected

    def test_categorical(self):
        s = pd.Series(pd.Categorical(['a', 'b', 'a']))
        s.index.name = 'idx'
        result = s.to_json(orient='table', date_format='iso')
        result = json.loads(result, object_pairs_hook=OrderedDict)
        result['schema'].pop('pandas_version')

        fields = [{'name': 'idx', 'type': 'integer'},
                  {'constraints': {'enum': ['a', 'b']},
                   'name': 'values',
                   'ordered': False,
                   'type': 'any'}]

        expected = OrderedDict([
            ('schema', {'fields': fields,
                        'primaryKey': ['idx']}),
            ('data', [OrderedDict([('idx', 0), ('values', 'a')]),
                      OrderedDict([('idx', 1), ('values', 'b')]),
                      OrderedDict([('idx', 2), ('values', 'a')])])])
        assert result == expected

    def test_set_default_names_unset(self):
        data = pd.Series(1, pd.Index([1]))
        result = set_default_names(data)
        assert result.index.name == 'index'

    def test_set_default_names_set(self):
        data = pd.Series(1, pd.Index([1], name='myname'))
        result = set_default_names(data)
        assert result.index.name == 'myname'

    def test_set_default_names_mi_unset(self):
        data = pd.Series(
            1, pd.MultiIndex.from_product([('a', 'b'), ('c', 'd')]))
        result = set_default_names(data)
        assert result.index.names == ['level_0', 'level_1']

    def test_set_default_names_mi_set(self):
        data = pd.Series(
            1, pd.MultiIndex.from_product([('a', 'b'), ('c', 'd')],
                                          names=['n1', 'n2']))
        result = set_default_names(data)
        assert result.index.names == ['n1', 'n2']

    def test_set_default_names_mi_partion(self):
        data = pd.Series(
            1, pd.MultiIndex.from_product([('a', 'b'), ('c', 'd')],
                                          names=['n1', None]))
        result = set_default_names(data)
        assert result.index.names == ['n1', 'level_1']

    def test_timestamp_in_columns(self):
        df = pd.DataFrame([[1, 2]], columns=[pd.Timestamp('2016'),
                                             pd.Timedelta(10, unit='s')])
        result = df.to_json(orient="table")
        js = json.loads(result)
        assert js['schema']['fields'][1]['name'] == 1451606400000
        assert js['schema']['fields'][2]['name'] == 10000

    def test_overlapping_names(self):
        cases = [
            pd.Series([1], index=pd.Index([1], name='a'), name='a'),
            pd.DataFrame({"A": [1]}, index=pd.Index([1], name="A")),
            pd.DataFrame({"A": [1]}, index=pd.MultiIndex.from_arrays([
                ['a'], [1]
            ], names=["A", "a"])),
        ]

        for data in cases:
            with pytest.raises(ValueError) as excinfo:
                data.to_json(orient='table')

            assert 'Overlapping' in str(excinfo.value)

    def test_mi_falsey_name(self):
        # GH 16203
        df = pd.DataFrame(np.random.randn(4, 4),
                          index=pd.MultiIndex.from_product([('A', 'B'),
                                                            ('a', 'b')]))
        result = [x['name'] for x in build_table_schema(df)['fields']]
        assert result == ['level_0', 'level_1', 0, 1, 2, 3]
