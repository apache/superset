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
import React, { useEffect } from 'react';
import { t } from '@superset-ui/core';

import URLShortLinkButton, {
  URLShortLinkButtonProps,
} from 'src/dashboard/components/URLShortLinkButton';
import getLocationHash from 'src/dashboard/util/getLocationHash';

export type AnchorLinkProps = {
  id: string;
  dashboardId?: number;
  scrollIntoView?: boolean;
  showShortLinkButton?: boolean;
} & Pick<URLShortLinkButtonProps, 'placement'>;

export default function AnchorLink({
  id,
  dashboardId,
  placement = 'right',
  scrollIntoView = false,
  showShortLinkButton = true,
}: AnchorLinkProps) {
  const scrollAnchorIntoView = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  };

  // will always scroll element into view if element id and url hash match
  const hash = getLocationHash();
  useEffect(() => {
    if (hash && id === hash) {
      scrollAnchorIntoView(id);
    }
  }, [hash, id]);

  // force scroll into view
  useEffect(() => {
    if (scrollIntoView) {
      scrollAnchorIntoView(id);
    }
  }, [id, scrollIntoView]);

  return (
    <span className="anchor-link-container" id={id}>
      {showShortLinkButton && dashboardId && (
        <URLShortLinkButton
          anchorLinkId={id}
          dashboardId={dashboardId}
          emailSubject={t('Superset chart')}
          emailContent={t('Check out this chart in dashboard:')}
          placement={placement}
        />
      )}
    </span>
  );
}
