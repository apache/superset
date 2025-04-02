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
import { useState } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { PublishedLabel } from 'src/components/Label';

export type ChartPublishedStatusType = {
  sliceId: number;
  userCanOverwrite: boolean;
  isPublished: boolean;
};

const draftButtonTooltip = t(
  'This chart is in draft. This indicated this chart is a work in progress.',
);

const publishedTooltip = t(
  'This chart is published. Click to make it a draft.',
);

export default function ChartPublishedStatus({
  sliceId,
  userCanOverwrite,
  isPublished,
}: ChartPublishedStatusType) {
  const [published, setPublished] = useState(isPublished);

  const togglePublished = (published: boolean) => {
    SupersetClient.put({
      endpoint: `/api/v1/chart/${sliceId}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        published,
      }),
    }).then(() => {
      setPublished(published);
    });
  };

  // only show it if the user can overwrite
  if (userCanOverwrite) {
    // Show everybody the draft badge
    if (!published) {
      // if they can edit the chart, make the badge a button
      return (
        <Tooltip
          id="unpublished-chart-tooltip"
          placement="bottom"
          title={draftButtonTooltip}
        >
          <div>
            <PublishedLabel
              isPublished={published}
              onClick={() => togglePublished(!published)}
            />
          </div>
        </Tooltip>
      );
    }
    // Show the published badge for the owner of the chart to toggle
    return (
      <Tooltip
        id="published-chart-tooltip"
        placement="bottom"
        title={publishedTooltip}
      >
        <div>
          <PublishedLabel
            isPublished={published}
            onClick={() => togglePublished(!published)}
          />
        </div>
      </Tooltip>
    );
  }
  // Don't show anything if one doesn't own the chart
  return null;
}
