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

from superset.reports.notifications.exceptions import NotificationParamException
from superset.utils.slack import (
    get_channels_with_search,
    refresh_cached_slack_channels_with_search,
    SlackChannel,
    SlackChannelTypes,
)


def _get_slack_channels(
    search_string: str,
) -> tuple[list[SlackChannel], bool]:
    """Fetch matching Slack channels and same-read cache provenance."""
    channels, used_cache = get_channels_with_search(
        search_string=search_string,
        types=[
            SlackChannelTypes.PRIVATE,
            SlackChannelTypes.PUBLIC,
        ],
        exact_match=True,
        force=False,
        return_cache_status=True,
    )
    return channels, used_cache


def _match_slack_channel(
    target: str,
    channels: list[SlackChannel],
) -> SlackChannel | None:
    """Resolve one target with deterministic exact-ID, name, then folded-ID order."""
    match_groups = (
        [channel for channel in channels if channel["id"] == target],
        [
            channel
            for channel in channels
            if channel["name"].casefold() == target.casefold()
        ],
        [
            channel
            for channel in channels
            if channel["id"].casefold() == target.casefold()
        ],
    )
    for matches in match_groups:
        if len(matches) > 1:
            raise NotificationParamException(
                f"Slack channel target is ambiguous: {target}"
            )
        if matches:
            return matches[0]
    return None


def _match_slack_channels(
    targets: list[str],
    channels: list[SlackChannel],
) -> tuple[dict[str, SlackChannel], list[str]]:
    resolved: dict[str, SlackChannel] = {}
    missing: list[str] = []
    for target in targets:
        if channel := _match_slack_channel(target, channels):
            resolved[target] = channel
        else:
            missing.append(target)
    return resolved, missing


def resolve_slack_channel_ids(
    targets: list[str],
) -> dict[str, str]:
    """Resolve Slack names or IDs, refreshing only a stale cached listing."""
    search_string = ",".join(targets)
    channels, used_cached_channels = _get_slack_channels(search_string)
    channels_by_target, missing_channels = _match_slack_channels(targets, channels)
    if missing_channels and used_cached_channels:
        channels = refresh_cached_slack_channels_with_search(
            search_string=search_string,
            types=[SlackChannelTypes.PRIVATE, SlackChannelTypes.PUBLIC],
            exact_match=True,
        )
        channels_by_target, missing_channels = _match_slack_channels(targets, channels)
    if missing_channels:
        raise NotificationParamException(
            f"Could not find the following channels: {', '.join(missing_channels)}"
        )
    return {target: channel["id"] for target, channel in channels_by_target.items()}
