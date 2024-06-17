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
import { useToasts } from 'src/components/MessageToasts/withToasts';
import DownloadScreenshot from './DownloadScreenshot';
import { DownloadScreenshotFormat } from './types';

export interface DownloadMenuItemProps {
  pdfMenuItemTitle: string;
  imageMenuItemTitle: string;
  addDangerToast: Function;
  addSuccessToast: Function;
  dashboardTitle: string;
  logEvent?: Function;
  dashboardId: string;
}

const DownloadMenuItems = (props: DownloadMenuItemProps) => {
  const {
    pdfMenuItemTitle,
    imageMenuItemTitle,
    addDangerToast,
    addSuccessToast,
    logEvent,
    dashboardId,
    ...rest
  } = props;

  const { addInfoToast } = useToasts();

  return (
    <Menu selectable={false}>
      <DownloadScreenshot
        text={pdfMenuItemTitle}
        dashboardId={dashboardId}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        logEvent={logEvent}
        addInfoToast={addInfoToast}
        format={DownloadScreenshotFormat.PDF}
        {...rest}
      />
      <DownloadScreenshot
        text={imageMenuItemTitle}
        dashboardId={dashboardId}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        addInfoToast={addInfoToast}
        logEvent={logEvent}
        format={DownloadScreenshotFormat.PNG}
        {...rest}
      />
    </Menu>
  );
};

export default DownloadMenuItems;
