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
import { useEffect, useMemo, useRef, useState } from 'react';
import rison from 'rison';
import { useDispatch } from 'react-redux';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Button, Modal, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useEffectiveThemeId } from 'src/dashboard/components/ComponentThemeProvider';
import { previewThemeStore } from 'src/dashboard/components/ComponentThemeProvider/previewThemeStore';
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
  // the modal opens; live-previewed via the previewThemeStore as the user
  // picks options; only committed to Redux on Apply.
  const [selectedId, setSelectedId] = useState<number | null>(currentThemeId);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Snapshot the resolved id at open-time so we can revert correctly when
  // the user cancels — `currentThemeId` itself is reactive (and would
  // already reflect the in-flight preview), so we can't use it directly.
  const initialIdRef = useRef<number | null>(currentThemeId);

  useEffect(() => {
    if (show) {
      initialIdRef.current = currentThemeId;
      setSelectedId(currentThemeId);
    }
    // No `show` cleanup here — the close handlers below clear the preview
    // explicitly so we don't fight with the Apply path (which keeps the
    // theme applied).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Push the user's draft selection through the preview store. The
  // ComponentThemeProvider prefers preview > Redux, so the targeted
  // component re-renders with the candidate theme as soon as this updates.
  useEffect(() => {
    if (!show) return undefined;
    previewThemeStore.set(layoutId, selectedId);
    return () => {
      // Cleanup runs on close + on every selectedId change; the next
      // effect call re-sets it. On unmount/close we want the preview
      // gone so the provider re-resolves from Redux. Safe because Apply
      // commits to Redux *before* hiding the modal, so the post-clear
      // resolution lands on the saved value, not the original.
      previewThemeStore.clear(layoutId);
    };
  }, [show, layoutId, selectedId]);

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
