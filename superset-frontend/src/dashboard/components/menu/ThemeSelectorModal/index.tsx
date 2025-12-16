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
import { useState, useEffect, useCallback, useMemo } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { Modal, Select, Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';

interface Theme {
  id: number;
  theme_name: string;
  is_system?: boolean;
  is_system_default?: boolean;
  is_system_dark?: boolean;
}

export interface ThemeSelectorModalProps {
  /** Whether the modal is visible */
  show: boolean;
  /** Callback when modal is closed */
  onHide: () => void;
  /** Callback when a theme is applied */
  onApply: (themeId: number | null) => void;
  /** Currently applied theme ID (if any) */
  currentThemeId?: number | null;
  /** Component ID for context */
  componentId: string;
  /** Component type for display */
  componentType?: string;
}

const StyledModalContent = styled.div`
  ${({ theme }) => css`
    .theme-selector-field {
      margin-bottom: ${theme.sizeUnit * 4}px;
    }

    .theme-selector-label {
      display: block;
      margin-bottom: ${theme.sizeUnit * 2}px;
      font-weight: ${theme.fontWeightMedium};
    }

    .theme-selector-help {
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      margin-top: ${theme.sizeUnit}px;
    }

    .theme-badges {
      display: inline-flex;
      gap: ${theme.sizeUnit}px;
      margin-left: ${theme.sizeUnit * 2}px;
    }

    .theme-badge {
      font-size: ${theme.fontSizeXS}px;
      padding: 0 ${theme.sizeUnit}px;
      border-radius: ${theme.borderRadiusSM}px;
      background: ${theme.colorBgLayout};
      color: ${theme.colorTextSecondary};
    }

    .theme-badge--default {
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
    }

    .theme-badge--dark {
      background: ${theme.colorBgBase};
      color: ${theme.colorTextBase};
    }
  `}
`;

/**
 * Modal for selecting a theme to apply to a dashboard component.
 *
 * This modal fetches available themes from the API and allows the user
 * to select one to apply to a specific component (Markdown, Row, Column, Tab, Chart).
 */
const ThemeSelectorModal = ({
  show,
  onHide,
  onApply,
  currentThemeId = null,
  componentId: _componentId,
  componentType = 'component',
}: ThemeSelectorModalProps) => {
  const theme = useTheme();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(
    currentThemeId,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch themes from API
  const fetchThemes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/theme/',
      });
      const themeList = response.json?.result || [];
      setThemes(themeList);
    } catch {
      setError(t('Failed to load themes'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch themes when modal opens
  useEffect(() => {
    if (show) {
      fetchThemes();
      setSelectedThemeId(currentThemeId);
    }
  }, [show, currentThemeId, fetchThemes]);

  // Build select options with badges
  const themeOptions = useMemo(
    () =>
      themes.map(theme => ({
        value: theme.id,
        label: (
          <span>
            {theme.theme_name}
            {(theme.is_system_default || theme.is_system_dark) && (
              <span className="theme-badges">
                {theme.is_system_default && (
                  <span className="theme-badge theme-badge--default">
                    {t('Default')}
                  </span>
                )}
                {theme.is_system_dark && (
                  <span className="theme-badge theme-badge--dark">
                    {t('Dark')}
                  </span>
                )}
              </span>
            )}
          </span>
        ),
      })),
    [themes],
  );

  const handleApply = useCallback(() => {
    onApply(selectedThemeId);
    onHide();
  }, [selectedThemeId, onApply, onHide]);

  const handleClear = useCallback(() => {
    setSelectedThemeId(null);
  }, []);

  const selectedTheme = useMemo(
    () => themes.find(t => t.id === selectedThemeId),
    [themes, selectedThemeId],
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={
        <Typography.Title level={4} data-test="theme-selector-modal-title">
          <Icons.BgColorsOutlined
            css={css`
              margin-right: 8px;
            `}
          />
          {t('Apply Theme')}
        </Typography.Title>
      }
      footer={[
        <Button key="cancel" onClick={onHide} buttonStyle="secondary">
          {t('Cancel')}
        </Button>,
        <Button
          key="apply"
          onClick={handleApply}
          buttonStyle="primary"
          disabled={isLoading}
        >
          {selectedThemeId ? t('Apply') : t('Clear Theme')}
        </Button>,
      ]}
      width={500}
      centered
    >
      <StyledModalContent>
        <div className="theme-selector-field">
          <label className="theme-selector-label" htmlFor="theme-select">
            {t('Select a theme for this %s', componentType)}
          </label>
          <Select
            id="theme-select"
            data-test="theme-selector-select"
            value={selectedThemeId}
            onChange={(value: number | null) => setSelectedThemeId(value)}
            options={themeOptions}
            placeholder={t('Select a theme...')}
            allowClear
            onClear={handleClear}
            loading={isLoading}
            disabled={isLoading}
            style={{ width: '100%' }}
            notFoundContent={
              error ? (
                <span style={{ color: theme.colorError }}>{error}</span>
              ) : (
                t('No themes available')
              )
            }
          />
          <div className="theme-selector-help">
            {selectedTheme
              ? t('Selected: %s', selectedTheme.theme_name)
              : currentThemeId
                ? t('Clear selection to remove the current theme')
                : t('Select a theme to apply custom styling to this component')}
          </div>
        </div>
      </StyledModalContent>
    </Modal>
  );
};

export default ThemeSelectorModal;
