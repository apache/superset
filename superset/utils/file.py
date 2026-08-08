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

# All C0 (U+0000–U+001F) and C1 (U+007F–U+009F) control characters.
# Stripping every control char (including tab, LF, CR) keeps titles safe for
# SMTP headers, Content-Disposition filenames, and headless-browser document.title.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f-\x9f]")

# Model names can be up to 500 characters, which produces export entries that exceed
# both the 255 character filename limit common to most filesystems and, once the
# archive prefix ("chart_export_<timestamp>/charts/") and the extraction directory are
# added, the 260 character path limit (MAX_PATH) Windows applies when unzipping.
# The extraction directory is unbounded, so no cap can guarantee MAX_PATH is met; 128
# keeps every component well within the filesystem limit and leaves typical export
# paths comfortably short while retaining enough of the name to stay recognizable.
MAX_FILENAME_LENGTH = 128

# Characters that are meaningless or invalid at the end of a filename. A trailing dot
# in particular is silently dropped by Windows.
_TRAILING_CHARS = "._-"


def sanitize_title(title: str) -> str:
    """Remove all C0/C1 control characters from a title string."""
    return _CONTROL_CHARS_RE.sub("", title)


def get_filename(
    model_name: str,
    model_id: int,
    skip_id: bool = False,
    max_length: int = MAX_FILENAME_LENGTH,
) -> str:
    """
    Build a filesystem-safe filename for a model, truncated to ``max_length``.

    :param model_name: the human readable name of the model
    :param model_id: the model's primary key, appended unless ``skip_id`` is set
    :param skip_id: whether to omit the id suffix
    :param max_length: maximum length of the returned name, suffix included
    :returns: the sanitized name, or the id alone when nothing usable remains
    """
    model_name = sanitize_title(model_name)
    # `secure_filename` transliterates to ASCII, so length in characters equals
    # length in bytes and the string can be truncated safely by slicing.
    slug = secure_filename(model_name)
    id_suffix = "" if skip_id else f"_{model_id}"

    max_slug_length = max(max_length - len(id_suffix), 0)
    if len(slug) > max_slug_length:
        slug = slug[:max_slug_length].rstrip(_TRAILING_CHARS)

    return f"{slug}{id_suffix}" if slug else str(model_id)
