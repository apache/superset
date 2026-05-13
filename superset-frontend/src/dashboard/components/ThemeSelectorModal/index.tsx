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
import { useEffect, useMemo, useState } from 'react';
import rison from 'rison';
import { useDispatch } from 'react-redux';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Button, Modal, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useEffectiveThemeId } from 'src/dashboard/components/ComponentThemeProvider';
import { setComponentThemeId } from 'src/dashboard/actions/setComponentThemeId';

interface ThemeOption {
  id: number;
  theme_name: string;
}

interface ThemeSelectorModalProps {
  /** The layout component receiving the theme override. */
  layoutId: string;
  /** Controls visibility. Parent owns this — toggled via menu click. */
  show: boolean;
  onHide: () => void;
}

/**
 * Modal for picking a CRUD theme to apply to a single dashboard component
 * (or clearing the existing override). On save, dispatches
 * `setComponentThemeId`, which updates `component.meta.themeId` and marks
 * the dashboard dirty. The actual visual application is handled by
 * `ComponentThemeProvider`, which reads the meta change via its Redux
 * selector and re-renders the component with the new theme tokens.
 */
export default function ThemeSelectorModal({
  layoutId,
  show,
  onHide,
}: ThemeSelectorModalProps) {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const currentThemeId = useEffectiveThemeId(layoutId);

  // Modal-local draft of the selection. Synced from the resolved id when
  // the modal opens; only committed to Redux on save.
  const [selectedId, setSelectedId] = useState<number | null>(currentThemeId);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep the draft in sync if the resolved id changes while the modal is
  // open (e.g. another tab updated the dashboard). Cheap because the
  // selector returns a primitive.
  useEffect(() => {
    if (show) setSelectedId(currentThemeId);
  }, [show, currentThemeId]);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    // Same query the dashboard-properties modal uses — non-system themes only.
    const q = rison.encode({
      columns: ['id', 'theme_name'],
      filters: [{ col: 'is_system', opr: 'eq', value: false }],
    });
    SupersetClient.get({ endpoint: `/api/v1/theme/?q=${q}` })
      .then(({ json }) => {
        setThemes((json.result as ThemeOption[]) ?? []);
      })
      .catch(() => {
        addDangerToast(t('An error occurred while fetching available themes'));
      })
      .finally(() => setLoading(false));
  }, [show, addDangerToast]);

  const options = useMemo(
    () => themes.map(t => ({ value: t.id, label: t.theme_name })),
    [themes],
  );

  const handleSave = () => {
    dispatch(setComponentThemeId(layoutId, selectedId));
    onHide();
  };

  const handleClear = () => {
    // Clearing the override means "inherit from parent" — store explicit
    // null so the resolver knows it was intentional (vs absent / never set).
    dispatch(setComponentThemeId(layoutId, null));
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Apply theme')}
      footer={
        <>
          {currentThemeId !== null && (
            <Button
              data-test="component-theme-clear"
              buttonStyle="secondary"
              onClick={handleClear}
            >
              {t('Clear override (inherit)')}
            </Button>
          )}
          <Button data-test="component-theme-cancel" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button
            data-test="component-theme-apply"
            buttonStyle="primary"
            onClick={handleSave}
            disabled={selectedId === null}
          >
            {t('Apply')}
          </Button>
        </>
      }
    >
      <Select
        ariaLabel={t('Theme')}
        loading={loading}
        options={options}
        value={selectedId ?? undefined}
        onChange={value => setSelectedId(value as number)}
        placeholder={t('Select a theme')}
        allowClear
        onClear={() => setSelectedId(null)}
      />
    </Modal>
  );
}
