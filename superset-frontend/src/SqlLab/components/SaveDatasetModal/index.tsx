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

import React, { FunctionComponent, useState } from 'react';
import { Radio } from 'src/components/Radio';
import { AutoComplete, RadioChangeEvent } from 'src/components';
import { Input } from 'src/components/Input';
import StyledModal from 'src/components/Modal';
import Button from 'src/components/Button';
import {
  styled,
  t,
  SupersetClient,
  makeApi,
  JsonResponse,
  JsonObject,
  QueryResponse,
} from '@superset-ui/core';
import { useSelector, useDispatch } from 'react-redux';
import moment from 'moment';
import rison from 'rison';
import { createDatasource } from 'src/SqlLab/actions/sqlLab';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { UserWithPermissionsAndRoles as User } from 'src/types/bootstrapTypes';
import {
  DatasetRadioState,
  EXPLORE_CHART_DEFAULT,
  DatasetOwner,
  DatasetOptionAutocomplete,
  SqlLabExploreRootState,
  getInitialState,
  ExploreDatasource,
} from 'src/SqlLab/types';
import { exploreChart } from 'src/explore/exploreUtils';

interface SaveDatasetModalProps {
  visible: boolean;
  onHide: () => void;
  buttonTextOnSave: string;
  buttonTextOnOverwrite: string;
  modalDescription?: string;
  datasource: ExploreDatasource;
}

const Styles = styled.div`
  .sdm-body {
    margin: 0 8px;
  }
  .sdm-input {
    margin-left: 45px;
    width: 401px;
  }
  .sdm-autocomplete {
    margin-left: 8px;
    width: 401px;
  }
  .sdm-radio {
    display: block;
    height: 30px;
    margin: 10px 0px;
    line-height: 30px;
  }
  .sdm-overwrite-msg {
    margin: 7px;
  }
`;

const updateDataset = async (
  dbId: number,
  datasetId: number,
  sql: string,
  columns: Array<Record<string, any>>,
  owners: [number],
  overrideColumns: boolean,
) => {
  const endpoint = `api/v1/dataset/${datasetId}?override_columns=${overrideColumns}`;
  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    sql,
    columns,
    owners,
    database_id: dbId,
  });

  const data: JsonResponse = await SupersetClient.put({
    endpoint,
    headers,
    body,
  });
  return data.json.result;
};

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal: FunctionComponent<SaveDatasetModalProps> = ({
  visible,
  onHide,
  buttonTextOnSave,
  buttonTextOnOverwrite,
  modalDescription,
  datasource,
}) => {
  const query = datasource as QueryResponse;
  const getDefaultDatasetName = () =>
    `${query.tab} ${moment().format('MM/DD/YYYY HH:mm:ss')}`;
  const [datasetName, setDatasetName] = useState(getDefaultDatasetName());
  const [newOrOverwrite, setNewOrOverwrite] = useState(
    DatasetRadioState.SAVE_NEW,
  );
  const [shouldOverwriteDataset, setShouldOverwriteDataset] = useState(false);
  const [userDatasetOptions, setUserDatasetOptions] = useState<
    DatasetOptionAutocomplete[]
  >([]);
  const [datasetToOverwrite, setDatasetToOverwrite] = useState<
    Record<string, any>
  >({});
  const [autocompleteValue, setAutocompleteValue] = useState('');

  const user = useSelector<SqlLabExploreRootState, User>(user =>
    getInitialState(user),
  );
  const dispatch = useDispatch<(dispatch: any) => Promise<JsonObject>>();

  const handleOverwriteDataset = async () => {
    await updateDataset(
      query.dbId,
      datasetToOverwrite.datasetId,
      query.sql,
      query.results.selected_columns.map(
        (d: { name: string; type: string; is_dttm: boolean }) => ({
          column_name: d.name,
          type: d.type,
          is_dttm: d.is_dttm,
        }),
      ),
      datasetToOverwrite.owners.map((o: DatasetOwner) => o.id),
      true,
    );

    setShouldOverwriteDataset(false);
    setDatasetToOverwrite({});
    setDatasetName(getDefaultDatasetName());

    exploreChart({
      ...EXPLORE_CHART_DEFAULT,
      datasource: `${datasetToOverwrite.datasetId}__table`,
      all_columns: query.results.selected_columns.map(
        (d: { name: string; type: string; is_dttm: boolean }) => d.name,
      ),
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

  const handleSaveInDataset = () => {
    // if user wants to overwrite a dataset we need to prompt them
    if (newOrOverwrite === DatasetRadioState.OVERWRITE_DATASET) {
      setShouldOverwriteDataset(true);
      return;
    }

    const selectedColumns = query.results.selected_columns || [];

    // The filters param is only used to test jinja templates.
    // Remove the special filters entry from the templateParams
    // before saving the dataset.
    if (query.templateParams) {
      const p = JSON.parse(query.templateParams);
      /* eslint-disable-next-line no-underscore-dangle */
      if (p._filters) {
        /* eslint-disable-next-line no-underscore-dangle */
        delete p._filters;
        // eslint-disable-next-line no-param-reassign
        query.templateParams = JSON.stringify(p);
      }
    }

    dispatch(
      createDatasource({
        schema: query.schema,
        sql: query.sql,
        dbId: query.dbId,
        templateParams: query.templateParams,
        datasourceName: datasetName,
        columns: selectedColumns,
      }),
    )
      .then((data: { table_id: number }) => {
        exploreChart({
          datasource: `${data.table_id}__table`,
          metrics: [],
          groupby: [],
          time_range: 'No filter',
          viz_type: 'table',
          all_columns: selectedColumns.map(c => c.name),
          row_limit: 1000,
        });
      })
      .catch(() => {
        addDangerToast(t('An error occurred saving dataset'));
      });

    setDatasetName(getDefaultDatasetName());
    onHide();
  };

  const handleSaveDatasetModalSearch = async (searchText: string) => {
    const userDatasetsOwned = await getUserDatasets(searchText);
    setUserDatasetOptions(userDatasetsOwned);
  };

  const handleOverwriteDatasetOption = (
    _data: string,
    option: Record<string, any>,
  ) => setDatasetToOverwrite(option);

  const handleDatasetNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    setDatasetName(e.target.value);
  };

  const handleOverwriteCancel = () => {
    setShouldOverwriteDataset(false);
    setDatasetToOverwrite({});
  };

  const disableSaveAndExploreBtn =
    (newOrOverwrite === DatasetRadioState.SAVE_NEW &&
      datasetName.length === 0) ||
    (newOrOverwrite === DatasetRadioState.OVERWRITE_DATASET &&
      Object.keys(datasetToOverwrite).length === 0 &&
      autocompleteValue.length === 0);

  const filterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetId: number },
  ) => option.value.toLowerCase().includes(inputValue.toLowerCase());

  return (
    <StyledModal
      show={visible}
      title={t('Save or Overwrite Dataset')}
      onHide={onHide}
      footer={
        <>
          {!shouldOverwriteDataset && (
            <Button
              disabled={disableSaveAndExploreBtn}
              buttonStyle="primary"
              onClick={handleSaveInDataset}
            >
              {buttonTextOnSave}
            </Button>
          )}
          {shouldOverwriteDataset && (
            <>
              <Button onClick={handleOverwriteCancel}>Back</Button>
              <Button
                className="md"
                buttonStyle="primary"
                onClick={handleOverwriteDataset}
                disabled={disableSaveAndExploreBtn}
              >
                {buttonTextOnOverwrite}
              </Button>
            </>
          )}
        </>
      }
    >
      <Styles>
        {!shouldOverwriteDataset && (
          <div className="sdm-body">
            {modalDescription && (
              <div className="sdm-prompt">{modalDescription}</div>
            )}
            <Radio.Group
              onChange={(e: RadioChangeEvent) => {
                setNewOrOverwrite(Number(e.target.value));
              }}
              value={newOrOverwrite}
            >
              <Radio className="sdm-radio" value={1}>
                {t('Save as new')}
                <Input
                  className="sdm-input"
                  defaultValue={datasetName}
                  onChange={handleDatasetNameChange}
                  disabled={newOrOverwrite !== 1}
                />
              </Radio>
              <Radio className="sdm-radio" value={2}>
                {t('Overwrite existing')}
                <AutoComplete
                  className="sdm-autocomplete"
                  options={userDatasetOptions}
                  onSelect={handleOverwriteDatasetOption}
                  onSearch={handleSaveDatasetModalSearch}
                  onChange={value => {
                    setDatasetToOverwrite({});
                    setAutocompleteValue(value);
                  }}
                  placeholder={t('Select or type dataset name')}
                  filterOption={filterAutocompleteOption}
                  disabled={newOrOverwrite !== 2}
                  value={autocompleteValue}
                />
              </Radio>
            </Radio.Group>
          </div>
        )}
        {shouldOverwriteDataset && (
          <div className="sdm-overwrite-msg">
            {t('Are you sure you want to overwrite this dataset?')}
          </div>
        )}
      </Styles>
    </StyledModal>
  );
};
