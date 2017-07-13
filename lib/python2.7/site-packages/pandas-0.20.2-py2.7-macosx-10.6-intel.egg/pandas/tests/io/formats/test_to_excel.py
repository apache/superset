"""Tests formatting as writer-agnostic ExcelCells

ExcelFormatter is tested implicitly in pandas/tests/io/test_excel.py
"""

import pytest

from pandas.io.formats.excel import CSSToExcelConverter


@pytest.mark.parametrize('css,expected', [
    # FONT
    # - name
    ('font-family: foo,bar', {'font': {'name': 'foo'}}),
    ('font-family: "foo bar",baz', {'font': {'name': 'foo bar'}}),
    ('font-family: foo,\nbar', {'font': {'name': 'foo'}}),
    ('font-family: foo, bar,    baz', {'font': {'name': 'foo'}}),
    ('font-family: bar, foo', {'font': {'name': 'bar'}}),
    ('font-family: \'foo bar\', baz', {'font': {'name': 'foo bar'}}),
    ('font-family: \'foo \\\'bar\', baz', {'font': {'name': 'foo \'bar'}}),
    ('font-family: "foo \\"bar", baz', {'font': {'name': 'foo "bar'}}),
    ('font-family: "foo ,bar", baz', {'font': {'name': 'foo ,bar'}}),
    # - family
    ('font-family: serif', {'font': {'name': 'serif', 'family': 1}}),
    ('font-family: Serif', {'font': {'name': 'serif', 'family': 1}}),
    ('font-family: roman, serif', {'font': {'name': 'roman', 'family': 1}}),
    ('font-family: roman, sans-serif', {'font': {'name': 'roman',
                                                 'family': 2}}),
    ('font-family: roman, sans serif', {'font': {'name': 'roman'}}),
    ('font-family: roman, sansserif', {'font': {'name': 'roman'}}),
    ('font-family: roman, cursive', {'font': {'name': 'roman', 'family': 4}}),
    ('font-family: roman, fantasy', {'font': {'name': 'roman', 'family': 5}}),
    # - size
    ('font-size: 1em', {'font': {'size': 12}}),
    # - bold
    ('font-weight: 100', {'font': {'bold': False}}),
    ('font-weight: 200', {'font': {'bold': False}}),
    ('font-weight: 300', {'font': {'bold': False}}),
    ('font-weight: 400', {'font': {'bold': False}}),
    ('font-weight: normal', {'font': {'bold': False}}),
    ('font-weight: lighter', {'font': {'bold': False}}),
    ('font-weight: bold', {'font': {'bold': True}}),
    ('font-weight: bolder', {'font': {'bold': True}}),
    ('font-weight: 700', {'font': {'bold': True}}),
    ('font-weight: 800', {'font': {'bold': True}}),
    ('font-weight: 900', {'font': {'bold': True}}),
    # - italic
    # - underline
    ('text-decoration: underline',
     {'font': {'underline': 'single'}}),
    ('text-decoration: overline',
     {}),
    ('text-decoration: none',
     {}),
    # - strike
    ('text-decoration: line-through',
     {'font': {'strike': True}}),
    ('text-decoration: underline line-through',
     {'font': {'strike': True, 'underline': 'single'}}),
    ('text-decoration: underline; text-decoration: line-through',
     {'font': {'strike': True}}),
    # - color
    ('color: red', {'font': {'color': 'FF0000'}}),
    ('color: #ff0000', {'font': {'color': 'FF0000'}}),
    ('color: #f0a', {'font': {'color': 'FF00AA'}}),
    # - shadow
    ('text-shadow: none', {'font': {'shadow': False}}),
    ('text-shadow: 0px -0em 0px #CCC', {'font': {'shadow': False}}),
    ('text-shadow: 0px -0em 0px #999', {'font': {'shadow': False}}),
    ('text-shadow: 0px -0em 0px', {'font': {'shadow': False}}),
    ('text-shadow: 2px -0em 0px #CCC', {'font': {'shadow': True}}),
    ('text-shadow: 0px -2em 0px #CCC', {'font': {'shadow': True}}),
    ('text-shadow: 0px -0em 2px #CCC', {'font': {'shadow': True}}),
    ('text-shadow: 0px -0em 2px', {'font': {'shadow': True}}),
    ('text-shadow: 0px -2em', {'font': {'shadow': True}}),

    # FILL
    # - color, fillType
    ('background-color: red', {'fill': {'fgColor': 'FF0000',
                                        'patternType': 'solid'}}),
    ('background-color: #ff0000', {'fill': {'fgColor': 'FF0000',
                                            'patternType': 'solid'}}),
    ('background-color: #f0a', {'fill': {'fgColor': 'FF00AA',
                                         'patternType': 'solid'}}),
    # BORDER
    # - style
    ('border-style: solid',
     {'border': {'top': {'style': 'medium'},
                 'bottom': {'style': 'medium'},
                 'left': {'style': 'medium'},
                 'right': {'style': 'medium'}}}),
    ('border-style: solid; border-width: thin',
     {'border': {'top': {'style': 'thin'},
                 'bottom': {'style': 'thin'},
                 'left': {'style': 'thin'},
                 'right': {'style': 'thin'}}}),

    ('border-top-style: solid; border-top-width: thin',
     {'border': {'top': {'style': 'thin'}}}),
    ('border-top-style: solid; border-top-width: 1pt',
     {'border': {'top': {'style': 'thin'}}}),
    ('border-top-style: solid',
     {'border': {'top': {'style': 'medium'}}}),
    ('border-top-style: solid; border-top-width: medium',
     {'border': {'top': {'style': 'medium'}}}),
    ('border-top-style: solid; border-top-width: 2pt',
     {'border': {'top': {'style': 'medium'}}}),
    ('border-top-style: solid; border-top-width: thick',
     {'border': {'top': {'style': 'thick'}}}),
    ('border-top-style: solid; border-top-width: 4pt',
     {'border': {'top': {'style': 'thick'}}}),

    ('border-top-style: dotted',
     {'border': {'top': {'style': 'mediumDashDotDot'}}}),
    ('border-top-style: dotted; border-top-width: thin',
     {'border': {'top': {'style': 'dotted'}}}),
    ('border-top-style: dashed',
     {'border': {'top': {'style': 'mediumDashed'}}}),
    ('border-top-style: dashed; border-top-width: thin',
     {'border': {'top': {'style': 'dashed'}}}),
    ('border-top-style: double',
     {'border': {'top': {'style': 'double'}}}),
    # - color
    ('border-style: solid; border-color: #0000ff',
     {'border': {'top': {'style': 'medium', 'color': '0000FF'},
                 'right': {'style': 'medium', 'color': '0000FF'},
                 'bottom': {'style': 'medium', 'color': '0000FF'},
                 'left': {'style': 'medium', 'color': '0000FF'}}}),
    ('border-top-style: double; border-top-color: blue',
     {'border': {'top': {'style': 'double', 'color': '0000FF'}}}),
    ('border-top-style: solid; border-top-color: #06c',
     {'border': {'top': {'style': 'medium', 'color': '0066CC'}}}),
    # ALIGNMENT
    # - horizontal
    ('text-align: center',
     {'alignment': {'horizontal': 'center'}}),
    ('text-align: left',
     {'alignment': {'horizontal': 'left'}}),
    ('text-align: right',
     {'alignment': {'horizontal': 'right'}}),
    ('text-align: justify',
     {'alignment': {'horizontal': 'justify'}}),
    # - vertical
    ('vertical-align: top',
     {'alignment': {'vertical': 'top'}}),
    ('vertical-align: text-top',
     {'alignment': {'vertical': 'top'}}),
    ('vertical-align: middle',
     {'alignment': {'vertical': 'center'}}),
    ('vertical-align: bottom',
     {'alignment': {'vertical': 'bottom'}}),
    ('vertical-align: text-bottom',
     {'alignment': {'vertical': 'bottom'}}),
    # - wrap_text
    ('white-space: nowrap',
     {'alignment': {'wrap_text': False}}),
    ('white-space: pre',
     {'alignment': {'wrap_text': False}}),
    ('white-space: pre-line',
     {'alignment': {'wrap_text': False}}),
    ('white-space: normal',
     {'alignment': {'wrap_text': True}}),
])
def test_css_to_excel(css, expected):
    convert = CSSToExcelConverter()
    assert expected == convert(css)


def test_css_to_excel_multiple():
    convert = CSSToExcelConverter()
    actual = convert('''
        font-weight: bold;
        text-decoration: underline;
        color: red;
        border-width: thin;
        text-align: center;
        vertical-align: top;
        unused: something;
    ''')
    assert {"font": {"bold": True, "underline": "single", "color": "FF0000"},
            "border": {"top": {"style": "thin"},
                       "right": {"style": "thin"},
                       "bottom": {"style": "thin"},
                       "left": {"style": "thin"}},
            "alignment": {"horizontal": "center",
                          "vertical": "top"}} == actual


@pytest.mark.parametrize('css,inherited,expected', [
    ('font-weight: bold', '',
     {'font': {'bold': True}}),
    ('', 'font-weight: bold',
     {'font': {'bold': True}}),
    ('font-weight: bold', 'font-style: italic',
     {'font': {'bold': True, 'italic': True}}),
    ('font-style: normal', 'font-style: italic',
     {'font': {'italic': False}}),
    ('font-style: inherit', '', {}),
    ('font-style: normal; font-style: inherit', 'font-style: italic',
     {'font': {'italic': True}}),
])
def test_css_to_excel_inherited(css, inherited, expected):
    convert = CSSToExcelConverter(inherited)
    assert expected == convert(css)
