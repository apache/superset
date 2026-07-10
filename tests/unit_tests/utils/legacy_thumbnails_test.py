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
from io import BytesIO

from PIL import Image

from superset.utils.legacy_thumbnails import generate_thumbnail

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _sample_png(size: tuple[int, int] = (800, 600)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


def test_generate_thumbnail_returns_png() -> None:
    out = generate_thumbnail(_sample_png(), (400, 300))
    assert out[:8] == PNG_MAGIC


def test_generate_thumbnail_respects_max_size() -> None:
    out = generate_thumbnail(_sample_png((800, 600)), (400, 300))
    thumb = Image.open(BytesIO(out))
    assert thumb.width <= 400
    assert thumb.height <= 300
