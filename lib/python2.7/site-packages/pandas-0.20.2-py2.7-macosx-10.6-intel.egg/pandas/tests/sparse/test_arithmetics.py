import numpy as np
import pandas as pd
import pandas.util.testing as tm


class TestSparseArrayArithmetics(object):

    _base = np.array
    _klass = pd.SparseArray

    def _assert(self, a, b):
        tm.assert_numpy_array_equal(a, b)

    def _check_numeric_ops(self, a, b, a_dense, b_dense):
        with np.errstate(invalid='ignore', divide='ignore'):
            # Unfortunately, trying to wrap the computation of each expected
            # value is with np.errstate() is too tedious.

            # sparse & sparse
            self._assert((a + b).to_dense(), a_dense + b_dense)
            self._assert((b + a).to_dense(), b_dense + a_dense)

            self._assert((a - b).to_dense(), a_dense - b_dense)
            self._assert((b - a).to_dense(), b_dense - a_dense)

            self._assert((a * b).to_dense(), a_dense * b_dense)
            self._assert((b * a).to_dense(), b_dense * a_dense)

            # pandas uses future division
            self._assert((a / b).to_dense(), a_dense * 1.0 / b_dense)
            self._assert((b / a).to_dense(), b_dense * 1.0 / a_dense)

            # ToDo: FIXME in GH 13843
            if not (self._base == pd.Series and a.dtype == 'int64'):
                self._assert((a // b).to_dense(), a_dense // b_dense)
                self._assert((b // a).to_dense(), b_dense // a_dense)

            self._assert((a % b).to_dense(), a_dense % b_dense)
            self._assert((b % a).to_dense(), b_dense % a_dense)

            self._assert((a ** b).to_dense(), a_dense ** b_dense)
            self._assert((b ** a).to_dense(), b_dense ** a_dense)

            # sparse & dense
            self._assert((a + b_dense).to_dense(), a_dense + b_dense)
            self._assert((b_dense + a).to_dense(), b_dense + a_dense)

            self._assert((a - b_dense).to_dense(), a_dense - b_dense)
            self._assert((b_dense - a).to_dense(), b_dense - a_dense)

            self._assert((a * b_dense).to_dense(), a_dense * b_dense)
            self._assert((b_dense * a).to_dense(), b_dense * a_dense)

            # pandas uses future division
            self._assert((a / b_dense).to_dense(), a_dense * 1.0 / b_dense)
            self._assert((b_dense / a).to_dense(), b_dense * 1.0 / a_dense)

            # ToDo: FIXME in GH 13843
            if not (self._base == pd.Series and a.dtype == 'int64'):
                self._assert((a // b_dense).to_dense(), a_dense // b_dense)
                self._assert((b_dense // a).to_dense(), b_dense // a_dense)

            self._assert((a % b_dense).to_dense(), a_dense % b_dense)
            self._assert((b_dense % a).to_dense(), b_dense % a_dense)

            self._assert((a ** b_dense).to_dense(), a_dense ** b_dense)
            self._assert((b_dense ** a).to_dense(), b_dense ** a_dense)

    def _check_bool_result(self, res):
        assert isinstance(res, self._klass)
        assert res.dtype == np.bool
        assert isinstance(res.fill_value, bool)

    def _check_comparison_ops(self, a, b, a_dense, b_dense):
        with np.errstate(invalid='ignore'):
            # Unfortunately, trying to wrap the computation of each expected
            # value is with np.errstate() is too tedious.
            #
            # sparse & sparse
            self._check_bool_result(a == b)
            self._assert((a == b).to_dense(), a_dense == b_dense)

            self._check_bool_result(a != b)
            self._assert((a != b).to_dense(), a_dense != b_dense)

            self._check_bool_result(a >= b)
            self._assert((a >= b).to_dense(), a_dense >= b_dense)

            self._check_bool_result(a <= b)
            self._assert((a <= b).to_dense(), a_dense <= b_dense)

            self._check_bool_result(a > b)
            self._assert((a > b).to_dense(), a_dense > b_dense)

            self._check_bool_result(a < b)
            self._assert((a < b).to_dense(), a_dense < b_dense)

            # sparse & dense
            self._check_bool_result(a == b_dense)
            self._assert((a == b_dense).to_dense(), a_dense == b_dense)

            self._check_bool_result(a != b_dense)
            self._assert((a != b_dense).to_dense(), a_dense != b_dense)

            self._check_bool_result(a >= b_dense)
            self._assert((a >= b_dense).to_dense(), a_dense >= b_dense)

            self._check_bool_result(a <= b_dense)
            self._assert((a <= b_dense).to_dense(), a_dense <= b_dense)

            self._check_bool_result(a > b_dense)
            self._assert((a > b_dense).to_dense(), a_dense > b_dense)

            self._check_bool_result(a < b_dense)
            self._assert((a < b_dense).to_dense(), a_dense < b_dense)

    def _check_logical_ops(self, a, b, a_dense, b_dense):
        # sparse & sparse
        self._check_bool_result(a & b)
        self._assert((a & b).to_dense(), a_dense & b_dense)

        self._check_bool_result(a | b)
        self._assert((a | b).to_dense(), a_dense | b_dense)
        # sparse & dense
        self._check_bool_result(a & b_dense)
        self._assert((a & b_dense).to_dense(), a_dense & b_dense)

        self._check_bool_result(a | b_dense)
        self._assert((a | b_dense).to_dense(), a_dense | b_dense)

    def test_float_scalar(self):
        values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])

        for kind in ['integer', 'block']:
            a = self._klass(values, kind=kind)
            self._check_numeric_ops(a, 1, values, 1)
            self._check_numeric_ops(a, 0, values, 0)
            self._check_numeric_ops(a, 3, values, 3)

            a = self._klass(values, kind=kind, fill_value=0)
            self._check_numeric_ops(a, 1, values, 1)
            self._check_numeric_ops(a, 0, values, 0)
            self._check_numeric_ops(a, 3, values, 3)

            a = self._klass(values, kind=kind, fill_value=2)
            self._check_numeric_ops(a, 1, values, 1)
            self._check_numeric_ops(a, 0, values, 0)
            self._check_numeric_ops(a, 3, values, 3)

    def test_float_scalar_comparison(self):
        values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])

        for kind in ['integer', 'block']:
            a = self._klass(values, kind=kind)
            self._check_comparison_ops(a, 1, values, 1)
            self._check_comparison_ops(a, 0, values, 0)
            self._check_comparison_ops(a, 3, values, 3)

            a = self._klass(values, kind=kind, fill_value=0)
            self._check_comparison_ops(a, 1, values, 1)
            self._check_comparison_ops(a, 0, values, 0)
            self._check_comparison_ops(a, 3, values, 3)

            a = self._klass(values, kind=kind, fill_value=2)
            self._check_comparison_ops(a, 1, values, 1)
            self._check_comparison_ops(a, 0, values, 0)
            self._check_comparison_ops(a, 3, values, 3)

    def test_float_same_index(self):
        # when sp_index are the same
        for kind in ['integer', 'block']:
            values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
            rvalues = self._base([np.nan, 2, 3, 4, np.nan, 0, 1, 3, 2, np.nan])

            a = self._klass(values, kind=kind)
            b = self._klass(rvalues, kind=kind)
            self._check_numeric_ops(a, b, values, rvalues)

            values = self._base([0., 1., 2., 6., 0., 0., 1., 2., 1., 0.])
            rvalues = self._base([0., 2., 3., 4., 0., 0., 1., 3., 2., 0.])

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind, fill_value=0)
            self._check_numeric_ops(a, b, values, rvalues)

    def test_float_same_index_comparison(self):
        # when sp_index are the same
        for kind in ['integer', 'block']:
            values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
            rvalues = self._base([np.nan, 2, 3, 4, np.nan, 0, 1, 3, 2, np.nan])

            a = self._klass(values, kind=kind)
            b = self._klass(rvalues, kind=kind)
            self._check_comparison_ops(a, b, values, rvalues)

            values = self._base([0., 1., 2., 6., 0., 0., 1., 2., 1., 0.])
            rvalues = self._base([0., 2., 3., 4., 0., 0., 1., 3., 2., 0.])

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind, fill_value=0)
            self._check_comparison_ops(a, b, values, rvalues)

    def test_float_array(self):
        values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
        rvalues = self._base([2, np.nan, 2, 3, np.nan, 0, 1, 5, 2, np.nan])

        for kind in ['integer', 'block']:
            a = self._klass(values, kind=kind)
            b = self._klass(rvalues, kind=kind)
            self._check_numeric_ops(a, b, values, rvalues)
            self._check_numeric_ops(a, b * 0, values, rvalues * 0)

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind)
            self._check_numeric_ops(a, b, values, rvalues)

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind, fill_value=0)
            self._check_numeric_ops(a, b, values, rvalues)

            a = self._klass(values, kind=kind, fill_value=1)
            b = self._klass(rvalues, kind=kind, fill_value=2)
            self._check_numeric_ops(a, b, values, rvalues)

    def test_float_array_different_kind(self):
        values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
        rvalues = self._base([2, np.nan, 2, 3, np.nan, 0, 1, 5, 2, np.nan])

        a = self._klass(values, kind='integer')
        b = self._klass(rvalues, kind='block')
        self._check_numeric_ops(a, b, values, rvalues)
        self._check_numeric_ops(a, b * 0, values, rvalues * 0)

        a = self._klass(values, kind='integer', fill_value=0)
        b = self._klass(rvalues, kind='block')
        self._check_numeric_ops(a, b, values, rvalues)

        a = self._klass(values, kind='integer', fill_value=0)
        b = self._klass(rvalues, kind='block', fill_value=0)
        self._check_numeric_ops(a, b, values, rvalues)

        a = self._klass(values, kind='integer', fill_value=1)
        b = self._klass(rvalues, kind='block', fill_value=2)
        self._check_numeric_ops(a, b, values, rvalues)

    def test_float_array_comparison(self):
        values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
        rvalues = self._base([2, np.nan, 2, 3, np.nan, 0, 1, 5, 2, np.nan])

        for kind in ['integer', 'block']:
            a = self._klass(values, kind=kind)
            b = self._klass(rvalues, kind=kind)
            self._check_comparison_ops(a, b, values, rvalues)
            self._check_comparison_ops(a, b * 0, values, rvalues * 0)

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind)
            self._check_comparison_ops(a, b, values, rvalues)

            a = self._klass(values, kind=kind, fill_value=0)
            b = self._klass(rvalues, kind=kind, fill_value=0)
            self._check_comparison_ops(a, b, values, rvalues)

            a = self._klass(values, kind=kind, fill_value=1)
            b = self._klass(rvalues, kind=kind, fill_value=2)
            self._check_comparison_ops(a, b, values, rvalues)

    def test_int_array(self):
        # have to specify dtype explicitly until fixing GH 667
        dtype = np.int64

        values = self._base([0, 1, 2, 0, 0, 0, 1, 2, 1, 0], dtype=dtype)
        rvalues = self._base([2, 0, 2, 3, 0, 0, 1, 5, 2, 0], dtype=dtype)

        for kind in ['integer', 'block']:
            a = self._klass(values, dtype=dtype, kind=kind)
            assert a.dtype == dtype
            b = self._klass(rvalues, dtype=dtype, kind=kind)
            assert b.dtype == dtype

            self._check_numeric_ops(a, b, values, rvalues)
            self._check_numeric_ops(a, b * 0, values, rvalues * 0)

            a = self._klass(values, fill_value=0, dtype=dtype, kind=kind)
            assert a.dtype == dtype
            b = self._klass(rvalues, dtype=dtype, kind=kind)
            assert b.dtype == dtype

            self._check_numeric_ops(a, b, values, rvalues)

            a = self._klass(values, fill_value=0, dtype=dtype, kind=kind)
            assert a.dtype == dtype
            b = self._klass(rvalues, fill_value=0, dtype=dtype, kind=kind)
            assert b.dtype == dtype
            self._check_numeric_ops(a, b, values, rvalues)

            a = self._klass(values, fill_value=1, dtype=dtype, kind=kind)
            assert a.dtype == dtype
            b = self._klass(rvalues, fill_value=2, dtype=dtype, kind=kind)
            assert b.dtype == dtype
            self._check_numeric_ops(a, b, values, rvalues)

    def test_int_array_comparison(self):

        # int32 NI ATM
        for dtype in ['int64']:
            values = self._base([0, 1, 2, 0, 0, 0, 1, 2, 1, 0], dtype=dtype)
            rvalues = self._base([2, 0, 2, 3, 0, 0, 1, 5, 2, 0], dtype=dtype)

            for kind in ['integer', 'block']:
                a = self._klass(values, dtype=dtype, kind=kind)
                b = self._klass(rvalues, dtype=dtype, kind=kind)
                self._check_comparison_ops(a, b, values, rvalues)
                self._check_comparison_ops(a, b * 0, values, rvalues * 0)

                a = self._klass(values, dtype=dtype, kind=kind, fill_value=0)
                b = self._klass(rvalues, dtype=dtype, kind=kind)
                self._check_comparison_ops(a, b, values, rvalues)

                a = self._klass(values, dtype=dtype, kind=kind, fill_value=0)
                b = self._klass(rvalues, dtype=dtype, kind=kind, fill_value=0)
                self._check_comparison_ops(a, b, values, rvalues)

                a = self._klass(values, dtype=dtype, kind=kind, fill_value=1)
                b = self._klass(rvalues, dtype=dtype, kind=kind, fill_value=2)
                self._check_comparison_ops(a, b, values, rvalues)

    def test_bool_same_index(self):
        # GH 14000
        # when sp_index are the same
        for kind in ['integer', 'block']:
            values = self._base([True, False, True, True], dtype=np.bool)
            rvalues = self._base([True, False, True, True], dtype=np.bool)

            for fill_value in [True, False, np.nan]:
                a = self._klass(values, kind=kind, dtype=np.bool,
                                fill_value=fill_value)
                b = self._klass(rvalues, kind=kind, dtype=np.bool,
                                fill_value=fill_value)
                self._check_logical_ops(a, b, values, rvalues)

    def test_bool_array_logical(self):
        # GH 14000
        # when sp_index are the same
        for kind in ['integer', 'block']:
            values = self._base([True, False, True, False, True, True],
                                dtype=np.bool)
            rvalues = self._base([True, False, False, True, False, True],
                                 dtype=np.bool)

            for fill_value in [True, False, np.nan]:
                a = self._klass(values, kind=kind, dtype=np.bool,
                                fill_value=fill_value)
                b = self._klass(rvalues, kind=kind, dtype=np.bool,
                                fill_value=fill_value)
                self._check_logical_ops(a, b, values, rvalues)

    def test_mixed_array_float_int(self):

        for rdtype in ['int64']:
            values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
            rvalues = self._base([2, 0, 2, 3, 0, 0, 1, 5, 2, 0], dtype=rdtype)

            for kind in ['integer', 'block']:
                a = self._klass(values, kind=kind)
                b = self._klass(rvalues, kind=kind)
                assert b.dtype == rdtype

                self._check_numeric_ops(a, b, values, rvalues)
                self._check_numeric_ops(a, b * 0, values, rvalues * 0)

                a = self._klass(values, kind=kind, fill_value=0)
                b = self._klass(rvalues, kind=kind)
                assert b.dtype == rdtype
                self._check_numeric_ops(a, b, values, rvalues)

                a = self._klass(values, kind=kind, fill_value=0)
                b = self._klass(rvalues, kind=kind, fill_value=0)
                assert b.dtype == rdtype
                self._check_numeric_ops(a, b, values, rvalues)

                a = self._klass(values, kind=kind, fill_value=1)
                b = self._klass(rvalues, kind=kind, fill_value=2)
                assert b.dtype == rdtype
                self._check_numeric_ops(a, b, values, rvalues)

    def test_mixed_array_comparison(self):

        # int32 NI ATM
        for rdtype in ['int64']:
            values = self._base([np.nan, 1, 2, 0, np.nan, 0, 1, 2, 1, np.nan])
            rvalues = self._base([2, 0, 2, 3, 0, 0, 1, 5, 2, 0], dtype=rdtype)

            for kind in ['integer', 'block']:
                a = self._klass(values, kind=kind)
                b = self._klass(rvalues, kind=kind)
                assert b.dtype == rdtype

                self._check_comparison_ops(a, b, values, rvalues)
                self._check_comparison_ops(a, b * 0, values, rvalues * 0)

                a = self._klass(values, kind=kind, fill_value=0)
                b = self._klass(rvalues, kind=kind)
                assert b.dtype == rdtype
                self._check_comparison_ops(a, b, values, rvalues)

                a = self._klass(values, kind=kind, fill_value=0)
                b = self._klass(rvalues, kind=kind, fill_value=0)
                assert b.dtype == rdtype
                self._check_comparison_ops(a, b, values, rvalues)

                a = self._klass(values, kind=kind, fill_value=1)
                b = self._klass(rvalues, kind=kind, fill_value=2)
                assert b.dtype == rdtype
                self._check_comparison_ops(a, b, values, rvalues)


class TestSparseSeriesArithmetic(TestSparseArrayArithmetics):

    _base = pd.Series
    _klass = pd.SparseSeries

    def _assert(self, a, b):
        tm.assert_series_equal(a, b)

    def test_alignment(self):
        da = pd.Series(np.arange(4))
        db = pd.Series(np.arange(4), index=[1, 2, 3, 4])

        sa = pd.SparseSeries(np.arange(4), dtype=np.int64, fill_value=0)
        sb = pd.SparseSeries(np.arange(4), index=[1, 2, 3, 4],
                             dtype=np.int64, fill_value=0)
        self._check_numeric_ops(sa, sb, da, db)

        sa = pd.SparseSeries(np.arange(4), dtype=np.int64, fill_value=np.nan)
        sb = pd.SparseSeries(np.arange(4), index=[1, 2, 3, 4],
                             dtype=np.int64, fill_value=np.nan)
        self._check_numeric_ops(sa, sb, da, db)

        da = pd.Series(np.arange(4))
        db = pd.Series(np.arange(4), index=[10, 11, 12, 13])

        sa = pd.SparseSeries(np.arange(4), dtype=np.int64, fill_value=0)
        sb = pd.SparseSeries(np.arange(4), index=[10, 11, 12, 13],
                             dtype=np.int64, fill_value=0)
        self._check_numeric_ops(sa, sb, da, db)

        sa = pd.SparseSeries(np.arange(4), dtype=np.int64, fill_value=np.nan)
        sb = pd.SparseSeries(np.arange(4), index=[10, 11, 12, 13],
                             dtype=np.int64, fill_value=np.nan)
        self._check_numeric_ops(sa, sb, da, db)
