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
import { SyntheticEvent } from 'react';
import { t, logging } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import downloadAsImage from 'src/utils/downloadAsImage';

import { LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE } from 'src/logger/LogUtils';

interface DownloadMenuItemProps {
  url?: string;
  pdfMenuItemTitle: string;
  imageMenuItemTitle: string;
  addDangerToast: Function;
  addSuccessToast: Function;
  dashboardTitle: string;
  logEvent?: Function;
}

const SCREENSHOT_NODE_SELECTOR = '.dashboard';

const ShareMenuItems = (props: DownloadMenuItemProps) => {
  const {
    pdfMenuItemTitle,
    imageMenuItemTitle,
    addDangerToast,
    addSuccessToast,
    dashboardTitle,
    logEvent,
    ...rest
  } = props;

  const onDownloadPDF = () => {
    addSuccessToast(t('You attempted to download the PDF.'));
  };
  // case MENU_KEYS.DOWNLOAD_DASHBOARD: {
  //   // menu closes with a delay, we need to hide it manually,
  //   // so that we don't capture it on the screenshot
  //   const menu = document.querySelector(
  //     '.ant-dropdown:not(.ant-dropdown-hidden)',
  //   );
  //   menu.style.visibility = 'hidden';
  //   downloadAsImage(
  //     SCREENSHOT_NODE_SELECTOR,
  //     this.props.dashboardTitle,
  //     true,
  //   )(domEvent).then(() => {
  //     menu.style.visibility = 'visible';
  //   });
  //   this.props.logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE);
  //   break;
  // }
  const onDownloadImage = async (e: SyntheticEvent) => {
    try {
      downloadAsImage(SCREENSHOT_NODE_SELECTOR, dashboardTitle, true)(e);
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
    logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE);
  };

  return (
    <Menu selectable={false}>
      <Menu.Item key="download-pdf" {...rest}>
        <div onClick={onDownloadPDF} role="button" tabIndex={0}>
          {pdfMenuItemTitle}
        </div>
      </Menu.Item>
      <Menu.Item key="download-image" {...rest}>
        <div onClick={onDownloadImage} role="button" tabIndex={0}>
          {imageMenuItemTitle}
        </div>
      </Menu.Item>
    </Menu>
  );
};

export default ShareMenuItems;
