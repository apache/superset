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
import React, { FunctionComponent, useState, useRef, useMemo } from 'react';
import { Alert, FormControl, FormControlProps, Modal } from 'react-bootstrap';
import { SupersetClient, t } from '@superset-ui/core';
import TableView from 'src/components/TableView';

import getClientErrorObject from '../utils/getClientErrorObject';
import Loading from '../components/Loading';
import withToasts from '../messageToasts/enhancers/withToasts';

interface ChangeDatasourceModalProps {
  addDangerToast: (msg: string) => void;
  onChange: (id: number) => void;
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => void;
  show: boolean;
}

const TABLE_COLUMNS = [
  'name',
  'type',
  'schema',
  'connection',
  'creator',
].map(col => ({ accessor: col, Header: col }));

const TABLE_FILTERABLE = ['rawName', 'type', 'schema', 'connection', 'creator'];
const CHANGE_WARNING_MSG = t(
  'Changing the dataset may break the chart if the chart relies ' +
    'on columns or metadata that does not exist in the target dataset',
);

const ChangeDatasourceModal: FunctionComponent<ChangeDatasourceModalProps> = ({
  addDangerToast,
  onChange,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const [datasources, setDatasources] = useState<any>(null);
  const [filter, setFilter] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  let searchRef = useRef<HTMLInputElement>(null);

  const selectDatasource = (datasource: any) => {
    SupersetClient.get({
      endpoint: `/datasource/get/${datasource.type}/${datasource.id}`,
    })
      .then(({ json }) => {
        onDatasourceSave(json);
        onChange(datasource.uid);
      })
      .catch(response => {
        getClientErrorObject(response).then(
          ({ error, message }: { error: any; message: string }) => {
            const errorMessage = error
              ? error.error || error.statusText || error
              : message;
            addDangerToast(errorMessage);
          },
        );
      });
    onHide();
  };

  const onEnterModal = () => {
    if (searchRef && searchRef.current) {
      searchRef.current.focus();
    }
    if (!datasources) {
      SupersetClient.get({
        endpoint: '/superset/datasources/',
      })
        .then(({ json }) => {
          const data = json.map((ds: any) => ({
            rawName: ds.name,
            connection: ds.connection,
            schema: ds.schema,
            name: (
              <a
                href="#"
                onClick={() => selectDatasource(ds)}
                className="datasource-link"
              >
                {ds.name}
              </a>
            ),
            type: ds.type,
          }));
          setLoading(false);
          setDatasources(data);
        })
        .catch(response => {
          setLoading(false);
          getClientErrorObject(response).then(({ error }: any) => {
            addDangerToast(error.error || error.statusText || error);
          });
        });
    }
  };

  const setSearchRef = (ref: any) => {
    searchRef = ref;
  };

  const changeSearch = (
    event: React.FormEvent<FormControl & FormControlProps>,
  ) => {
    setFilter((event.currentTarget?.value as string) ?? '');
  };

  const data = useMemo(
    () =>
      filter && datasources
        ? datasources.filter((datasource: any) =>
            TABLE_FILTERABLE.some(field => datasource[field]?.includes(filter)),
          )
        : datasources,
    [datasources, filter],
  );

  return (
    <Modal show={show} onHide={onHide} onEnter={onEnterModal} bsSize="large">
      <Modal.Header closeButton>
        <Modal.Title>{t('Select a dataset')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert bsStyle="warning">
          <strong>{t('Warning!')}</strong> {CHANGE_WARNING_MSG}
        </Alert>
        <div>
          <FormControl
            inputRef={ref => {
              setSearchRef(ref);
            }}
            type="text"
            bsSize="sm"
            value={filter}
            placeholder={t('Search / Filter')}
            onChange={changeSearch}
          />
        </div>
        {loading && <Loading />}
        {datasources && (
          <TableView
            columns={TABLE_COLUMNS}
            data={data}
            pageSize={20}
            className="table-condensed"
          />
        )}
      </Modal.Body>
    </Modal>
  );
};

export default withToasts(ChangeDatasourceModal);
