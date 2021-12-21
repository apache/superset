# -*- coding: utf-8 -*-
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
from dataclasses import dataclass
from typing import Any, List, Optional, Type

import pandas as pd

from superset.models.reports import ReportRecipients, ReportRecipientType


@dataclass
class NotificationContent:
    name: str
    csv: Optional[bytes] = None  # bytes for csv file
    screenshot: Optional[bytes] = None  # bytes for the screenshot
    text: Optional[str] = None
    description: Optional[str] = ""
    url: Optional[str] = None  # url to chart/dashboard for this screenshot
    embedded_data: Optional[pd.DataFrame] = None


class BaseNotification:  # pylint: disable=too-few-public-methods
    """
    Serves has base for all notifications and creates a simple plugin system
    for extending future implementations.
    Child implementations get automatically registered and should identify the
    notification type
    """

    plugins: List[Type["BaseNotification"]] = []
    type: Optional[ReportRecipientType] = None
    """
    Child classes set their notification type ex: `type = "email"` this string will be
    used by ReportRecipients.type to map to the correct implementation
    """

    def __init_subclass__(cls, *args: Any, **kwargs: Any) -> None:
        super().__init_subclass__(*args, **kwargs)  # type: ignore
        cls.plugins.append(cls)

    def __init__(
        self, recipient: ReportRecipients, content: NotificationContent
    ) -> None:
        self._recipient = recipient
        self._content = content

    def send(self) -> None:
        raise NotImplementedError()
