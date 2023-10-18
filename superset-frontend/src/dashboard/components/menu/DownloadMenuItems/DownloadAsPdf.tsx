import React, { SyntheticEvent } from 'react';
import { logging, t } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import { LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF } from 'src/logger/LogUtils';

export default function DownloadAsPdf({
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
