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

import { useState, useMemo, useCallback, useEffect } from 'react';
import { t } from '@apache-superset/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import {
  Button,
  Checkbox,
  Flex,
  Result,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { getTargetUrl, isUrlTrusted, trustUrl, isAllowedScheme } from './utils';

const PageContainer = styled(Flex)`
  ${({ theme }) => css`
    height: calc(100vh - 64px);
    background-color: ${theme.colorBgLayout};
    padding: ${theme.padding}px;
  `}
`;

const UrlDisplay = styled(Flex)`
  ${({ theme }) => css`
    background-color: ${theme.colorFillQuaternary};
    border-radius: ${theme.borderRadiusSM}px;
    padding: ${theme.paddingSM}px ${theme.padding}px;
    margin-bottom: ${theme.margin}px;
  `}
`;

const UrlText = styled(Typography.Text)`
  ${({ theme }) => css`
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSize}px;
    word-break: break-all;
  `}
`;

export default function RedirectWarning() {
  const theme = useTheme();
  const [trustChecked, setTrustChecked] = useState(false);

  const targetUrl = useMemo(() => getTargetUrl(), []);

  // Redirect immediately if the URL is already trusted
  useEffect(() => {
    if (targetUrl && isAllowedScheme(targetUrl) && isUrlTrusted(targetUrl)) {
      window.location.href = targetUrl;
    }
  }, [targetUrl]);

  const handleContinue = useCallback(() => {
    if (!targetUrl || !isAllowedScheme(targetUrl)) return;
    if (trustChecked) {
      trustUrl(targetUrl);
    }
    window.location.href = targetUrl;
  }, [trustChecked, targetUrl]);

  const handleReturn = useCallback(() => {
    window.location.href = '/';
  }, []);

  if (!targetUrl) {
    return (
      <PageContainer justify="center" align="center">
        <Result status="error" title={t('Missing URL parameter')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer justify="center" align="center">
      <Result
        status="warning"
        title={t('External link warning')}
        subTitle={t(
          'This link will take you to an external website. We cannot guarantee the safety of external destinations.',
        )}
        extra={[
          <Button key="return" onClick={handleReturn}>
            {t('Return to Superset')}
          </Button>,
          <Button key="continue" type="primary" onClick={handleContinue}>
            {t('Continue')}
          </Button>,
        ]}
      >
        <UrlDisplay align="center" gap="small">
          <Icons.LinkOutlined iconColor={theme.colorTextTertiary} />
          <UrlText>{targetUrl}</UrlText>
        </UrlDisplay>

        <Checkbox
          checked={trustChecked}
          onChange={e => setTrustChecked(e.target.checked)}
        >
          {t("Trust this URL and don't ask again")}
        </Checkbox>

        <br />

        <Typography.Text type="secondary">
          {t('Only proceed if you trust the destination or its source.')}
        </Typography.Text>
      </Result>
    </PageContainer>
  );
}
