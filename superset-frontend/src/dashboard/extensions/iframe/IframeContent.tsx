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

/**
 * Built-in "iframe" dashboard component, delivered through the
 * `dashboardComponents` Extensions contribution point. This renders only the
 * element's *content* and editor — the host (DashboardExtensionComponent) owns
 * the drag/resize/delete chrome.
 *
 * The component also surfaces the runtime CSP allowlist UX (companion SIP):
 * when the embedded origin is not allowed, it flags it and offers permitted
 * admins an "Enable domain in CSP" action.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { dashboardComponents as dashboardComponentsApi } from '@apache-superset/core';
import { Alert } from '@apache-superset/core/components';
import { Button, Input } from '@superset-ui/core/components';

import { useToasts } from 'src/components/MessageToasts/withToasts';
import { findPermission } from 'src/utils/findPermission';
import type { RootState } from 'src/dashboard/types';
import {
  addCspAllowlistEntry,
  CSP_ALLOWLIST_PERMISSION,
  CSP_ALLOWLIST_VIEW,
  fetchCspAllowlist,
  getOrigin,
  isEmbeddableUrl,
} from 'src/dashboard/util/cspAllowlist';

type DashboardComponentProps = dashboardComponentsApi.DashboardComponentProps;

const IframeStyles = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;

    .dashboard-iframe-frame {
      flex: 1;
      width: 100%;
      border: 0;
      min-height: ${theme.sizeUnit * 25}px;
    }

    .dashboard-iframe-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.colorTextTertiary};
      border: 1px dashed ${theme.colorBorder};
    }
  `}
`;

export default function IframeContent({
  meta,
  editMode,
  updateMeta,
}: DashboardComponentProps) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const roles = useSelector((state: RootState) => state.user?.roles);
  const cspFeatureEnabled = isFeatureEnabled(FeatureFlag.CspRuntimeAllowlist);
  const canManageCsp =
    cspFeatureEnabled &&
    findPermission(CSP_ALLOWLIST_PERMISSION, CSP_ALLOWLIST_VIEW, roles);

  const url = (meta.url as string) ?? '';
  const [draftUrl, setDraftUrl] = useState(url);
  const [allowlist, setAllowlist] = useState<Set<string> | null>(null);
  const [enabling, setEnabling] = useState(false);

  const origin = getOrigin(url);

  const refreshAllowlist = useCallback(() => {
    if (!cspFeatureEnabled) {
      return;
    }
    fetchCspAllowlist()
      .then(setAllowlist)
      .catch(() => setAllowlist(new Set()));
  }, [cspFeatureEnabled]);

  useEffect(() => {
    refreshAllowlist();
  }, [refreshAllowlist]);

  useEffect(() => {
    setDraftUrl(url);
  }, [url]);

  const handleSaveUrl = useCallback(() => {
    const trimmed = draftUrl.trim();
    if (trimmed === url) {
      return;
    }
    updateMeta({ url: trimmed });
  }, [draftUrl, updateMeta, url]);

  const handleEnableDomain = useCallback(() => {
    if (!origin) {
      return;
    }
    setEnabling(true);
    addCspAllowlistEntry(origin)
      .then(() => {
        addSuccessToast(
          t('%(origin)s is now allowed to be embedded.', { origin }),
        );
        refreshAllowlist();
      })
      .catch(() =>
        addDangerToast(t('Failed to allow %(origin)s in the CSP.', { origin })),
      )
      .finally(() => setEnabling(false));
  }, [addDangerToast, addSuccessToast, origin, refreshAllowlist]);

  const domainFlagged =
    cspFeatureEnabled &&
    !!origin &&
    allowlist !== null &&
    !allowlist.has(origin);

  return (
    <IframeStyles data-test="dashboard-iframe">
      {editMode && (
        <Input
          aria-label={t('Embed URL')}
          data-test="dashboard-iframe-url-input"
          placeholder={t('Paste a URL to embed, e.g. https://example.com')}
          value={draftUrl}
          onChange={e => setDraftUrl(e.target.value)}
          onBlur={handleSaveUrl}
          onPressEnter={handleSaveUrl}
        />
      )}
      {domainFlagged && (
        <Alert
          type="warning"
          showIcon
          closable={false}
          message={t('This domain is not allowed to be embedded')}
          description={
            canManageCsp
              ? t(
                  '%(origin)s is blocked by the Content Security Policy. ' +
                    'Enable it to allow this content to load.',
                  { origin },
                )
              : t(
                  '%(origin)s is blocked by the Content Security Policy. ' +
                    'Ask an administrator to allow this domain.',
                  { origin },
                )
          }
          action={
            canManageCsp ? (
              <Button
                buttonStyle="primary"
                buttonSize="small"
                loading={enabling}
                onClick={handleEnableDomain}
                data-test="dashboard-iframe-enable-csp"
              >
                {t('Enable domain in CSP')}
              </Button>
            ) : undefined
          }
        />
      )}
      {isEmbeddableUrl(url) ? (
        <iframe
          className="dashboard-iframe-frame"
          src={url}
          title={t('Embedded content')}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      ) : (
        <div className="dashboard-iframe-empty">
          {editMode
            ? t('Enter a URL above to embed content')
            : t('No URL configured')}
        </div>
      )}
    </IframeStyles>
  );
}
