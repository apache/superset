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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { StandardModal } from 'src/components/Modal';

interface FolderDetails {
  name: string;
  description: string | null;
  created_on: string;
  changed_on: string;
  created_by: { first_name: string; last_name: string } | null;
  changed_by: { first_name: string; last_name: string } | null;
  children_count: number;
  asset_count: number;
  asset_breakdown: {
    dashboards: number;
    charts: number;
    subfolders: number;
  };
}

interface FolderInfoModalProps {
  folderUuid: string;
  show: boolean;
  onHide: () => void;
}

const StyledInfoModal = styled(StandardModal)`
  .ant-modal-header {
    border-bottom: none;
  }
`;

const ModalContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const InfoSection = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px 0;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    &:first-child {
      padding-top: 0;
    }
    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  `}
`;

const InfoLabel = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin-bottom: ${theme.sizeUnit}px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `}
`;

const InfoValue = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
    line-height: 1.5;
  `}
`;

const SizeGrid = styled.div`
  ${({ theme }) => `
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const SizeCard = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgLayout};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const SizeNumber = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeXL}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const SizeLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const TotalRow = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 2}px;
    padding-top: ${theme.sizeUnit}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

function formatUser(
  user: { first_name: string; last_name: string } | null,
): string {
  if (!user) return t('Unknown');
  return `${user.first_name} ${user.last_name}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export default function FolderInfoModal({
  folderUuid,
  show,
  onHide,
}: FolderInfoModalProps) {
  const [details, setDetails] = useState<FolderDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show || !folderUuid) return;
    setLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/folders/${folderUuid}`,
    }).then(
      ({ json }) => {
        setDetails(json?.result ?? null);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
  }, [show, folderUuid]);

  const breakdown = details?.asset_breakdown;
  const totalAssets =
    (breakdown?.dashboards ?? 0) +
    (breakdown?.charts ?? 0) +
    (breakdown?.subfolders ?? 0);

  return (
    <StyledInfoModal
      title={details?.name ?? t('Folder Information')}
      show={show}
      onHide={onHide}
      onSave={onHide}
      saveText={t('Close')}
      contentLoading={loading}
      width={480}
    >
      {details && (
        <ModalContent>
          {details.description && (
            <InfoSection>
              <InfoLabel>{t('Description')}</InfoLabel>
              <InfoValue>{details.description}</InfoValue>
            </InfoSection>
          )}

          <InfoSection>
            <InfoLabel>{t('Created by')}</InfoLabel>
            <InfoValue>
              {formatUser(details.created_by)} — {formatDate(details.created_on)}
            </InfoValue>
          </InfoSection>

          <InfoSection>
            <InfoLabel>{t('Last modified by')}</InfoLabel>
            <InfoValue>
              {formatUser(details.changed_by)} — {formatDate(details.changed_on)}
            </InfoValue>
          </InfoSection>

          <InfoSection>
            <InfoLabel>{t('Folder size')}</InfoLabel>
            <SizeGrid>
              <SizeCard>
                <Icons.LayoutOutlined iconSize="l" />
                <SizeNumber>{breakdown?.dashboards ?? 0}</SizeNumber>
                <SizeLabel>{t('Dashboards')}</SizeLabel>
              </SizeCard>
              <SizeCard>
                <Icons.LineChartOutlined iconSize="l" />
                <SizeNumber>{breakdown?.charts ?? 0}</SizeNumber>
                <SizeLabel>{t('Charts')}</SizeLabel>
              </SizeCard>
              <SizeCard>
                <Icons.FolderOutlined iconSize="l" />
                <SizeNumber>{breakdown?.subfolders ?? 0}</SizeNumber>
                <SizeLabel>{t('Subfolders')}</SizeLabel>
              </SizeCard>
            </SizeGrid>
            <TotalRow>
              {t('Total: %s assets', totalAssets)}
            </TotalRow>
          </InfoSection>
        </ModalContent>
      )}
    </StyledInfoModal>
  );
}
