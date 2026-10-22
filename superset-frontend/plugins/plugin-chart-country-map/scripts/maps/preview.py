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
"""Renders per-country thumbnails and a contact sheet, replacing the
notebook's inline `not speed_run and x.plot(...)` previews with files a
human (or a docs page) can look at without running Python at all.
"""

from __future__ import annotations

import math
import os

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402  (backend must be set first)

from .context import PLOT_STYLES


def render_preview(
    gdf: gpd.GeoDataFrame, name: str, out_dir: str, size: tuple[float, float] = (4, 4)
) -> str:
    # No title baked in: the contact sheet (and any docs-site caption) adds
    # its own label next to the image, so the thumbnail stays reusable on
    # its own.
    os.makedirs(out_dir, exist_ok=True)
    fig, ax = plt.subplots(figsize=size)
    gdf.plot(ax=ax, **PLOT_STYLES)
    ax.set_axis_off()
    path = os.path.join(out_dir, f"{name.replace(' ', '_')}.png")
    fig.savefig(path, dpi=100, bbox_inches="tight")
    plt.close(fig)
    return path


def build_contact_sheet(
    manifest: list[dict[str, str]], out_dir: str, columns: int = 4
) -> str:
    """Assembles every entry's thumbnail into one grid image, so a reviewer
    (or the docs site) can see every converted country at a glance.
    """
    entries = [e for e in manifest if "thumbnail" in e]
    if not entries:
        raise ValueError("No thumbnails to assemble into a contact sheet")

    rows = math.ceil(len(entries) / columns)
    fig, axes = plt.subplots(rows, columns, figsize=(columns * 3, rows * 3))
    axes = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for ax, entry in zip(axes, entries, strict=False):
        img = plt.imread(os.path.join(out_dir, entry["thumbnail"]))
        ax.imshow(img)
        ax.set_title(entry["name"], fontsize=10)
        ax.set_axis_off()
    for ax in axes[len(entries) :]:
        ax.set_axis_off()

    path = os.path.join(out_dir, "contact_sheet.png")
    fig.tight_layout()
    fig.savefig(path, dpi=100)
    plt.close(fig)
    return path
