import pytest
from pandas.core.series import Series


class TestSeriesValidate(object):
    """Tests for error handling related to data types of method arguments."""
    s = Series([1, 2, 3, 4, 5])

    def test_validate_bool_args(self):
        # Tests for error handling related to boolean arguments.
        invalid_values = [1, "True", [1, 2, 3], 5.0]

        for value in invalid_values:
            with pytest.raises(ValueError):
                self.s.reset_index(inplace=value)

            with pytest.raises(ValueError):
                self.s._set_name(name='hello', inplace=value)

            with pytest.raises(ValueError):
                self.s.sort_values(inplace=value)

            with pytest.raises(ValueError):
                self.s.sort_index(inplace=value)

            with pytest.raises(ValueError):
                self.s.sort_index(inplace=value)

            with pytest.raises(ValueError):
                self.s.rename(inplace=value)

            with pytest.raises(ValueError):
                self.s.dropna(inplace=value)
