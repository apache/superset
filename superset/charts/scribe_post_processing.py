from urllib.parse import parse_qsl
from bs4 import BeautifulSoup
from io import StringIO
import pandas as pd


def convert_html_col(html):
    val = html
    if (
        type(html) == str
        and html.startswith("<")
        and html.endswith(">")
        and (soup := BeautifulSoup(html, "html.parser"))
    ):
        val = soup.text
        if val == "More" and soup.a and (href := soup.a.get("href")):
            val = dict(parse_qsl(href))
            for k in ["None#modal", "sidebar_title"]:
                val.pop(k, None)
    return val


def process_col(col):
    col = col.apply(convert_html_col)
    return col


def apply_scribe_post_process(data):
    df = pd.read_csv(StringIO(data))
    df = df.apply(process_col, axis=1)
    if "More" in df:
        df = pd.concat([df.drop("More", axis=1), pd.json_normalize(df["More"])], axis=1)
    buf = StringIO()
    df.to_csv(buf)
    buf.seek(0)
    return buf.getvalue()
