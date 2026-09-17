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

import logging
from io import BytesIO

# NGLS - BEGIN #
from typing import Any
import pandas as pd
import pdfkit
from typing import Any, Dict

css = """
<style>
    table {
        border-spacing: 0px;
        font-size: small;
    }
    th, td {
        padding: 2px 6px;
    }
</style>
"""
# NGLS - END #

logger = logging.getLogger(__name__)
try:
    from PIL import Image
except ModuleNotFoundError:
    logger.info("No PIL installation found")


def build_pdf_from_screenshots(snapshots: list[bytes]) -> bytes:
    # NGLS - BEGIN #
    # deferred import to avoid a circular import chain via reports/models -> models/dashboard -> connectors/sqla/models
    from superset.commands.report.exceptions import ReportSchedulePdfFailedError
    # NGLS - END #
    images = []

    for snap in snapshots:
        img = Image.open(BytesIO(snap))
        if img.mode == "RGBA":
            img = img.convert("RGB")
        images.append(img)
    logger.info("building pdf")
    try:
        new_pdf = BytesIO()
        images[0].save(new_pdf, "PDF", save_all=True, append_images=images[1:])
        new_pdf.seek(0)
    except Exception as ex:
        raise ReportSchedulePdfFailedError(
            f"Failed converting screenshots to pdf {str(ex)}"
        ) from ex

    return new_pdf.read()

# NGLS - BEGIN #
def df_to_pdf(df: pd.DataFrame, options: Dict = None, title: str = None) -> Any:
    title_header = f"<h2>{title}</h2>" if title else ""
    # convert the pandas dataframe to html
    html = df.to_html(index=False, justify="left", escape=False)
    # convert html to pdf
    output = pdfkit.from_string(css + title_header + html, False, options=options or {})
    return output
# NGLS - END #