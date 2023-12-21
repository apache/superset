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
import os

import pandas as pd 
from flask import current_app
from superset import feature_flag_manager
 
LIB_GSPREAD_AVAILABLE = False
try:
    import gspread
    LIB_GSPREAD_AVAILABLE = True
except ModuleNotFoundError:
    pass
 
# GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH="jessies-sandbox-408009-fd8ec620014b.json" 
 
# GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS={ 
#     'email_address': "a8c.com", 
#     'perm_type': "domain", 
#     'role': "writer", 
# } 

if feature_flag_manager.is_feature_enabled("GOOGLE_SHEETS_EXPORT"):
    assert LIB_GSPREAD_AVAILABLE
    assert isinstance(current_app.config['GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH'], str)
    assert os.path.exists(current_app.config['GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH'])
    assert isinstance(current_app.config['GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS'], dict)
    assert {'email_address', 'perm_type', 'role'} <= current_app.config['GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS'].keys()
 
 
def upload_df_to_new_sheet(name: str, df: pd.DataFrame) -> gspread.Spreadsheet: 
    gc = gspread.service_account( 
         filename=current_app.config['GOOGLE_SHEETS_EXPORT_SERVICE_ACCOUNT_JSON_PATH'], 
         ) 
    s = gc.create(f'{name} {datetime.datetime.utcnow().isoformat()}') 
    s.sheet1.update( 
            range_name='A1', 
            values=([df.columns.values.tolist()] + df.values.tolist()), 
            ) 
    s.share(**current_app.config['GOOGLE_SHEETS_EXPORT_SHARE_PERMISSIONS']) 
    return s 
