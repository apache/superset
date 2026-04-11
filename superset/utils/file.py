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
import re

from werkzeug.utils import secure_filename

# C0/C1 controls except tab (\x09), LF (\x0a), CR (\x0d) — safe for filenames and
# downstream consumers that mishandle these bytes.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def sanitize_title(title: str) -> str:
    return _CONTROL_CHARS_RE.sub("", title)


def get_filename(model_name: str, model_id: int, skip_id: bool = False) -> str:
    model_name = sanitize_title(model_name)
    slug = secure_filename(model_name)
    filename = slug if skip_id else f"{slug}_{model_id}"
    return filename if slug else str(model_id)
