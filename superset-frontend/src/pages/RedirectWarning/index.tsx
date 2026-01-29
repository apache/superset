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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import {
  Button,
  Card,
  Checkbox,
  Flex,
  Typography,
  Icons,
} from '@superset-ui/core/components';

const TRUSTED_URLS_KEY = 'superset_trusted_urls';
const MAX_TRUSTED_URLS = 100;

const PageContainer = styled(Flex)`
  ${({ theme }) => css`
    height: calc(100vh - 64px);
    background-color: ${theme.colorBgLayout};
    padding: ${theme.padding}px;
  `}
`;

const WarningCard = styled(Card)`
  ${({ theme }) => css`
    max-width: 520px;
    width: 100%;
    box-shadow: ${theme.boxShadowSecondary};
  `}
`;

const WarningHeader = styled(Flex)`
  ${({ theme }) => css`
    padding: ${theme.paddingLG}px ${theme.paddingXL}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const WarningBody = styled.div`
  ${({ theme }) => css`
    padding: ${theme.paddingXL}px;
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

const TrustSection = styled(Flex)`
  ${({ theme }) => css`
    margin-bottom: ${theme.marginSM}px;
  `}
`;

const WarningFooter = styled(Flex)`
  ${({ theme }) => css`
    padding: ${theme.padding}px ${theme.paddingXL}px;
    background-color: ${theme.colorFillAlter};
    border-top: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const WarningTitle = styled(Typography.Title)`
  && {
    margin: 0;
  }
`;

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const normalized =
      parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
    return normalized;
  } catch {
    return url;
  }
}

function getTrustedUrls(): string[] {
  try {
    const stored = localStorage.getItem(TRUSTED_URLS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTrustedUrls(urls: string[]): void {
  try {
    const limitedUrls =
      urls.length > MAX_TRUSTED_URLS ? urls.slice(-MAX_TRUSTED_URLS) : urls;
    localStorage.setItem(TRUSTED_URLS_KEY, JSON.stringify(limitedUrls));

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    document.cookie = `superset_trusted_urls=${encodeURIComponent(JSON.stringify(limitedUrls))}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  } catch {
    // Ignore storage errors
  }
}

function isUrlTrusted(url: string): boolean {
  const normalizedUrl = normalizeUrl(url);
  const trustedUrls = getTrustedUrls();
  return trustedUrls.some(trusted => normalizeUrl(trusted) === normalizedUrl);
}

function trustUrl(url: string): void {
  const normalizedUrl = normalizeUrl(url);
  const trustedUrls = getTrustedUrls();
  const normalizedTrusted = trustedUrls.map(u => normalizeUrl(u));

  if (!normalizedTrusted.includes(normalizedUrl)) {
    trustedUrls.push(url);
    saveTrustedUrls(trustedUrls);
  }
}

export default function RedirectWarning() {
  const theme = useTheme();
  const [trustChecked, setTrustChecked] = useState(false);

  const targetUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const url = params.get('url') || '';
      return decodeURIComponent(url).trim();
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    if (targetUrl && isUrlTrusted(targetUrl)) {
      window.location.href = targetUrl;
    }
  }, [targetUrl]);

  const handleContinue = useCallback(() => {
    if (trustChecked && targetUrl) {
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
        <WarningCard>
          <WarningBody>
            <Typography.Text type="danger">
              {t('Missing URL parameter')}
            </Typography.Text>
          </WarningBody>
        </WarningCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer justify="center" align="center">
      <WarningCard>
        <WarningHeader align="center" gap="middle">
          <Icons.WarningOutlined iconColor={theme.colorWarning} iconSize="xl" />
          <WarningTitle level={4}>{t('External link warning')}</WarningTitle>
        </WarningHeader>

        <WarningBody>
          <Typography.Paragraph type="secondary">
            {t(
              'This link will take you to an external website. We cannot guarantee the safety of external destinations.',
            )}
          </Typography.Paragraph>

          <UrlDisplay align="center" gap="small">
            <Icons.LinkOutlined iconColor={theme.colorTextTertiary} />
            <UrlText>{targetUrl}</UrlText>
          </UrlDisplay>

          <TrustSection align="center" gap="small">
            <Checkbox
              checked={trustChecked}
              onChange={e => setTrustChecked(e.target.checked)}
            >
              {t("Trust this exact URL and don't ask again")}
            </Checkbox>
          </TrustSection>

          <Typography.Text type="secondary">
            {t('Only proceed if you trust the destination or its source.')}
          </Typography.Text>
        </WarningBody>

        <WarningFooter justify="flex-end" gap="small">
          <Button onClick={handleReturn}>{t('Return to Superset')}</Button>
          <Button type="primary" onClick={handleContinue}>
            {t('Continue')}
          </Button>
        </WarningFooter>
      </WarningCard>
    </PageContainer>
  );
}
