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
import { Menu } from 'src/components/Menu';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import DownloadScreenshot from './DownloadScreenshot';
import { DownloadScreenshotFormat } from './types';
import DownloadAsPdf from './DownloadAsPdf';
import DownloadAsImage from './DownloadAsImage';

export interface DownloadMenuItemProps {
  pdfMenuItemTitle: string;
  imageMenuItemTitle: string;
  dashboardTitle: string;
  logEvent?: Function;
  dashboardId: string;
}

const DownloadMenuItems = (props: DownloadMenuItemProps) => {
  const {
    pdfMenuItemTitle,
    imageMenuItemTitle,
    logEvent,
    dashboardId,
    dashboardTitle,
    ...rest
  } = props;
  const isWebDriverScreenshotEnabled =
    isFeatureEnabled(FeatureFlag.EnableDashboardScreenshotEndpoints) &&
    isFeatureEnabled(FeatureFlag.EnableDashboardDownloadWebDriverScreenshot);

  return (
    <Menu selectable={false}>
      {isWebDriverScreenshotEnabled ? (
        <>
          <DownloadScreenshot
            text={pdfMenuItemTitle}
            dashboardId={dashboardId}
            logEvent={logEvent}
            format={DownloadScreenshotFormat.PDF}
            {...rest}
          />
          <DownloadScreenshot
            text={imageMenuItemTitle}
            dashboardId={dashboardId}
            logEvent={logEvent}
            format={DownloadScreenshotFormat.PNG}
            {...rest}
          />
        </>
      ) : (
        <>
          <DownloadAsPdf
            text={pdfMenuItemTitle}
            dashboardTitle={dashboardTitle}
            logEvent={logEvent}
            {...rest}
          />
          <DownloadAsImage
            text={imageMenuItemTitle}
            dashboardTitle={dashboardTitle}
            logEvent={logEvent}
            {...rest}
          />
        </>
      )}
    </Menu>
  );
};

export default DownloadMenuItems;
