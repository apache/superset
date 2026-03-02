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
import { useHistory, useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Button, Grid } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

const { useBreakpoint } = Grid;

interface MobileUnsupportedProps {
  /** The original path the user was trying to access */
  originalPath?: string;
}

/**
 * A mobile-friendly page shown when users try to access
 * features that aren't supported on mobile devices.
 */
function MobileUnsupported({ originalPath }: MobileUnsupportedProps) {
  const theme = useTheme();
  const history = useHistory();
  const location = useLocation();
  const screens = useBreakpoint();

  // Get the original path from props or query params
  const fromPath =
    originalPath ||
    new URLSearchParams(location.search).get('from') ||
    location.pathname;

  const handleViewDashboards = useCallback(() => {
    history.push('/dashboard/list/');
  }, [history]);

  const handleGoHome = useCallback(() => {
    history.push('/superset/welcome/');
  }, [history]);

  const handleContinueAnyway = useCallback(() => {
    // Store preference in sessionStorage so we don't keep redirecting
    try {
      sessionStorage.setItem('mobile-bypass', 'true');
    } catch {
      // Storage access denied, continue anyway without persisting
    }
    history.push(fromPath);
  }, [history, fromPath]);

  // Determine if we're at or above the 'md' breakpoint (i.e. not on mobile)
  const isNotMobile = screens.md;

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

      {/* Continue anyway link */}
      <button
        type="button"
        onClick={handleContinueAnyway}
        css={css`
          background: none;
          border: none;
          color: ${theme.colorPrimary};
          font-size: ${theme.fontSizeSM}px;
          cursor: pointer;
          padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
          margin-top: ${theme.sizeUnit * 4}px;
          text-decoration: underline;

          &:hover {
            color: ${theme.colorPrimaryHover};
          }
        `}
      >
        {t('Continue anyway')} →
      </button>

      {/* Show hint if screen is now larger */}
      {isNotMobile && (
        <p
          css={css`
            margin-top: ${theme.sizeUnit * 6}px;
            font-size: ${theme.fontSizeXS}px;
            color: ${theme.colorTextDescription};
          `}
        >
          {t('Your screen is now large enough.')}
          <button
            type="button"
            onClick={handleContinueAnyway}
            css={css`
              background: none;
              border: none;
              color: ${theme.colorPrimary};
              cursor: pointer;
              padding: 0 ${theme.sizeUnit}px;
              text-decoration: underline;
            `}
          >
            {t('Continue to page')}
          </button>
        </p>
      )}
    </div>
  );
}

export default MobileUnsupported;
