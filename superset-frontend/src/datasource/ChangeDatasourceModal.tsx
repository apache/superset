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
import React, { FunctionComponent, useState, useRef } from 'react';
import DataTable from '@superset-ui/plugin-chart-table/lib/DataTable';
import { Alert, FormControl, FormControlProps, Modal } from 'react-bootstrap';
import { SupersetClient, t, styled } from '@superset-ui/core';

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

const TABLE_COLUMNS = ['name', 'type', 'schema', 'connection', 'creator'];
const TABLE_FILTERABLE = ['rawName', 'type', 'schema', 'connection', 'creator'];
const CHANGE_WARNING_MSG = t(
  'Changing the datasource may break the chart if the chart relies ' +
    'on columns or metadata that does not exist in the target datasource',
);

const FullscreenModal = styled(Modal)`
  & > .modal-lg {
    height: calc(100% - 60px);
    & > .modal-content {
      height: 100%;
      display: flex;
      flex-direction: column;
      & > .modal-body {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
    }
  }
`;

const FormControlWrapper = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const DataTableWrapper = styled.div`
  flex: 1;
  & > div {
    & > div:nth-child(2) {
      & > div:first-child {
        & > table {
          margin-bottom: 0;
          th {
            border-bottom-width: 1px;
          }
        }
      }
      & > div:nth-child(2) {
        &::-webkit-scrollbar {
          -webkit-appearance: none;
          &:vertical {
            width: ${({ theme }) => theme.gridUnit * 2}px;
          }
          &:horizontal {
            height: ${({ theme }) => theme.gridUnit * 2}px;
          }
        }

        &::-webkit-scrollbar-thumb {
          border-radius: ${({ theme }) => theme.gridUnit}px;
          background-color: ${({ theme }) => theme.colors.secondary.dark2}80;
          -webkit-box-shadow: 0 0 1px
            ${({ theme }) => theme.colors.secondary.light5}80;
        }
      }
    }
  }
`;

const ChangeDatasourceModal: FunctionComponent<ChangeDatasourceModalProps> = ({
  addDangerToast,
  onChange,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const [datasources, setDatasources] = useState<any>(null);
  const [filteredDatasources, setFilteredDatasources] = useState<any>(null);
  const [filter, setFilter] = useState<any>('');
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
    const filterValue = event.currentTarget.value;
    setFilter(filterValue);
    setFilteredDatasources(
      datasources?.filter((datasource: any) =>
        TABLE_FILTERABLE.some(field =>
          datasource[field]?.includes(filterValue),
        ),
      ),
    );
  };

  return (
    <FullscreenModal
      show={show}
      onHide={onHide}
      onEnter={onEnterModal}
      bsSize="large"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('Select a datasource')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert bsStyle="warning">
          <strong>{t('Warning!')}</strong> {CHANGE_WARNING_MSG}
        </Alert>
        <FormControlWrapper>
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
        </FormControlWrapper>
        {loading && <Loading />}
        {datasources && (
          <DataTableWrapper>
            <DataTable
              tableClassName="table table-condensed"
              columns={TABLE_COLUMNS.map(column => ({
                accessor: column,
                Header: () => <th>{column}</th>,
                Cell: ({ value }) => <td>{value}</td>,
              }))}
              data={filter ? filteredDatasources : datasources}
              pageSize={20}
              searchInput={false}
              sticky
              height="100%"
            />
          </DataTableWrapper>
        )}
      </Modal.Body>
    </FullscreenModal>
  );
};

export default withToasts(ChangeDatasourceModal);
