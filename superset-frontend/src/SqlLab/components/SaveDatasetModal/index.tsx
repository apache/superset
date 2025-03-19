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

import { useCallback, useState, FormEvent } from 'react';

import { Radio } from 'src/components/Radio';
import { RadioChangeEvent, AsyncSelect } from 'src/components';
import { Input } from 'src/components/Input';
import StyledModal from 'src/components/Modal';
import Button from 'src/components/Button';
import {
  styled,
  t,
  SupersetClient,
  JsonResponse,
  JsonObject,
  QueryResponse,
  QueryFormData,
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
  SqlLabRootState,
} from 'src/SqlLab/types';
import { mountExploreUrl } from 'src/explore/exploreUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { URL_PARAMS } from 'src/constants';
import { SelectValue } from 'antd/lib/select';
import { isEmpty, isString } from 'lodash';

interface QueryDatabase {
  id?: number;
}

export type ExploreQuery = QueryResponse & {
  database?: QueryDatabase | null | undefined;
};

export interface ISimpleColumn {
  column_name?: string | null;
  name?: string | null;
  type?: string | null;
  is_dttm?: boolean | null;
}

export type Database = {
  backend: string;
  id: number;
  parameter: object;
};

export interface ISaveableDatasource {
  columns: ISimpleColumn[];
  name: string;
  dbId: number;
  sql: string;
  templateParams?: string | object | null;
  catalog?: string | null;
  schema?: string | null;
  database?: Database;
}

interface SaveDatasetModalProps {
  visible: boolean;
  onHide: () => void;
  buttonTextOnSave: string;
  buttonTextOnOverwrite: string;
  modalDescription?: string;
  datasource: ISaveableDatasource;
  openWindow?: boolean;
  formData?: Omit<QueryFormData, 'datasource'>;
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
    width: 401px;
    align-self: center;
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
  .sdm-overwrite-container {
    flex: 1 1 auto;
    display: flex;
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

const UNTITLED = t('Untitled Dataset');

export const SaveDatasetModal = ({
  visible,
  onHide,
  buttonTextOnSave,
  buttonTextOnOverwrite,
  modalDescription,
  datasource,
  openWindow = true,
  formData = {},
}: SaveDatasetModalProps) => {
  const defaultVizType = useSelector<SqlLabRootState, string>(
    state => state.common?.conf?.DEFAULT_VIZ_TYPE || 'table',
  );

  const getDefaultDatasetName = () =>
    `${datasource?.name || UNTITLED} ${moment().format('L HH:mm:ss')}`;
  const [datasetName, setDatasetName] = useState(getDefaultDatasetName());
  const [newOrOverwrite, setNewOrOverwrite] = useState(
    DatasetRadioState.SaveNew,
  );
  const [shouldOverwriteDataset, setShouldOverwriteDataset] = useState(false);
  const [datasetToOverwrite, setDatasetToOverwrite] = useState<
    Record<string, any>
  >({});
  const [selectedDatasetToOverwrite, setSelectedDatasetToOverwrite] = useState<
    SelectValue | undefined
  >(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const user = useSelector<SqlLabRootState, User>(state => state.user);
  const dispatch = useDispatch<(dispatch: any) => Promise<JsonObject>>();

  const createWindow = (url: string) => {
    if (openWindow) {
      window.open(url, '_blank', 'noreferrer');
    } else {
      window.location.href = url;
    }
  };
  const formDataWithDefaults = {
    ...EXPLORE_CHART_DEFAULT,
    ...(formData || {}),
  };
  const handleOverwriteDataset = async () => {
    // if user wants to overwrite a dataset we need to prompt them
    if (!shouldOverwriteDataset) {
      setShouldOverwriteDataset(true);
      return;
    }
    setLoading(true);

    const [, key] = await Promise.all([
      updateDataset(
        datasource?.dbId,
        datasetToOverwrite?.datasetid,
        datasource?.sql,
        datasource?.columns?.map(
          (d: { column_name: string; type: string; is_dttm: boolean }) => ({
            column_name: d.column_name,
            type: d.type,
            is_dttm: d.is_dttm,
          }),
        ),
        datasetToOverwrite?.owners?.map((o: DatasetOwner) => o.id),
        true,
      ),
      postFormData(datasetToOverwrite.datasetid, 'table', {
        ...formDataWithDefaults,
        datasource: `${datasetToOverwrite.datasetid}__table`,
        ...(defaultVizType === 'table' && {
          all_columns: datasource?.columns?.map(column => column.column_name),
        }),
      }),
    ]);
    setLoading(false);

    const url = mountExploreUrl(null, {
      [URL_PARAMS.formDataKey.name]: key,
    });
    createWindow(url);

    setShouldOverwriteDataset(false);
    setDatasetName(getDefaultDatasetName());
    onHide();
  };

  const loadDatasetOverwriteOptions = useCallback(
    async (input = '') => {
      const { userId } = user;
      const queryParams = rison.encode({
        filters: [
          {
            col: 'table_name',
            opr: 'ct',
            value: input,
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

      return SupersetClient.get({
        endpoint: `/api/v1/dataset/?q=${queryParams}`,
      }).then(response => ({
        data: response.json.result.map(
          (r: { table_name: string; id: number; owners: [DatasetOwner] }) => ({
            value: r.table_name,
            label: r.table_name,
            datasetid: r.id,
            owners: r.owners,
          }),
        ),
        totalCount: response.json.count,
      }));
    },
    [user],
  );

  const handleSaveInDataset = () => {
    setLoading(true);
    const selectedColumns = datasource?.columns ?? [];

    // The filters param is only used to test jinja templates.
    // Remove the special filters entry from the templateParams
    // before saving the dataset.
    let templateParams;
    if (isString(datasource?.templateParams)) {
      const p = JSON.parse(datasource.templateParams);
      /* eslint-disable-next-line no-underscore-dangle */
      if (p._filters) {
        /* eslint-disable-next-line no-underscore-dangle */
        delete p._filters;
        // eslint-disable-next-line no-param-reassign
        templateParams = JSON.stringify(p);
      }
    }

    dispatch(
      createDatasource({
        sql: datasource.sql,
        dbId: datasource.dbId || datasource?.database?.id,
        catalog: datasource?.catalog,
        schema: datasource?.schema,
        templateParams,
        datasourceName: datasetName,
      }),
    )
      .then((data: { id: number }) =>
        postFormData(data.id, 'table', {
          ...formDataWithDefaults,
          datasource: `${data.id}__table`,
          ...(defaultVizType === 'table' && {
            all_columns: selectedColumns.map(column => column.column_name),
          }),
        }),
      )
      .then((key: string) => {
        setLoading(false);
        const url = mountExploreUrl(null, {
          [URL_PARAMS.formDataKey.name]: key,
        });
        createWindow(url);
        setDatasetName(getDefaultDatasetName());
        onHide();
      })
      .catch(() => {
        setLoading(false);
        addDangerToast(t('An error occurred saving dataset'));
      });
  };

  const handleOverwriteDatasetOption = (value: SelectValue, option: any) => {
    setDatasetToOverwrite(option);
    setSelectedDatasetToOverwrite(value);
  };

  const handleDatasetNameChange = (e: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    setDatasetName(e.target.value);
  };

  const handleOverwriteCancel = () => {
    setShouldOverwriteDataset(false);
    setDatasetToOverwrite({});
  };

  const disableSaveAndExploreBtn =
    (newOrOverwrite === DatasetRadioState.SaveNew &&
      datasetName.length === 0) ||
    (newOrOverwrite === DatasetRadioState.OverwriteDataset &&
      isEmpty(selectedDatasetToOverwrite));

  const filterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetid: number },
  ) => option.value.toLowerCase().includes(inputValue.toLowerCase());

  return (
    <StyledModal
      show={visible}
      title={t('Save or Overwrite Dataset')}
      onHide={onHide}
      footer={
        <>
          {newOrOverwrite === DatasetRadioState.SaveNew && (
            <Button
              disabled={disableSaveAndExploreBtn}
              buttonStyle="primary"
              onClick={handleSaveInDataset}
              loading={loading}
            >
              {buttonTextOnSave}
            </Button>
          )}
          {newOrOverwrite === DatasetRadioState.OverwriteDataset && (
            <>
              {shouldOverwriteDataset && (
                <Button onClick={handleOverwriteCancel}>{t('Back')}</Button>
              )}
              <Button
                className="md"
                buttonStyle="primary"
                onClick={handleOverwriteDataset}
                disabled={disableSaveAndExploreBtn}
                loading={loading}
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
                  value={datasetName}
                  onChange={handleDatasetNameChange}
                  disabled={newOrOverwrite !== 1}
                />
              </Radio>
              <div className="sdm-overwrite-container">
                <Radio className="sdm-radio" value={2}>
                  {t('Overwrite existing')}
                </Radio>
                <div className="sdm-autocomplete">
                  <AsyncSelect
                    allowClear
                    showSearch
                    placeholder={t('Select or type dataset name')}
                    ariaLabel={t('Existing dataset')}
                    onChange={handleOverwriteDatasetOption}
                    options={input => loadDatasetOverwriteOptions(input)}
                    value={selectedDatasetToOverwrite}
                    filterOption={filterAutocompleteOption}
                    disabled={newOrOverwrite !== 2}
                    getPopupContainer={() => document.body}
                  />
                </div>
              </div>
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
