import React, { SyntheticEvent } from 'react';
import { logging, t } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE } from 'src/logger/LogUtils';
import downloadAsImage from 'src/utils/downloadAsImage';

export default function DownloadAsImage({
  text,
  logEvent,
  dashboardTitle,
  addDangerToast,
  ...rest
}: {
  text: string;
  addDangerToast: Function;
  dashboardTitle: string;
  logEvent?: Function;
}) {
  const SCREENSHOT_NODE_SELECTOR = '.dashboard';
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
    <Menu.Item key="download-image" {...rest}>
      <div onClick={onDownloadImage} role="button" tabIndex={0}>
        {text}
      </div>
    </Menu.Item>
  );
}
