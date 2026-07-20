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
import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

/**
 * A mobile-friendly page shown when users try to access
 * features that aren't supported on mobile devices. Growing the window
 * past the mobile breakpoint unblocks the route automatically (useIsMobile
 * subscribes to the breakpoint), so no manual bypass is offered.
 */
function MobileUnsupported() {
  const theme = useTheme();
  const history = useHistory();

  const handleViewDashboards = useCallback(() => {
    history.push('/dashboard/list/');
  }, [history]);

  const handleGoHome = useCallback(() => {
    history.push('/welcome/');
  }, [history]);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 60px);
        padding: ${theme.sizeUnit * 6}px;
        text-align: center;
        background: ${theme.colorBgContainer};
      `}
    >
      {/* Icon */}
      <div
        css={css`
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: ${theme.colorBgLayout};
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: ${theme.sizeUnit * 6}px;
        `}
      >
        <Icons.DesktopOutlined
          iconSize="xxl"
          iconColor={theme.colorTextSecondary}
          css={css`
            font-size: 48px;
          `}
        />
      </div>

      {/* Title */}
      <h1
        css={css`
          font-size: ${theme.fontSizeXL}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorText};
          margin: 0 0 ${theme.sizeUnit * 2}px 0;
        `}
      >
        {t("This view isn't available on mobile")}
      </h1>

      {/* Description */}
      <p
        css={css`
          font-size: ${theme.fontSizeSM}px;
          color: ${theme.colorTextSecondary};
          margin: 0 0 ${theme.sizeUnit * 8}px 0;
          max-width: 300px;
          line-height: 1.5;
        `}
      >
        {t(
          'Some features require a larger screen. Try viewing dashboards for the best mobile experience.',
        )}
      </p>

      {/* Primary action */}
      <div>
        <Button
          buttonStyle="primary"
          onClick={handleViewDashboards}
          css={css`
            width: 280px;
            height: 48px;
            font-size: ${theme.fontSizeSM}px;
          `}
        >
          {t('View Dashboards')}
        </Button>
      </div>

      {/* Secondary action */}
      <div
        css={css`
          margin-top: ${theme.sizeUnit * 3}px;
        `}
      >
        <Button
          buttonStyle="secondary"
          onClick={handleGoHome}
          css={css`
            width: 280px;
            height: 48px;
            font-size: ${theme.fontSizeSM}px;
          `}
        >
          {t('Go to Welcome Page')}
        </Button>
      </div>
    </div>
  );
}

export default MobileUnsupported;
