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

import { useState, useCallback, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { Modal, Tag, Button, Input } from '@superset-ui/core/components';
import Slider from '@superset-ui/core/components/Slider';
import { Icons } from '@superset-ui/core/components/Icons';
import { WhatIfModification, WhatIfFilter } from 'src/dashboard/types';
import { formatPercentageChange } from 'src/dashboard/util/whatIf';
import {
  WhatIfSimulation,
  updateSimulation,
} from 'src/dashboard/components/WhatIfDrawer/whatIfApi';
import {
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_MARKS,
  SLIDER_TOOLTIP_CONFIG,
} from 'src/dashboard/components/WhatIfDrawer/constants';

interface EditSimulationModalProps {
  simulation: WhatIfSimulation | null;
  onHide: () => void;
  onSaved: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
}

const ModificationRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  background: ${({ theme }) => theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ModificationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ColumnName = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
`;

const SliderContainer = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
  & .ant-slider-mark {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
`;

const FiltersContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const FilterLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 6}px;
  color: ${({ theme }) => theme.colorTextSecondary};
`;

const AddModificationButton = styled(Button)`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const NewModificationForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  background: ${({ theme }) => theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px dashed ${({ theme }) => theme.colorBorder};
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

/**
 * Format a WhatIfFilter for display
 */
function formatFilterLabel(filter: WhatIfFilter): string {
  const { col, op, val } = filter;

  let valStr: string;
  if (Array.isArray(val)) {
    valStr = val.join(', ');
  } else if (typeof val === 'boolean') {
    valStr = val ? 'true' : 'false';
  } else {
    valStr = String(val);
  }
  // Truncate long values
  if (valStr.length > 20) {
    valStr = `${valStr.substring(0, 17)}...`;
  }
  return `${col} ${op} ${valStr}`;
}

interface EditableModification extends WhatIfModification {
  sliderValue: number; // (multiplier - 1) * 100
}

function EditSimulationModal({
  simulation,
  onHide,
  onSaved,
  addSuccessToast,
  addDangerToast,
}: EditSimulationModalProps) {
  const theme = useTheme();

  // Convert modifications to editable format with slider values
  const initialModifications = useMemo(
    () =>
      simulation?.modifications.map(mod => ({
        ...mod,
        sliderValue: (mod.multiplier - 1) * 100,
      })) ?? [],
    [simulation],
  );

  const [modifications, setModifications] =
    useState<EditableModification[]>(initialModifications);
  const [saving, setSaving] = useState(false);
  const [showNewModification, setShowNewModification] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newSliderValue, setNewSliderValue] = useState(0);

  // Reset state when simulation changes
  useMemo(() => {
    setModifications(initialModifications);
    setShowNewModification(false);
    setNewColumnName('');
    setNewSliderValue(0);
  }, [initialModifications]);

  const handleSliderChange = useCallback((index: number, value: number) => {
    setModifications(prev =>
      prev.map((mod, i) =>
        i === index
          ? { ...mod, sliderValue: value, multiplier: 1 + value / 100 }
          : mod,
      ),
    );
  }, []);

  const handleRemoveModification = useCallback((index: number) => {
    setModifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddModification = useCallback(() => {
    if (!newColumnName.trim()) return;

    const newMod: EditableModification = {
      column: newColumnName.trim(),
      multiplier: 1 + newSliderValue / 100,
      sliderValue: newSliderValue,
    };
    setModifications(prev => [...prev, newMod]);
    setShowNewModification(false);
    setNewColumnName('');
    setNewSliderValue(0);
  }, [newColumnName, newSliderValue]);

  const handleSave = useCallback(async () => {
    if (!simulation) return;

    setSaving(true);
    try {
      const updatedModifications: WhatIfModification[] = modifications.map(
        mod => ({
          column: mod.column,
          multiplier: mod.multiplier,
          filters: mod.filters,
        }),
      );

      await updateSimulation(simulation.id, {
        modifications: updatedModifications,
      });

      addSuccessToast(t('Simulation updated successfully'));
      onSaved();
      onHide();
    } catch (error) {
      addDangerToast(t('Failed to update simulation'));
    } finally {
      setSaving(false);
    }
  }, [
    simulation,
    modifications,
    onSaved,
    onHide,
    addSuccessToast,
    addDangerToast,
  ]);

  const hasChanges = useMemo(() => {
    if (!simulation) return false;
    if (modifications.length !== simulation.modifications.length) return true;

    return modifications.some((mod, i) => {
      const original = simulation.modifications[i];
      return mod.multiplier !== original.multiplier;
    });
  }, [simulation, modifications]);

  if (!simulation) return null;

  return (
    <Modal
      show
      onHide={onHide}
      title={t('Edit simulation: %s', simulation.name)}
      primaryButtonName={t('Save')}
      onHandledPrimaryAction={handleSave}
      primaryButtonLoading={saving}
      disablePrimaryButton={!hasChanges || saving}
      centered
    >
      {modifications.length === 0 && !showNewModification ? (
        <EmptyState>
          <Icons.WarningOutlined
            iconSize="xl"
            css={css`
              color: ${theme.colorWarning};
              margin-bottom: ${theme.sizeUnit * 2}px;
            `}
          />
          <div>{t('No modifications in this simulation')}</div>
        </EmptyState>
      ) : (
        modifications.map((mod, index) => (
          <ModificationRow key={`${mod.column}-${index}`}>
            <ModificationHeader>
              <ColumnName>{mod.column}</ColumnName>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${theme.sizeUnit * 2}px;
                `}
              >
                <span
                  css={css`
                    font-weight: ${theme.fontWeightStrong};
                    font-size: ${theme.fontSizeLG}px;
                    color: ${mod.multiplier >= 1
                      ? theme.colorSuccess
                      : theme.colorError};
                  `}
                >
                  {formatPercentageChange(mod.multiplier, 0)}
                </span>
                <Button
                  buttonSize="small"
                  onClick={() => handleRemoveModification(index)}
                  buttonStyle="tertiary"
                  aria-label={t('Remove modification')}
                >
                  <Icons.DeleteOutlined iconSize="s" />
                </Button>
              </div>
            </ModificationHeader>

            <SliderContainer>
              <Slider
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                value={mod.sliderValue}
                onChange={value => handleSliderChange(index, value)}
                marks={SLIDER_MARKS}
                tooltip={SLIDER_TOOLTIP_CONFIG}
              />
            </SliderContainer>

            {mod.filters && mod.filters.length > 0 && (
              <div>
                <FilterLabel>{t('Filters')}</FilterLabel>
                <FiltersContainer>
                  {mod.filters.map((filter, filterIndex) => (
                    <Tag key={`${filter.col}-${filterIndex}`}>
                      {formatFilterLabel(filter)}
                    </Tag>
                  ))}
                </FiltersContainer>
              </div>
            )}
          </ModificationRow>
        ))
      )}

      {showNewModification && (
        <NewModificationForm>
          <Input
            placeholder={t('Column name')}
            value={newColumnName}
            onChange={e => setNewColumnName(e.target.value)}
          />
          <SliderContainer>
            <Slider
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              value={newSliderValue}
              onChange={setNewSliderValue}
              marks={SLIDER_MARKS}
              tooltip={SLIDER_TOOLTIP_CONFIG}
            />
          </SliderContainer>
          <div
            css={css`
              display: flex;
              gap: ${theme.sizeUnit}px;
            `}
          >
            <Button
              buttonStyle="primary"
              buttonSize="small"
              onClick={handleAddModification}
              disabled={!newColumnName.trim() || newSliderValue === 0}
            >
              {t('Add')}
            </Button>
            <Button
              buttonSize="small"
              onClick={() => {
                setShowNewModification(false);
                setNewColumnName('');
                setNewSliderValue(0);
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </NewModificationForm>
      )}

      {!showNewModification && (
        <AddModificationButton
          buttonStyle="tertiary"
          onClick={() => setShowNewModification(true)}
        >
          <Icons.PlusOutlined iconSize="s" />
          {t('Add modification')}
        </AddModificationButton>
      )}
    </Modal>
  );
}

export default EditSimulationModal;
