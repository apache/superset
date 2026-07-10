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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Button } from '@superset-ui/core/components';
import type { VersionedEntityType } from './types';
import { clearVersionPreview, selectVersionHistory } from './reducer';
import { useVersionActions } from './useVersionActions';
import { formatVersionDateTime } from './display';

const Actions = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

export interface PreviewBannerProps {
  entityType: VersionedEntityType;
  canRestore?: boolean;
}

export default function PreviewBanner({
  entityType,
  canRestore = true,
}: PreviewBannerProps) {
  const dispatch = useDispatch();
  const { entityType: activeEntityType, preview } =
    useSelector(selectVersionHistory);
  const { requestRestore, openAsNew, restoreModal } = useVersionActions(
    entityType,
    preview?.entityUuid,
  );

  const handleClose = useCallback(() => {
    dispatch(clearVersionPreview());
  }, [dispatch]);

  if (!preview || activeEntityType !== entityType) {
    return null;
  }

  const target = {
    versionUuid: preview.versionUuid,
    headline: preview.headline,
    issuedAt: preview.issuedAt,
  };

  // Chart save headlines are themselves the save datetime; avoid
  // rendering the same timestamp twice.
  const issuedAtLabel = formatVersionDateTime(preview.issuedAt);
  const message =
    preview.headline === issuedAtLabel
      ? t('Previewing historical version · %s', issuedAtLabel)
      : t(
          'Previewing historical version · %s · %s',
          preview.headline,
          issuedAtLabel,
        );

  return (
    <>
      <Alert
        type="info"
        closable={false}
        data-test="version-preview-banner"
        message={message}
        action={
          <Actions>
            {canRestore && (
              <Button
                buttonSize="small"
                buttonStyle="primary"
                onClick={() => requestRestore(target)}
              >
                {t('Restore this version')}
              </Button>
            )}
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={() => openAsNew(target)}
            >
              {entityType === 'chart'
                ? t('Open as new chart')
                : t('Open as new dashboard')}
            </Button>
            <Button buttonSize="small" buttonStyle="link" onClick={handleClose}>
              {t('Close preview')}
            </Button>
          </Actions>
        }
      />
      {restoreModal}
    </>
  );
}
