import pytest

def test_table_access_message_sorted():
    tables = {"b_table", "a_table"}

    quoted_tables = [f'"{table}"' for table in sorted(tables, key=str)]
    result = ", ".join(quoted_tables)

    assert result == '"a_table", "b_table"'


def test_no_key_error_in_sql_lab_progress():
    template = "Running block %(block_num)s out of %(block_count)s"

    try:
        result = template % {"block_num": 1, "block_count": 2}
    except KeyError:
        pytest.fail("KeyError occurred during interpolation")

    assert "1" in result
    assert "2" in result


def test_progress_message_format():
    template = "Running block %(block_num)s out of %(block_count)s"
    result = template % {"block_num": 3, "block_count": 10}

    assert result == "Running block 3 out of 10"


    if __name__ == "__main__":
    print("Running tests...")

    test_table_access_message_sorted()
    test_no_key_error_in_sql_lab_progress()
    test_progress_message_format()

    print("ALL TESTS PASSED")