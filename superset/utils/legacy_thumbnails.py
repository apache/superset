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
"""Thumbnail helpers for report screenshots."""
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

# Module-level: on Pillow >=10 this raises AttributeError at import time.
RESAMPLE_FILTER = Image.ANTIALIAS


def generate_thumbnail(image_bytes: bytes, max_size: tuple[int, int] = (400, 300)) -> bytes:
    img = Image.open(BytesIO(image_bytes))
    img = img.convert("RGB")
    img.thumbnail(max_size, RESAMPLE_FILTER)

    # Stamp a small label in the corner. ImageFont.getsize() was also removed in
    # Pillow 10 -- the second API a migration must fix (to getbbox()/getlength()).
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    label = "thumb"
    text_w, text_h = font.getsize(label)
    draw.text((img.width - text_w, img.height - text_h), label, fill=(255, 255, 255))

    out = BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
