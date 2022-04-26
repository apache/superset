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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  css,
  styled,
  t,
  makeApi,
  DatasourceType,
  SupersetTheme,
} from '@superset-ui/core';
import {
  ControlConfig,
  DatasourceMeta,
  ColumnMeta,
} from '@superset-ui/chart-controls';
import { debounce } from 'lodash';
import { matchSorter, rankings } from 'match-sorter';
import Collapse from 'src/components/Collapse';
import Alert from 'src/components/Alert';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { exploreChart } from 'src/explore/exploreUtils';
import moment from 'moment';
import rison from 'rison';
import {
  DatasetRadioState,
  EXPLORE_CHART_DEFAULT,
  DatasetOwner,
  DatasetOptionAutocomplete,
  updateDataset,
} from 'src/SqlLab/components/ResultSet';
import { RadioChangeEvent } from 'src/components';
import { Input } from 'src/components/Input';
import { FAST_DEBOUNCE } from 'src/constants';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import Control from 'src/explore/components/Control';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import DatasourcePanelDragOption from './DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';
import { StyledColumnOption, StyledMetricOption } from '../optionRenderers';

interface DatasourceControl extends ControlConfig {
  datasource?: DatasourceMeta;
  user: UserWithPermissionsAndRoles;
}

export interface Props {
  datasource: DatasourceMeta;
  controls: {
    datasource: DatasourceControl;
  };
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  // we use this props control force update when this panel resize
  shouldForceUpdate?: number;
  user: {
    userId: number;
  };
}

const enableExploreDnd = isFeatureEnabled(
  FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP,
);

const Button = styled.button`
  background: none;
  border: none;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const ButtonContainer = styled.div`
  text-align: center;
  padding-top: 2px;
`;

const DatasourceContainer = styled.div`
  ${({ theme }) => css`
    background-color: ${theme.colors.grayscale.light5};
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    .ant-collapse {
      height: auto;
    }
    .field-selections {
      padding: 0 0 ${4 * theme.gridUnit}px;
      overflow: auto;
    }
    .field-length {
      margin-bottom: ${theme.gridUnit * 2}px;
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.light1};
    }
    .form-control.input-md {
      width: calc(100% - ${theme.gridUnit * 8}px);
      height: ${theme.gridUnit * 8}px;
      margin: ${theme.gridUnit * 2}px auto;
    }
    .type-label {
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.base};
    }
    .Control {
      padding-bottom: 0;
    }
  `};
`;

const LabelWrapper = styled.div`
  ${({ theme }) => css`
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${theme.typography.sizes.s}px;
    background-color: ${theme.colors.grayscale.light4};
    margin: ${theme.gridUnit * 2}px 0;
    border-radius: 4px;
    padding: 0 ${theme.gridUnit}px;

    &:first-of-type {
      margin-top: 0;
    }
    &:last-of-type {
      margin-bottom: 0;
    }

    ${enableExploreDnd &&
    css`
      padding: 0;
      cursor: pointer;
      &:hover {
        background-color: ${theme.colors.grayscale.light3};
      }
    `}

    & > span {
      white-space: nowrap;
    }

    .option-label {
      display: inline;
    }

    .metric-option {
      & > svg {
        min-width: ${theme.gridUnit * 4}px;
      }
      & > .option-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `}
`;

const SectionHeader = styled.span`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.s}px;
  `}
`;

const StyledInfoboxWrapper = styled.div`
  ${({ theme }) => css`
    margin: 0 ${theme.gridUnit * 2.5};

    span {
      text-decoration: underline;
    }
  `}
`;

const LabelContainer = (props: {
  children: React.ReactElement;
  className: string;
}) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const extendedProps = {
    labelRef,
  };
  return (
    <LabelWrapper className={props.className}>
      {React.cloneElement(props.children, extendedProps)}
    </LabelWrapper>
  );
};

export default function DataSourcePanel({
  datasource,
  controls: { datasource: datasourceControl },
  actions,
  shouldForceUpdate,
  user,
}: Props) {
  const { columns: _columns, metrics } = datasource;

  // display temporal column first
  const columns = useMemo(
    () =>
      [..._columns].sort((col1, col2) => {
        if (col1.is_dttm && !col2.is_dttm) {
          return -1;
        }
        if (col2.is_dttm && !col1.is_dttm) {
          return 1;
        }
        return 0;
      }),
    [_columns],
  );

  const placeholderSlDataset = {
    sl_table: [],
    query: [],
    saved_query: [],
  };

  // eslint-disable-next-line no-param-reassign
  datasource.sl_dataset = placeholderSlDataset;

  const getDefaultDatasetName = () =>
    `${datasource?.sl_dataset?.query.tab} ${moment().format(
      'MM/DD/YYYY HH:mm:ss',
    )}`;

  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const [newSaveDatasetName, setNewSaveDatasetName] = useState(
    getDefaultDatasetName(),
  );
  const [saveDatasetRadioBtnState, setSaveDatasetRadioBtnState] = useState(
    DatasetRadioState.SAVE_NEW,
  );
  const [shouldOverwriteDataSet, setShouldOverwriteDataSet] = useState(false);
  const [userDatasetOptions, setUserDatasetOptions] = useState<
    DatasetOptionAutocomplete[]
  >([]);
  const [datasetToOverwrite, setDatasetToOverwrite] = useState<
    Record<string, any>
  >({});
  const [saveModalAutocompleteValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [lists, setList] = useState({
    columns,
    metrics,
  });
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const DEFAULT_MAX_COLUMNS_LENGTH = 50;
  const DEFAULT_MAX_METRICS_LENGTH = 50;

  const search = useMemo(
    () =>
      debounce((value: string) => {
        if (value === '') {
          setList({ columns, metrics });
          return;
        }
        setList({
          columns: matchSorter(columns, value, {
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
                  [item.description, item.expression].map(
                    x => x?.replace(/[_\n\s]+/g, ' ') || '',
                  ),
                threshold: rankings.CONTAINS,
                maxRanking: rankings.CONTAINS,
              },
            ],
            keepDiacritics: true,
          }),
          metrics: matchSorter(metrics, value, {
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
                  [item.description, item.expression].map(
                    x => x?.replace(/[_\n\s]+/g, ' ') || '',
                  ),
                threshold: rankings.CONTAINS,
                maxRanking: rankings.CONTAINS,
              },
            ],
            keepDiacritics: true,
            baseSort: (a, b) =>
              Number(b.item.is_certified) - Number(a.item.is_certified) ||
              String(a.rankedValue).localeCompare(b.rankedValue),
          }),
        });
      }, FAST_DEBOUNCE),
    [columns, metrics],
  );

  useEffect(() => {
    setList({
      columns,
      metrics,
    });
    setInputValue('');
  }, [columns, datasource, metrics]);

  const sortCertifiedFirst = (slice: ColumnMeta[]) =>
    slice.sort((a, b) => b.is_certified - a.is_certified);

  const metricSlice = useMemo(
    () =>
      showAllMetrics
        ? lists.metrics
        : lists.metrics.slice(0, DEFAULT_MAX_METRICS_LENGTH),
    [lists.metrics, showAllMetrics],
  );

  const columnSlice = useMemo(
    () =>
      showAllColumns
        ? sortCertifiedFirst(lists.columns)
        : sortCertifiedFirst(
            lists.columns.slice(0, DEFAULT_MAX_COLUMNS_LENGTH),
          ),
    [lists.columns, showAllColumns],
  );

  const handleOverwriteDataset = async () => {
    const { sql, results, dbId } = datasource?.sl_dataset?.query;

    await updateDataset(
      dbId,
      datasetToOverwrite.datasetId,
      sql,
      // TODO: lyndsiWilliams - Define d
      results.selected_columns.map((d: any) => ({
        column_name: d.name,
        type: d.type,
        is_dttm: d.is_dttm,
      })),
      datasetToOverwrite.owners.map((o: DatasetOwner) => o.id),
      true,
    );

    setShowSaveDatasetModal(false);
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});
    setNewSaveDatasetName(getDefaultDatasetName());

    exploreChart({
      ...EXPLORE_CHART_DEFAULT,
      datasource: `${datasetToOverwrite.datasetId}__table`,
      // TODO: lyndsiWilliams -  Define d
      all_columns: results.selected_columns.map((d: any) => d.name),
    });
  };

  const getUserDatasets = async (searchText = '') => {
    // Making sure that autocomplete input has a value before rendering the dropdown
    // Transforming the userDatasetsOwned data for SaveModalComponent)
    const { userId } = user;
    if (userId) {
      const queryParams = rison.encode({
        filters: [
          {
            col: 'table_name',
            opr: 'ct',
            value: searchText,
          },
          {
            col: 'owners',
            opr: 'rel_m_m',
            value: userId,
          },
        ],
        order_column: 'changed_on_delta_humanized',
        order_direction: 'desc',
      });

      const response = await makeApi({
        method: 'GET',
        endpoint: '/api/v1/dataset',
      })(`q=${queryParams}`);

      return response.result.map(
        (r: { table_name: string; id: number; owners: [DatasetOwner] }) => ({
          value: r.table_name,
          datasetId: r.id,
          owners: r.owners,
        }),
      );
    }

    return null;
  };

  const handleSaveDatasetModalSearch = async (searchText: string) => {
    const userDatasetsOwned = await getUserDatasets(searchText);
    setUserDatasetOptions(userDatasetsOwned);
  };

  const handleSaveInDataset = () => {
    // if user wants to overwrite a dataset we need to prompt them
    if (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET) {
      setShouldOverwriteDataSet(true);
      return;
    }

    // TODO: lyndsiWilliams - set up when the back end logic is implemented
    // const { schema, sql, dbId } = datasource.sl_dataset.query;
    let { templateParams } = datasource?.sl_dataset?.query;
    // const selectedColumns =
    //   datasource.sl_dataset.query?.results?.selected_columns || [];

    // The filters param is only used to test jinja templates.
    // Remove the special filters entry from the templateParams
    // before saving the dataset.
    if (templateParams) {
      const p = JSON.parse(templateParams);
      /* eslint-disable-next-line no-underscore-dangle */
      if (p._filters) {
        /* eslint-disable-next-line no-underscore-dangle */
        delete p._filters;
        templateParams = JSON.stringify(p);
      }
    }

    // TODO: lyndsiWilliams - set up when the back end logic is implemented
    // createDatasource({
    //   schema,
    //   sql,
    //   dbId,
    //   templateParams,
    //   datasourceName: newSaveDatasetName,
    //   columns: selectedColumns,
    // });
    // .then((data: { table_id: number }) => {
    //   exploreChart({
    //     datasource: `${data.table_id}__table`,
    //     metrics: [],
    //     groupby: [],
    //     time_range: 'No filter',
    //     viz_type: 'table',
    //     all_columns: selectedColumns.map((c) => c.name),
    //     row_limit: 1000,
    //   });
    // })
    // .catch(() => {
    //   actions.addDangerToast(t('An error occurred saving dataset'));
    // });

    setShowSaveDatasetModal(false);
    setNewSaveDatasetName(getDefaultDatasetName());
  };

  const handleOverwriteDatasetOption = (
    _data: string,
    option: Record<string, any>,
  ) => setDatasetToOverwrite(option);

  const handleDatasetNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    setNewSaveDatasetName(e.target.value);
  };

  const handleHideSaveModal = () => {
    setShowSaveDatasetModal(false);
    setShouldOverwriteDataSet(false);
  };

  const handleSaveDatasetRadioBtnState = (e: RadioChangeEvent) => {
    setSaveDatasetRadioBtnState(Number(e.target.value));
  };

  const handleOverwriteCancel = () => {
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});
  };

  const disableSaveAndExploreBtn =
    (saveDatasetRadioBtnState === DatasetRadioState.SAVE_NEW &&
      newSaveDatasetName.length === 0) ||
    (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET &&
      Object.keys(datasetToOverwrite).length === 0 &&
      saveModalAutocompleteValue.length === 0);

  const handleFilterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetId: number },
  ) => option.value.toLowerCase().includes(inputValue.toLowerCase());

  const showInfoboxCheck = () => {
    if (sessionStorage.getItem('showInfobox') === 'false') return false;
    return true;
  };

  const mainBody = useMemo(
    () => (
      <>
        <Input
          allowClear
          onChange={evt => {
            setInputValue(evt.target.value);
            search(evt.target.value);
          }}
          value={inputValue}
          className="form-control input-md"
          placeholder={t('Search Metrics & Columns')}
        />
        <div className="field-selections">
          {datasource.type === DatasourceType.Table && showInfoboxCheck() && (
            <StyledInfoboxWrapper>
              <Alert
                closable
                onClose={() => sessionStorage.setItem('showInfobox', 'false')}
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
          <Collapse
            defaultActiveKey={['metrics', 'column']}
            expandIconPosition="right"
            ghost
          >
            <Collapse.Panel
              header={<SectionHeader>{t('Metrics')}</SectionHeader>}
              key="metrics"
            >
              <div className="field-length">
                {t(
                  `Showing %s of %s`,
                  metricSlice.length,
                  lists.metrics.length,
                )}
              </div>
              {metricSlice.map(m => (
                <LabelContainer
                  key={m.metric_name + String(shouldForceUpdate)}
                  className="column"
                >
                  {enableExploreDnd ? (
                    <DatasourcePanelDragOption
                      value={m}
                      type={DndItemType.Metric}
                    />
                  ) : (
                    <StyledMetricOption metric={m} showType />
                  )}
                </LabelContainer>
              ))}
              {lists.metrics.length > DEFAULT_MAX_METRICS_LENGTH ? (
                <ButtonContainer>
                  <Button onClick={() => setShowAllMetrics(!showAllMetrics)}>
                    {showAllMetrics ? t('Show less...') : t('Show all...')}
                  </Button>
                </ButtonContainer>
              ) : (
                <></>
              )}
            </Collapse.Panel>
            <Collapse.Panel
              header={<SectionHeader>{t('Columns')}</SectionHeader>}
              key="column"
            >
              <div className="field-length">
                {t(
                  `Showing %s of %s`,
                  columnSlice.length,
                  lists.columns.length,
                )}
              </div>
              {columnSlice.map(col => (
                <LabelContainer
                  key={col.column_name + String(shouldForceUpdate)}
                  className="column"
                >
                  {enableExploreDnd ? (
                    <DatasourcePanelDragOption
                      value={col}
                      type={DndItemType.Column}
                    />
                  ) : (
                    <StyledColumnOption column={col} showType />
                  )}
                </LabelContainer>
              ))}
              {lists.columns.length > DEFAULT_MAX_COLUMNS_LENGTH ? (
                <ButtonContainer>
                  <Button onClick={() => setShowAllColumns(!showAllColumns)}>
                    {showAllColumns ? t('Show Less...') : t('Show all...')}
                  </Button>
                </ButtonContainer>
              ) : (
                <></>
              )}
            </Collapse.Panel>
          </Collapse>
        </div>
      </>
    ),
    [
      columnSlice,
      inputValue,
      lists.columns.length,
      lists.metrics.length,
      metricSlice,
      search,
      showAllColumns,
      showAllMetrics,
      shouldForceUpdate,
    ],
  );

  return (
    <DatasourceContainer>
      <SaveDatasetModal
        visible={showSaveDatasetModal}
        onOk={handleSaveInDataset}
        saveDatasetRadioBtnState={saveDatasetRadioBtnState}
        shouldOverwriteDataset={shouldOverwriteDataSet}
        defaultCreateDatasetValue={newSaveDatasetName}
        userDatasetOptions={userDatasetOptions}
        disableSaveAndExploreBtn={disableSaveAndExploreBtn}
        onHide={handleHideSaveModal}
        handleDatasetNameChange={handleDatasetNameChange}
        handleSaveDatasetRadioBtnState={handleSaveDatasetRadioBtnState}
        handleOverwriteCancel={handleOverwriteCancel}
        handleOverwriteDataset={handleOverwriteDataset}
        handleOverwriteDatasetOption={handleOverwriteDatasetOption}
        handleSaveDatasetModalSearch={handleSaveDatasetModalSearch}
        filterAutocompleteOption={handleFilterAutocompleteOption}
        onChangeAutoComplete={() => setDatasetToOverwrite({})}
        buttonTextOnSave={t('Save')}
        buttonTextOnOverwrite={t('Overwrite')}
      />
      <Control {...datasourceControl} name="datasource" actions={actions} />
      {datasource.id != null && mainBody}
    </DatasourceContainer>
  );
}
