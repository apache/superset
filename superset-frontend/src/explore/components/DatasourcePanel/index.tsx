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
import { useContext, useMemo, useState } from 'react';
import {
  css,
  DatasourceType,
  Metric,
  QueryFormData,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';

import { ControlConfig } from '@superset-ui/chart-controls';
import AutoSizer from 'react-virtualized-auto-sizer';

import { matchSorter, rankings } from 'match-sorter';
import { Alert, Constants, Input } from '@superset-ui/core/components';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import Control from 'src/explore/components/Control';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { DndItemType } from '../DndItemType';
import { DatasourceFolder, DatasourcePanelColumn, DndItemValue } from './types';
import { DropzoneContext } from '../ExploreContainer';
import { DatasourceItems } from './DatasourceItems';
import { transformDatasourceWithFolders } from './transformDatasourceFolders';

interface DatasourceControl extends Omit<ControlConfig, 'hidden'> {
  datasource?: IDatasource;
}
export interface IDatasource {
  metrics: Metric[];
  columns: DatasourcePanelColumn[];
  folders?: DatasourceFolder[];
  id: number;
  type: DatasourceType;
  database: {
    id: number;
  };
  sql?: string | null;
  datasource_name?: string | null;
  name?: string | null;
  schema?: string | null;
}

export interface Props {
  datasource: IDatasource;
  controls: {
    datasource: DatasourceControl;
  };
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  // we use this props control force update when this panel resize
  width: number;
  formData?: QueryFormData;
}

const DatasourceContainer = styled.div`
  ${({ theme }) => css`
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    .field-selections {
      padding: 0 0 ${theme.sizeUnit}px;
      overflow: auto;
      height: 100%;
    }
    .field-length {
      margin-bottom: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
    .form-control.input-md {
      display: inline-flex;
      width: calc(100% - ${theme.sizeUnit * 8}px);
      height: ${theme.sizeUnit * 8}px;
      margin: ${theme.sizeUnit * 2}px auto;
    }
    .type-label {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
    .Control {
      padding-bottom: 0;
    }
  `};
`;

const StyledInfoboxWrapper = styled.div`
  ${({ theme }) => css`
    margin: 0 ${theme.sizeUnit * 2.5}px;

    span {
      text-decoration: underline;
    }
  `}
`;

const BORDER_WIDTH = 2;

const sortColumns = (slice: DatasourcePanelColumn[]) =>
  [...slice]
    .sort((col1, col2) => {
      if (col1?.is_dttm && !col2?.is_dttm) {
        return -1;
      }
      if (col2?.is_dttm && !col1?.is_dttm) {
        return 1;
      }
      return 0;
    })
    .sort((a, b) => (b?.is_certified ?? 0) - (a?.is_certified ?? 0));

export default function DataSourcePanel({
  datasource,
  formData,
  controls: { datasource: datasourceControl },
  actions,
  width,
}: Props) {
  const [dropzones] = useContext(DropzoneContext);
  const { columns: _columns, metrics, folders: _folders } = datasource;

  const allowedColumns = useMemo(() => {
    const validators = Object.values(dropzones);
    if (!Array.isArray(_columns)) return [];
    return _columns.filter(column =>
      validators.some(validator =>
        validator({
          value: column as DndItemValue,
          type: DndItemType.Column,
        }),
      ),
    );
  }, [dropzones, _columns]);

  const allowedMetrics = useMemo(() => {
    const validators = Object.values(dropzones);
    return metrics.filter(metric =>
      validators.some(validator =>
        validator({ value: metric, type: DndItemType.Metric }),
      ),
    );
  }, [dropzones, metrics]);

  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const searchKeyword = useDebounceValue(inputValue, Constants.FAST_DEBOUNCE);

  const filteredColumns = useMemo(() => {
    if (!searchKeyword) {
      return allowedColumns ?? [];
    }
    return matchSorter(allowedColumns, searchKeyword, {
      keys: [
        {
          key: 'verbose_name',
          threshold: rankings.CONTAINS,
        },
        {
          key: 'column_name',
          threshold: rankings.CONTAINS,
        },
        {
          key: item =>
            [item?.description ?? '', item?.expression ?? ''].map(
              x => x?.replace(/[_\n\s]+/g, ' ') || '',
            ),
          threshold: rankings.CONTAINS,
          maxRanking: rankings.CONTAINS,
        },
      ],
      keepDiacritics: true,
    });
  }, [allowedColumns, searchKeyword]);

  const filteredMetrics = useMemo(() => {
    if (!searchKeyword) {
      return allowedMetrics ?? [];
    }
    return matchSorter(allowedMetrics, searchKeyword, {
      keys: [
        {
          key: 'verbose_name',
          threshold: rankings.CONTAINS,
        },
        {
          key: 'metric_name',
          threshold: rankings.CONTAINS,
        },
        {
          key: item =>
            [item?.description ?? '', item?.expression ?? ''].map(
              x => x?.replace(/[_\n\s]+/g, ' ') || '',
            ),
          threshold: rankings.CONTAINS,
          maxRanking: rankings.CONTAINS,
        },
      ],
      keepDiacritics: true,
      baseSort: (a, b) =>
        Number(b?.item?.is_certified ?? 0) -
          Number(a?.item?.is_certified ?? 0) ||
        String(a?.rankedValue ?? '').localeCompare(b?.rankedValue ?? ''),
    });
  }, [allowedMetrics, searchKeyword]);

  const sortedColumns = useMemo(
    () => sortColumns(filteredColumns),
    [filteredColumns],
  );

  const folders = useMemo(
    () =>
      transformDatasourceWithFolders(
        filteredMetrics,
        sortedColumns,
        _folders,
        allowedMetrics,
        allowedColumns,
      ),
    [_folders, filteredMetrics, sortedColumns],
  );

  const showInfoboxCheck = () => {
    try {
      if (sessionStorage.getItem('showInfobox') === 'false') return false;
    } catch (error) {
      // continue regardless of error
    }
    return true;
  };

  const saveableDatasets = {
    query: DatasourceType.Query,
    saved_query: DatasourceType.SavedQuery,
  };

  const datasourceIsSaveable =
    datasource.type &&
    saveableDatasets[datasource.type as keyof typeof saveableDatasets];

  const theme = useTheme();
  const mainBody = useMemo(
    () => (
      <>
        <div style={{ padding: theme.sizeUnit * 4 }}>
          <Input
            allowClear
            onChange={evt => {
              setInputValue(evt.target.value);
            }}
            value={inputValue}
            placeholder={t('Search Metrics & Columns')}
          />
        </div>
        <div className="field-selections" data-test="fieldSelections">
          {datasourceIsSaveable && showInfoboxCheck() && (
            <StyledInfoboxWrapper>
              <Alert
                closable
                onClose={() => {
                  try {
                    sessionStorage.setItem('showInfobox', 'false');
                  } catch (error) {
                    // continue regardless of error
                  }
                }}
                type="info"
                message=""
                description={
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setShowSaveDatasetModal(true)}
                      className="add-dataset-alert-description"
                    >
                      {t('Create a dataset')}
                    </span>
                    {t(' to edit or add columns and metrics.')}
                  </>
                }
              />
            </StyledInfoboxWrapper>
          )}
          <AutoSizer>
            {({ height }: { height: number }) => (
              <DatasourceItems
                width={width - BORDER_WIDTH}
                height={height}
                folders={folders}
              />
            )}
          </AutoSizer>
        </div>
      </>
    ),
    [inputValue, datasourceIsSaveable, width, folders],
  );

  return (
    <DatasourceContainer>
      {datasourceIsSaveable && showSaveDatasetModal && (
        <SaveDatasetModal
          visible={showSaveDatasetModal}
          onHide={() => setShowSaveDatasetModal(false)}
          buttonTextOnSave={t('Save')}
          buttonTextOnOverwrite={t('Overwrite')}
          datasource={getDatasourceAsSaveableDataset(datasource)}
          openWindow={false}
          formData={formData}
        />
      )}
      {/* @ts-ignore */}
      <Control {...datasourceControl} name="datasource" actions={actions} />
      {datasource.id != null && mainBody}
    </DatasourceContainer>
  );
}
