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

import URLShortLinkButton from 'src/components/URLShortLinkButton';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import getLocationHash from 'src/dashboard/util/getLocationHash';

interface AnchorLinkProps {
  anchorLinkId: string;
  filters: Record<string, any>;
  showShortLinkButton?: boolean;
  inFocus?: boolean;
  placement: 'right' | 'left' | 'top' | 'bottom';
}

function AnchorLink({
  filters = {},
  showShortLinkButton = false,
  inFocus = false,
  placement = "right",
  ...props
}: AnchorLinkProps) {

  const { anchorLinkId } = props;

  function scrollToView(delay = 0) {
    const directLinkComponent = document.getElementById(anchorLinkId);
    if (directLinkComponent) {
      setTimeout(() => {
        directLinkComponent.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      }, delay);
    }
  }

  useEffect(() => {
    if (inFocus) {
      scrollToView();
    }
  }, [inFocus])

  useEffect(() => {
    const hash = getLocationHash();
    if (hash && anchorLinkId === hash) {
      scrollToView();
    }
  });

  return (
    <span className="anchor-link-container" id={anchorLinkId}>
      {showShortLinkButton && (
        <URLShortLinkButton
          url={getDashboardUrl({
            pathname: window.location.pathname,
            filters,
            hash: anchorLinkId,
          })}
          emailSubject={t('Superset chart')}
          emailContent={t('Check out this chart in dashboard:')}
          placement={placement}
        />
      )}
    </span>
  );
}

export default AnchorLink;
