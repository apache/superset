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
import logging
import os

import pandas as pd
from flask import current_app

from superset import feature_flag_manager

LIB_GSPREAD_AVAILABLE = False
try:
    import gspread
    from gspread_dataframe import set_with_dataframe

    LIB_GSPREAD_AVAILABLE = True
except ModuleNotFoundError:
    pass

class GoogleSheetsExport:
    client: gspread.Client
    share_permissions: dict[str, str]

    def __init__(self):
        assert feature_flag_manager.is_feature_enabled("GOOGLE_SHEETS_EXPORT")
        assert LIB_GSPREAD_AVAILABLE, 'GOOGLE_SHEETS_EXPORT: Missing package.'
        assert isinstance(
            current_app.config["GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON"],
            dict,
        ), 'GOOGLE_SHEETS_EXPORT: Required valid service-account json.'
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
        self.client = gspread.service_account_from_dict(
            current_app.config["GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON"],
            http_client=gspread.BackOffHTTPClient
        )
        self.share_permissions = current_app.config["GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS"]

    def upload_df_to_new_sheet(self, name: str, df: pd.DataFrame) -> str:
        spreadsheet = self.client.create(f"{name} {datetime.datetime.utcnow().isoformat()}")
        spreadsheet.sheet1.update(
            range_name="A1",
            values=([df.columns.values.tolist()] + df.values.tolist()),
        )
        spreadsheet.share(**self.share_permissions)
        return spreadsheet.id
    
    def upload_dfs_to_new_sheet(self, name: str, dfs: list[tuple[str, pd.DataFrame]]) -> str:
        spreadsheet = self.client.create(f"{name} {datetime.datetime.utcnow().isoformat()}")
        for sheet_name, df in dfs:
            logging.info(f"Uploading {sheet_name} to {spreadsheet.id} with shape {df.shape}.")
            worksheet = spreadsheet.add_worksheet(sheet_name, df.shape[0], df.shape[1])
            set_with_dataframe(worksheet, df, include_index=True)
        spreadsheet.share(**self.share_permissions)
        spreadsheet.del_worksheet(spreadsheet.sheet1) # delete the default sheet
        return spreadsheet.id