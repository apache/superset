from superset.utils.core import split


# ======================================
# CAIXA PRETA (BLACK BOX)
# ======================================

def test_split_empty_string():
    assert list(split("")) == [""]


def test_split_leading_delimiter():
    assert list(split(" a")) == [
        "",
        "a",
    ]


def test_split_trailing_delimiter():
    assert list(split("a ")) == [
        "a",
        "",
    ]


def test_split_only_delimiter():
    assert list(split(" ")) == [
        "",
        "",
    ]


def test_split_nested_parentheses():
    assert list(
        split(
            "a,(b,(c,d))",
            delimiter=",",
        )
    ) == [
        "a",
        "(b,(c,d))",
    ]


# ======================================
# CAIXA BRANCA (WHITE BOX)
# ======================================

def test_branch_separator_found():
    assert list(split("a b")) == [
        "a",
        "b",
    ]


def test_branch_separator_not_found():
    assert list(split("ab")) == [
        "ab",
    ]


def test_branch_parentheses():
    assert list(split("(a b)")) == [
        "(a b)",
    ]


def test_branch_escaped_quote():
    assert list(split(r'"a\"b c" d')) == [
        r'"a\"b c"',
        "d",
    ]