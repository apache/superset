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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { useDownloadScreenshot } from 'src/dashboard/hooks/useDownloadScreenshot';
import { ComponentProps } from 'react';
import { DownloadScreenshotFormat } from './types';
import DownloadAsPdf from './DownloadAsPdf';
import DownloadAsImage from './DownloadAsImage';

export interface DownloadMenuItemProps
  extends ComponentProps<typeof Menu.SubMenu> {
  pdfMenuItemTitle: string;
  imageMenuItemTitle: string;
  dashboardTitle: string;
  logEvent?: Function;
  dashboardId: number;
  title: string;
  disabled?: boolean;
  submenuKey: string;
}

const DownloadMenuItems = (props: DownloadMenuItemProps) => {
  const {
    pdfMenuItemTitle,
    imageMenuItemTitle,
    logEvent,
    dashboardId,
    dashboardTitle,
    submenuKey,
    disabled,
    title,
    ...rest
  } = props;
  const isWebDriverScreenshotEnabled =
    isFeatureEnabled(FeatureFlag.EnableDashboardScreenshotEndpoints) &&
    isFeatureEnabled(FeatureFlag.EnableDashboardDownloadWebDriverScreenshot);

  const downloadScreenshot = useDownloadScreenshot(dashboardId, logEvent);

  return isWebDriverScreenshotEnabled ? (
    <Menu.SubMenu key={submenuKey} title={title} disabled={disabled} {...rest}>
      <Menu.Item
        key={DownloadScreenshotFormat.PDF}
        onClick={() => downloadScreenshot(DownloadScreenshotFormat.PDF)}
      >
        {pdfMenuItemTitle}
      </Menu.Item>
      <Menu.Item
        key={DownloadScreenshotFormat.PNG}
        onClick={() => downloadScreenshot(DownloadScreenshotFormat.PNG)}
      >
        {imageMenuItemTitle}
      </Menu.Item>
    </Menu.SubMenu>
  ) : (
    <Menu.SubMenu key={submenuKey} title={title} disabled={disabled} {...rest}>
      <DownloadAsPdf
        text={pdfMenuItemTitle}
        dashboardTitle={dashboardTitle}
        logEvent={logEvent}
      />
      <DownloadAsImage
        text={imageMenuItemTitle}
        dashboardTitle={dashboardTitle}
        logEvent={logEvent}
      />
    </Menu.SubMenu>
  );
};

export default DownloadMenuItems;
