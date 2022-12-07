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

from enum import Enum


class ExecutorType(str, Enum):
    """
    Which user should scheduled tasks be executed as. Used as follows:
    For Alerts & Reports: the "model" refers to the AlertSchedule object
    For Thumbnails: The "model" refers to the Slice or Dashboard object
    """

    # See the THUMBNAIL_SELENIUM_USER config parameter
    SELENIUM = "selenium"
    # The creator of the model
    CREATOR = "creator"
    # The creator of the model, if found in the owners list
    CREATOR_OWNER = "creator_owner"
    # The currently logged in user. In the case of Alerts & Reports, this is always
    # None. For Thumbnails, this is the user that requested the thumbnail
    CURRENT_USER = "current_user"
    # The last modifier of the model
    MODIFIER = "modifier"
    # The last modifier of the model, if found in the owners list
    MODIFIER_OWNER = "modifier_owner"
    # An owner of the model. If the last modifier is in the owners list, returns that
    # user. If the modifier is not found, returns the creator if found in the owners
    # list. Finally, if neither are present, returns the first user in the owners list.
    OWNER = "owner"
