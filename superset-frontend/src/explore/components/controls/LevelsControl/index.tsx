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
import { ReactNode, useEffect } from 'react';
import { isEqual } from 'lodash-es';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core/translation';
import { useTheme, type SupersetTheme } from '@apache-superset/core/theme';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { List, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type {
  TreeLevel,
  TreeMirrors,
} from '@superset-ui/plugin-chart-ag-grid-table';
import type { ControlProps } from 'src/explore/components/Control';
import ControlHeader from 'src/explore/components/ControlHeader';
import CustomListItem from 'src/explore/components/controls/CustomListItem';
import {
  HeaderContainer,
  AddIconButton,
} from 'src/explore/components/controls/OptionControls';
import LevelItem from './LevelItem';

export interface LevelsControlProps {
  name: string;
  label?: ReactNode;
  description?: ReactNode;
  validationErrors?: string[];
  hovered?: boolean;
  value?: TreeLevel[] | null;
  initialLevels?: TreeLevel[];
  onChange?: (value: TreeLevel[]) => void;
  actions: ControlProps['actions'];
  mirrorsOf: (levels: TreeLevel[]) => TreeMirrors;
  datasourceColumns?: string[];
  columnOptions?: ColumnMeta[];
  temporalOptions?: ColumnMeta[];
  formMirrors?: Partial<TreeMirrors>;
}

function withoutKeys(level: TreeLevel, keys: (keyof TreeLevel)[]): TreeLevel {
  const next: Partial<TreeLevel> = { ...level };
  keys.forEach(key => {
    delete next[key];
  });
  return next as TreeLevel;
}

function keepSortInLevel(level: TreeLevel): TreeLevel {
  if (
    level.sort &&
    ![level.id_column, ...(level.columns ?? [])].includes(level.sort[0])
  ) {
    return withoutKeys(level, ['sort']);
  }
  return level;
}

export default function LevelsControl({
  value,
  onChange,
  actions,
  mirrorsOf,
  columnOptions = [],
  temporalOptions = [],
  formMirrors,
  initialLevels,
  ...headerProps
}: LevelsControlProps) {
  const theme = useTheme();
  const levels = value ?? [];

  const update = (next: TreeLevel[]) => {
    onChange?.(next);
    Object.entries(mirrorsOf(next)).forEach(([key, mirror]) =>
      actions.setControlValue(key, mirror),
    );
  };

  useEffect(() => {
    if (value == null && initialLevels) {
      update(initialLevels);
      return;
    }
    const mirrors = mirrorsOf(levels);
    const current = {
      tree_columns: formMirrors?.tree_columns,
      tree_metrics: formMirrors?.tree_metrics,
      tree_orderby: formMirrors?.tree_orderby,
    };
    if (!isEqual(current, mirrors)) {
      Object.entries(mirrors).forEach(([key, mirror]) =>
        actions.setControlValue(key, mirror),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAdd = () => {
    const level: TreeLevel = {
      key: nanoid(11),
      name: '',
      id_column: '',
      columns: [],
      detail_fields: [],
      ...(levels.length > 0 && {
        children_shown: 100,
        apply_date_filter: false,
      }),
    };
    update([...levels, level]);
  };

  const onRemove = (index: number) => {
    const next = levels.filter((_, i) => i !== index);
    if (index === 0 && next[0]) {
      next[0] = withoutKeys(next[0], [
        'parent_column',
        'children_shown',
        'apply_date_filter',
      ]);
    } else if (next[index]) {
      next[index] = withoutKeys(next[index], ['parent_column']);
    }
    update(next);
  };

  const onLevelChange = (index: number, level: TreeLevel) => {
    const next = [...levels];
    next[index] = keepSortInLevel(level);
    update(next);
  };

  return (
    <div data-test="LevelsControl" className="LevelsControl">
      <HeaderContainer>
        <ControlHeader {...headerProps} />
        <Tooltip title={t('Add level')}>
          <AddIconButton aria-label={t('Add level')} onClick={onAdd}>
            <Icons.PlusOutlined
              iconSize="s"
              iconColor={theme.colorTextLightSolid}
            />
          </AddIconButton>
        </Tooltip>
      </HeaderContainer>
      {levels.length > 0 && (
        <List
          bordered
          css={(theme: SupersetTheme) => ({
            borderRadius: theme.borderRadius,
          })}
        >
          {levels.map((level, index) => (
            <CustomListItem
              selectable={false}
              className="clearfix"
              css={(theme: SupersetTheme) => ({
                alignItems: 'center',
                justifyContent: 'flex-start',
                display: 'flex',
                paddingInline: theme.sizeUnit * 6,
              })}
              key={level.key}
            >
              <div
                css={(theme: SupersetTheme) => ({
                  flex: 1,
                  marginLeft: theme.sizeUnit * 2,
                  marginRight: theme.sizeUnit * 2,
                })}
              >
                <LevelItem
                  level={level}
                  index={index}
                  parent={levels[index - 1]}
                  columnOptions={columnOptions}
                  temporalOptions={temporalOptions}
                  actions={actions}
                  onChange={next => onLevelChange(index, next)}
                  onRemove={() => onRemove(index)}
                />
              </div>
            </CustomListItem>
          ))}
        </List>
      )}
    </div>
  );
}
