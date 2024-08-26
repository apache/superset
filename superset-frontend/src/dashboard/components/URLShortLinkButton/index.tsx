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
import { getClientErrorObject, t } from '@superset-ui/core';
import Popover, { PopoverProps } from 'src/components/Popover';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { getDashboardPermalink } from 'src/utils/urlUtils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';

export type URLShortLinkButtonProps = {
  dashboardId: number;
  anchorLinkId?: string;
  emailSubject?: string;
  emailContent?: string;
  placement?: PopoverProps['placement'];
};

export default function URLShortLinkButton({
  dashboardId,
  anchorLinkId,
  placement = 'right',
  emailContent = '',
  emailSubject = '',
}: URLShortLinkButtonProps) {
  const [shortUrl, setShortUrl] = useState('');
  const { addDangerToast } = useToasts();
  const { dataMask, activeTabs } = useSelector((state: RootState) => ({
    dataMask: state.dataMask,
    activeTabs: state.dashboardState.activeTabs,
  }));

  const getCopyUrl = async () => {
    try {
      const url = await getDashboardPermalink({
        dashboardId,
        dataMask,
        activeTabs,
        anchor: anchorLinkId,
      });
      setShortUrl(url);
    } catch (error) {
      if (error) {
        addDangerToast(
          (await getClientErrorObject(error)).error ||
            t('Something went wrong.'),
        );
      }
    }
  };

  const emailBody = `${emailContent}${shortUrl || ''}`;
  const emailLink = `mailto:?Subject=${emailSubject}%20&Body=${emailBody}`;

  return (
    <Popover
      trigger="click"
      placement={placement}
      content={
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          id="shorturl-popover"
          data-test="shorturl-popover"
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <CopyToClipboard
            text={shortUrl}
            copyNode={
              <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
            }
          />
          &nbsp;&nbsp;
          <a href={emailLink}>
            <i className="fa fa-envelope" />
          </a>
        </div>
      }
    >
      <span
        className="short-link-trigger btn btn-default btn-sm"
        tabIndex={-1}
        role="button"
        onClick={e => {
          e.stopPropagation();
          getCopyUrl();
        }}
      >
        <i className="short-link-trigger fa fa-link" />
        &nbsp;
      </span>
    </Popover>
  );
}
