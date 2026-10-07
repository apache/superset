# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils import pandas_postprocessing as pp
from tests.unit_tests.fixtures.dataframes import categories_df


def test_rename_should_not_side_effect():
    _categories_df = categories_df.copy()
    pp.rename(
        df=_categories_df,
        columns={
            "constant": "constant_newname",
            "category": "category_namename",
        },
    )
    assert _categories_df.equals(categories_df)


def test_rename():
    new_categories_df = pp.rename(
        df=categories_df,
        columns={
            "constant": "constant_newname",
            "category": "category_newname",
        },
    )
    assert list(new_categories_df.columns.values) == [
        "constant_newname",
        "category_newname",
        "dept",
        "name",
        "asc_idx",
        "desc_idx",
        "idx_nulls",
    ]
    assert not new_categories_df.equals(categories_df)


def test_should_inplace_rename():
    _categories_df = categories_df.copy()
    _categories_df_inplaced = pp.rename(
        df=_categories_df,
        columns={
            "constant": "constant_newname",
            "category": "category_namename",
        },
        inplace=True,
    )
    assert _categories_df_inplaced.equals(_categories_df)


def test_should_rename_on_level():
    iterables = [["m1", "m2"], ["a", "b"], ["x", "y"]]
    columns = pd.MultiIndex.from_product(iterables, names=[None, "level1", "level2"])
    df = pd.DataFrame(index=[0, 1, 2], columns=columns, data=1)
    """
                   m1          m2
    level1  a     b     a     b
    level2  x  y  x  y  x  y  x  y
    0       1  1  1  1  1  1  1  1
    1       1  1  1  1  1  1  1  1
    2       1  1  1  1  1  1  1  1
    """
    post_df = pp.rename(
        df=df,
        columns={"m1": "new_m1"},
        level=0,
    )
    assert post_df.columns.get_level_values(level=0).equals(
        pd.Index(
            [
                "new_m1",
                "new_m1",
                "new_m1",
                "new_m1",
                "m2",
                "m2",
                "m2",
                "m2",
            ]
        )
    )


def test_should_raise_exception_no_column():
    with pytest.raises(InvalidPostProcessingError):
        pp.rename(
            df=categories_df,
            columns={
                "foobar": "foobar2",
            },
        )


def test_should_raise_exception_duplication():
    with pytest.raises(InvalidPostProcessingError):
        pp.rename(
            df=categories_df,
            columns={
                "constant": "category",
            },
        )


def test_should_raise_exception_duplication_on_multiindex():
    iterables = [["m1", "m2"], ["a", "b"], ["x", "y"]]
    columns = pd.MultiIndex.from_product(iterables, names=[None, "level1", "level2"])
    df = pd.DataFrame(index=[0, 1, 2], columns=columns, data=1)
    """
                   m1          m2
    level1  a     b     a     b
    level2  x  y  x  y  x  y  x  y
    0       1  1  1  1  1  1  1  1
    1       1  1  1  1  1  1  1  1
    2       1  1  1  1  1  1  1  1
    """

    with pytest.raises(InvalidPostProcessingError):  # noqa: PT012
        pp.rename(
            df=df,
            columns={
                "m1": "m2",
            },
            level=0,
        )
        pp.rename(
            df=df,
            columns={
                "a": "b",
            },
            level=1,
        )


def test_should_raise_exception_partial_duplication():
    """
    A mapping where only some of the new names collide is still a collision.

    `test_should_raise_exception_duplication` drives the guard with a one-entry
    mapping, where "every new name already exists" and "the result holds a
    duplicate" are the same condition. With two entries they are not, and the
    renamed `category` was appended next to the existing one.
    """
    with pytest.raises(InvalidPostProcessingError):
        pp.rename(
            df=categories_df,
            columns={
                "constant": "category",
                "dept": "department",
            },
        )


def test_should_raise_exception_partial_duplication_on_multiindex():
    iterables = [["m1", "m2", "m3"], ["a", "b"]]
    columns = pd.MultiIndex.from_product(iterables, names=[None, "level1"])
    df = pd.DataFrame(index=[0, 1], columns=columns, data=1)

    with pytest.raises(InvalidPostProcessingError):
        pp.rename(
            df=df,
            columns={
                "m1": "m2",
                "m3": "m4",
            },
            level=0,
        )


def test_should_raise_exception_two_sources_one_new_label():
    """
    Two columns renamed to the same new label collide with each other.

    Neither new name is present beforehand, so a guard that only looks for
    existing labels lets this through and pandas ends up with two `cat_or_dept`
    columns.
    """
    with pytest.raises(InvalidPostProcessingError):
        pp.rename(
            df=categories_df,
            columns={
                "category": "cat_or_dept",
                "dept": "cat_or_dept",
            },
        )


def test_should_rename_onto_a_label_the_same_mapping_vacates():
    """
    A target that the mapping itself frees up is not a collision.

    `category` is taken when the mapping is read, but the same mapping moves it
    to `grouping`, so the result holds no duplicate and the rename is valid.
    """
    renamed_df = pp.rename(
        df=categories_df,
        columns={
            "category": "grouping",
            "constant": "category",
        },
    )

    assert list(renamed_df.columns) == [
        "category",
        "grouping",
        "dept",
        "name",
        "asc_idx",
        "desc_idx",
        "idx_nulls",
    ]


def test_should_rename_a_frame_that_already_holds_duplicate_labels():
    """
    A frame that arrives with duplicate labels can still be renamed.

    Earlier operations can hand `rename` a frame whose columns already repeat,
    so the guard asks whether the rename adds a duplicate rather than whether
    the result holds one. Renaming an unrelated column is left alone, and a
    rename that would repeat the label again still raises.
    """
    df = pd.DataFrame([[1, 2, 3]], columns=["b", "b", "z"])

    assert list(pp.rename(df=df, columns={"z": "w"}).columns) == ["b", "b", "w"]

    with pytest.raises(InvalidPostProcessingError):
        pp.rename(df=df, columns={"z": "b"})


def test_should_raise_exception_invalid_level():
    with pytest.raises(InvalidPostProcessingError):  # noqa: PT012
        pp.rename(
            df=categories_df,
            columns={
                "constant": "new_constant",
            },
            level=100,
        )
        pp.rename(
            df=categories_df,
            columns={
                "constant": "new_constant",
            },
            level="xxxxx",
        )


def test_should_return_df_empty_columns():
    assert pp.rename(
        df=categories_df,
        columns={},
    ).equals(categories_df)
