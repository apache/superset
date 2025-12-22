/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback, useRef, useState } from 'react';
import { logging, SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { SlackChannel } from '../types';

export interface SlackChannelOption {
  label: string;
  value: string;
}

export interface SlackChannelsResult {
  data: SlackChannelOption[];
  totalCount: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface FetchChannelsParams {
  search: string;
  page: number;
  pageSize: number;
  force?: boolean;
}

export interface UseSlackChannelsResult {
  fetchChannels: (params: FetchChannelsParams) => Promise<SlackChannelsResult>;
  refreshChannels: () => Promise<void>;
  isRefreshing: boolean;
}

/**
 * Cache types for managing Slack channel data
 */
type CursorCache = Record<string, string | null>;
type DataCache = Record<string, SlackChannelsResult>;
type PendingRequestsCache = Record<string, Promise<SlackChannelsResult>>;

/**
 * Custom hook for managing Slack channels with caching and pagination
 */
export function useSlackChannels(
  onError?: (message: string) => void,
): UseSlackChannelsResult {
  const cursorRef = useRef<CursorCache>({});
  const dataCache = useRef<DataCache>({});
  const pendingRequests = useRef<PendingRequestsCache>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchChannels = useCallback(
    async ({
      search,
      page,
      pageSize,
      force = false,
    }: FetchChannelsParams): Promise<SlackChannelsResult> => {
      const cacheKey = `${search}:${page}`;

      if (!force && dataCache.current[cacheKey]) {
        return dataCache.current[cacheKey];
      }

      if (!force && cacheKey in pendingRequests.current) {
        return pendingRequests.current[cacheKey];
      }

      const cursor = page > 0 ? cursorRef.current[cacheKey] : null;

      const params: Record<string, any> = {
        types: ['public_channel', 'private_channel'],
        limit: pageSize,
      };

      if (search) {
        params.search_string = search;
      }

      if (cursor) {
        params.cursor = cursor;
      }

      if (force) {
        params.force = true;
      }

      const queryString = rison.encode(params);
      const endpoint = `/api/v1/report/slack_channels/?q=${queryString}`;

      const fetchPromise = (async () => {
        try {
          const response = await SupersetClient.get({ endpoint });

          const {
            result,
            next_cursor: nextCursor,
            has_more: hasMore,
          } = response.json;

          if (nextCursor) {
            cursorRef.current[`${search}:${page + 1}`] = nextCursor;
          }

          const options = result.map((channel: SlackChannel) => ({
            label: channel.name,
            value: channel.id,
          }));

          const totalCount = hasMore
            ? (page + 1) * pageSize + 1
            : page * pageSize + options.length;

          const responseData = {
            data: options,
            totalCount,
            has_more: hasMore,
            next_cursor: nextCursor,
          };

          dataCache.current[cacheKey] = responseData;

          return responseData;
        } catch (error) {
          logging.error('Failed to fetch Slack channels:', error);

          if (onError) {
            onError(
              t(
                'Unable to load Slack channels. Please check your Slack API token configuration.',
              ),
            );
          }

          return {
            data: [],
            totalCount: 0,
          };
        } finally {
          delete pendingRequests.current[cacheKey];
        }
      })();

      pendingRequests.current[cacheKey] = fetchPromise;

      return fetchPromise;
    },
    [onError],
  );

  const refreshChannels = useCallback(async () => {
    setIsRefreshing(true);

    try {
      cursorRef.current = {};
      dataCache.current = {};
      pendingRequests.current = {};

      await fetchChannels({ search: '', page: 0, pageSize: 999, force: true });
    } catch (error) {
      logging.error('Error refreshing channels:', error);

      if (onError) {
        onError(t('Failed to refresh Slack channels. Please try again.'));
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchChannels, onError]);

  return {
    fetchChannels,
    refreshChannels,
    isRefreshing,
  };
}
