from urllib.parse import parse_qsl
from bs4 import BeautifulSoup
from io import StringIO, BytesIO
import pandas as pd
import msgpack
import base64


def decode_href(data):
    decoded = base64.urlsafe_b64decode(data)
    return msgpack.unpackb(decoded, raw=False)


def convert_html_col(html):
    val = html
    if (
        type(html) == str
        and html.startswith("<")
        and html.endswith(">")
        and (soup := BeautifulSoup(html, "html.parser"))
    ):
        val = soup.text
        if soup.a and (href := soup.a.get("href")):
            params = dict(parse_qsl(href.split("#", 1)[-1]))
            if "data" in params:
                val = decode_href(params["data"])
    return val


def process_col(col):
    col = col.apply(convert_html_col)
    return col


def apply_scribe_post_process(data, is_csv_format):
    if is_csv_format:
        df = pd.read_csv(StringIO(data))
    else:
        df = pd.read_excel(BytesIO(data))
    df = df.apply(process_col, axis=1)
    if "More" in df:
        df = pd.concat([df.drop("More", axis=1), pd.json_normalize(df["More"])], axis=1)
    if is_csv_format:
        buf = StringIO()
        df.to_csv(buf)
    else:
        buf = BytesIO()
        df.to_excel(buf)
    buf.seek(0)
    return buf.getvalue()
