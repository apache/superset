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

from datetime import datetime, timedelta
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from superset.utils.core import create_zip, write_zip_entry

DOS_EPOCH = (1980, 1, 1, 0, 0, 0)


def test_create_zip_stamps_entries_with_the_current_time() -> None:
    """
    Entries must carry a real modification date.

    Without an explicit ZipInfo, zipfile falls back to the 1980-01-01 DOS epoch,
    which extractors show as a bogus or empty modification date on every
    extracted file (#44388).
    """
    # DOS timestamps have a two-second resolution, so an entry can be stamped
    # slightly before the moment the archive was built.
    before = datetime.now() - timedelta(seconds=2)
    archive = create_zip({"query_1.csv": b"value\n1\n", "query_2.csv": b"value\n2\n"})
    after = datetime.now()

    with ZipFile(archive) as bundle:
        infos = bundle.infolist()

    assert [info.filename for info in infos] == ["query_1.csv", "query_2.csv"]
    for info in infos:
        assert info.date_time != DOS_EPOCH
        assert before <= datetime(*info.date_time) <= after


def test_write_zip_entry_writes_nested_paths_intact() -> None:
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        write_zip_entry(bundle, "root/metadata.yaml", b"version: 1.0.0")

    with ZipFile(buf) as bundle:
        info = bundle.getinfo("root/metadata.yaml")
        assert bundle.read("root/metadata.yaml") == b"version: 1.0.0"

    assert info.date_time != DOS_EPOCH


def test_write_zip_entry_honors_the_bundle_compression_settings() -> None:
    """
    A pre-built ZipInfo bypasses the settings zipfile copies onto entries it
    creates itself, so the helper has to forward both of them.
    """
    payload = b"superset " * 2000

    def build(compresslevel: int) -> bytes:
        buf = BytesIO()
        with ZipFile(
            buf, "w", compression=ZIP_DEFLATED, compresslevel=compresslevel
        ) as bundle:
            write_zip_entry(bundle, "data.csv", payload)
        return buf.getvalue()

    fastest, smallest = build(1), build(9)

    with ZipFile(BytesIO(smallest)) as bundle:
        info = bundle.getinfo("data.csv")
        assert info.compress_type == ZIP_DEFLATED
        assert bundle.read("data.csv") == payload

    assert len(smallest) < len(fastest)
