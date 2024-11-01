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
import { logging, t } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import { LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF } from 'src/logger/LogUtils';
import { useToasts } from 'src/components/MessageToasts/withToasts';

export default function DownloadAsPdf({
  text,
  logEvent,
  dashboardTitle,
  ...rest
}: {
  text: string;
  dashboardTitle: string;
  logEvent?: Function;
}) {
  const SCREENSHOT_NODE_SELECTOR = '.dashboard';
  const { addDangerToast } = useToasts();
  const onDownloadPdf = async (e: SyntheticEvent) => {
    try {
      downloadAsPdf(SCREENSHOT_NODE_SELECTOR, dashboardTitle, true)(e);
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
    logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF);
  };

  return (
    <Menu.Item key="download-pdf" {...rest}>
      <div onClick={onDownloadPdf} role="button" tabIndex={0}>
        {text}
      </div>
    </Menu.Item>
  );
}
