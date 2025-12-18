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
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  Button,
  Checkbox,
  Collapse,
  Divider,
  Flex,
  Icons,
  Typography,
} from '@superset-ui/core/components';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';
import DatabaseSchemaPicker from './DatabaseSchemaPicker';

interface DataSourcePanelProps {
  database: DatabaseObject | null;
  catalog: string | null;
  schema: string | null;
  isSubmitting: boolean;
  forceReanalyze: boolean;
  hasExistingReport: boolean;
  existingReportInfo?: string;
  onDatabaseChange: (db: DatabaseObject | null) => void;
  onCatalogChange: (catalog: string | null) => void;
  onSchemaChange: (schema: string | null) => void;
  onForceReanalyzeChange: (checked: boolean) => void;
  onError: (msg: string) => void;
  onAddNewDatabase: () => void;
  onCancel: () => void;
  onContinue: () => void;
}

const PanelContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    max-width: 600px;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingLG}px;
  `}
`;

const IconCircle = styled.div`
  ${({ theme }) => `
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    flex-shrink: 0;
    border-radius: ${theme.borderRadius}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: ${theme.colorPrimaryBg};
  `}
`;

const FormSection = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.marginMD}px;
  `}
`;

const StyledDivider = styled(Divider)`
  ${({ theme }) => `
    margin: ${theme.marginLG}px 0;

    .ant-divider-inner-text {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const AddDatabaseButton = styled(Button)`
  ${({ theme }) => `
    width: 100%;
    margin-bottom: ${theme.marginLG}px;
  `}
`;

const FooterActionsWrapper = styled.div`
  ${({ theme }) => `
    padding-top: ${theme.paddingMD}px;
    border-top: 1px solid ${theme.colorBorder};
  `}
`;

const PanelHeader = styled(Flex)`
  ${({ theme }) => `
    margin-bottom: ${theme.marginLG}px;
  `}
`;

const TitleRow = styled(Flex)`
  ${({ theme }) => `
    margin-bottom: ${theme.marginXS}px;
    align-items: baseline;
  `}
`;

const AdvancedOptionsWrapper = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.marginMD}px;

    .ant-collapse-header {
      padding: ${theme.paddingSM}px 0 !important;
    }

    .ant-collapse-content-box {
      padding: ${theme.paddingSM}px 0 !important;
    }
  `}
`;

export default function DataSourcePanel({
  database,
  catalog,
  schema,
  isSubmitting,
  forceReanalyze,
  hasExistingReport,
  existingReportInfo,
  onDatabaseChange,
  onCatalogChange,
  onSchemaChange,
  onForceReanalyzeChange,
  onError,
  onAddNewDatabase,
  onCancel,
  onContinue,
}: DataSourcePanelProps) {
  const canContinue = database !== null && !!schema && !isSubmitting;

  return (
    <PanelContainer>
      <PanelHeader vertical align="flex-start">
        <TitleRow align="center" gap={8}>
          <Typography.Title css={{ margin: 0 }} level={5}>
            {t('Select a data source')}
          </Typography.Title>
          <IconCircle>
            <Icons.DatabaseOutlined iconSize="s" />
          </IconCircle>
        </TitleRow>
        <Typography.Text type="secondary">
          {t(
            'Choose an existing database connection or add a new one to connect your data.',
          )}
        </Typography.Text>
      </PanelHeader>

      <FormSection>
        <DatabaseSchemaPicker
          database={database}
          catalog={catalog}
          schema={schema}
          onDatabaseChange={onDatabaseChange}
          onCatalogChange={onCatalogChange}
          onSchemaChange={onSchemaChange}
          onError={onError}
        />
      </FormSection>

      {hasExistingReport && (
        <AdvancedOptionsWrapper>
          <Collapse
            ghost
            defaultActiveKey={[]}
            items={[
              {
                key: 'advanced',
                label: (
                  <Typography.Text type="secondary">
                    <Icons.SettingOutlined iconSize="s" /> {t('Advanced options')}
                  </Typography.Text>
                ),
                children: (
                  <Flex vertical gap="middle">
                    {existingReportInfo && (
                      <Flex align="center" gap="small">
                        <Icons.CheckCircleFilled
                          iconSize="s"
                          css={({ colorSuccess }) => ({ color: colorSuccess })}
                        />
                        <Typography.Text type="secondary">
                          {existingReportInfo}
                        </Typography.Text>
                      </Flex>
                    )}
                    <Checkbox
                      checked={forceReanalyze}
                      onChange={e => onForceReanalyzeChange(e.target.checked)}
                    >
                      <Flex vertical gap="small">
                        <Typography.Text>
                          {t('Force database semantic remapping')}
                        </Typography.Text>
                        <Typography.Text type="secondary" css={{ fontSize: 12 }}>
                          {t(
                            'Re-analyze the database schema even if analysis data already exists. Use this if your schema has changed.',
                          )}
                        </Typography.Text>
                      </Flex>
                    </Checkbox>
                  </Flex>
                ),
              },
            ]}
          />
        </AdvancedOptionsWrapper>
      )}

      <StyledDivider>{t('or')}</StyledDivider>

      <AddDatabaseButton
        onClick={onAddNewDatabase}
        icon={<Icons.PlusOutlined />}
        disabled={!!database}
      >
        {t('Add a new database connection')}
      </AddDatabaseButton>

      <FooterActionsWrapper>
        <Flex justify="space-between" align="center">
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button
            buttonStyle="primary"
            onClick={onContinue}
            disabled={!canContinue}
            loading={isSubmitting}
          >
            {t('Continue to Schema Review')}
          </Button>
        </Flex>
      </FooterActionsWrapper>
    </PanelContainer>
  );
}
