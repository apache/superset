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

"Google Sheets Export features"

import datetime
from numbers import Real
import os
from typing import Union

import pandas as pd
from flask import current_app

from superset import feature_flag_manager

LIB_GSPREAD_AVAILABLE = False
try:
    import gspread

    LIB_GSPREAD_AVAILABLE = True
except ModuleNotFoundError:
    pass

if feature_flag_manager.is_feature_enabled("GOOGLE_SHEETS_EXPORT"):
    assert LIB_GSPREAD_AVAILABLE, 'GOOGLE_SHEETS_EXPORT: Missing package.'
    assert isinstance(
        current_app.config["GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH"],
        str,
    ), 'GOOGLE_SHEETS_EXPORT: Required valid service-account json path.'
    assert os.path.exists(
        current_app.config["GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH"]
    ), 'GOOGLE_SHEETS_EXPORT: Required valid service-account json path.'
    assert isinstance(
        current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"],
        dict,
    ), 'GOOGLE_SHEETS_EXPORT: Required share permissions.'
    if current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"].get('perm_type') == 'anyone':
        assert 'email_address' in \
            current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"] and \
            current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"]['email_address']\
            == None, \
            'GOOGLE_SHEETS_EXPORT: For perm_type == "anyone", email_address must be set \
            to None'
    else:
        assert {"email_address", "perm_type", "role"} <= current_app.config[
            "GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"
        ].keys()


def _format_cell(x) -> Union[str, Real]:
    "Ensure a pandas value is JSONSerializable and the type is helpful for GSheets."
    if pd.isnull(x):
        return ""
    if isinstance(x, Real):
        return x
    return str(x)


def upload_df_to_new_sheet(name: str, df: pd.DataFrame) -> str:
    assert feature_flag_manager.is_feature_enabled("GOOGLE_SHEETS_EXPORT")

    formatted_df = df.applymap(_format_cell)

    gc = gspread.service_account(
        filename=current_app.config["GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH"],
    )
    spreadsheet = gc.create(f"{name} {datetime.datetime.utcnow().isoformat()}")
    spreadsheet.sheet1.update(
        range_name="A1",
        values=([formatted_df.columns.values.tolist()] + formatted_df.values.tolist()),
    )
    spreadsheet.share(**current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"])
    return spreadsheet.id
