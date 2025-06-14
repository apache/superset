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
import {
  FunctionComponent,
  useState,
  useRef,
  useEffect,
  useCallback,
  ChangeEvent,
} from 'react';

import Alert from 'src/components/Alert';
import {
  SupersetClient,
  t,
  styled,
  getClientErrorObject,
} from '@superset-ui/core';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { ServerPagination, SortByType } from 'src/components/TableView/types';
import StyledModal from 'src/components/Modal';
import Button from 'src/components/Button';
import { useListViewResource } from 'src/views/CRUD/hooks';
import Dataset from 'src/types/Dataset';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { SLOW_DEBOUNCE } from 'src/constants';
import Loading from 'src/components/Loading';
import { Input } from 'src/components/Input';
import {
  PAGE_SIZE as DATASET_PAGE_SIZE,
  SORT_BY as DATASET_SORT_BY,
} from 'src/features/datasets/constants';
import withToasts from 'src/components/MessageToasts/withToasts';
import { InputRef } from 'antd-v5';
import FacePile from '../FacePile';

const CONFIRM_WARNING_MESSAGE = t(
  'Warning! Changing the dataset may break the chart if the metadata does not exist.',
);

const CHANGE_WARNING_MSG = t(
  'Changing the dataset may break the chart if the chart relies ' +
    'on columns or metadata that does not exist in the target dataset',
);

interface Datasource {
  type: string;
  id: number;
  uid: string;
}

interface ChangeDatasourceModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onChange: (uid: string) => void;
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => void;
  show: boolean;
}

const CustomStyledModal = styled(StyledModal)`
  .antd5-modal-body {
    display: flex;
    flex-direction: column;
  }
`;

const ConfirmModalStyled = styled.div`
  .btn-container {
    display: flex;
    justify-content: flex-end;
    padding: 0px 15px;
    margin: 10px 0 0 0;
  }

  .confirm-modal-container {
    margin: 9px;
  }
`;

const StyledSpan = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

const ChangeDatasourceModal: FunctionComponent<ChangeDatasourceModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onChange,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const [filter, setFilter] = useState<any>(undefined);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortByType>(DATASET_SORT_BY);
  const [confirmChange, setConfirmChange] = useState(false);
  const [confirmedDataset, setConfirmedDataset] = useState<Datasource>();
  const searchRef = useRef<InputRef>(null);

  const {
    state: { loading, resourceCollection, resourceCount },
    fetchData,
  } = useListViewResource<Dataset>('dataset', t('dataset'), addDangerToast);

  const selectDatasource = useCallback((datasource: Datasource) => {
    setConfirmChange(true);
    setConfirmedDataset(datasource);
  }, []);

  const fetchDatasetPayload = {
    pageIndex,
    pageSize: DATASET_PAGE_SIZE,
    filters: [],
    sortBy,
  };

  useDebouncedEffect(
    () => {
      fetchData({
        ...fetchDatasetPayload,
        ...(filter && {
          filters: [
            {
              id: 'table_name',
              operator: 'ct',
              value: filter,
            },
          ],
        }),
      });
    },
    SLOW_DEBOUNCE,
    [filter, pageIndex, sortBy],
  );

  useEffect(() => {
    const onEnterModal = async () => {
      setTimeout(() => searchRef?.current?.focus(), 200);
    };

    if (show) {
      onEnterModal();
    }
  }, [
    addDangerToast,
    fetchData,
    onChange,
    onDatasourceSave,
    onHide,
    selectDatasource,
    show,
  ]);

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const searchValue = event.target.value ?? '';
    setFilter(searchValue);
    setPageIndex(0);
  };

  const handleChangeConfirm = () => {
    SupersetClient.get({
      endpoint: `/api/v1/dataset/${confirmedDataset?.id}`,
    })
      .then(({ json }) => {
        // eslint-disable-next-line no-param-reassign
        json.result.type = 'table';
        onDatasourceSave(json.result);
        onChange(`${confirmedDataset?.id}__table`);
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
    addSuccessToast(t('Successfully changed dataset!'));
  };

  const handlerCancelConfirm = () => {
    setConfirmChange(false);
  };

  const columns = [
    {
      Cell: ({ row: { original } }: any) => (
        <StyledSpan
          role="button"
          tabIndex={0}
          data-test="datasource-link"
          onClick={() => selectDatasource({ type: 'table', ...original })}
        >
          {original?.table_name}
        </StyledSpan>
      ),
      Header: t('Name'),
      accessor: 'table_name',
    },
    {
      Header: t('Type'),
      accessor: 'kind',
      disableSortBy: true,
    },
    {
      Header: t('Schema'),
      accessor: 'schema',
    },
    {
      Header: t('Connection'),
      accessor: 'database.database_name',
      disableSortBy: true,
    },
    {
      Cell: ({
        row: {
          original: { owners = [] },
        },
      }: any) => <FacePile users={owners} />,
      Header: t('Owners'),
      id: 'owners',
      disableSortBy: true,
    },
  ];

  const onServerPagination = (args: ServerPagination) => {
    setPageIndex(args.pageIndex);
    if (args.sortBy) {
      // ensure default sort by
      setSortBy(args.sortBy.length > 0 ? args.sortBy : DATASET_SORT_BY);
    }
  };

  return (
    <CustomStyledModal
      show={show}
      onHide={onHide}
      responsive
      title={t('Swap dataset')}
      width={confirmChange ? '432px' : ''}
      height={confirmChange ? 'auto' : '540px'}
      hideFooter={!confirmChange}
      footer={
        <>
          {confirmChange && (
            <ConfirmModalStyled>
              <div className="btn-container">
                <Button onClick={handlerCancelConfirm}>{t('Cancel')}</Button>
                <Button
                  className="proceed-btn"
                  buttonStyle="primary"
                  onClick={handleChangeConfirm}
                >
                  {t('Proceed')}
                </Button>
              </div>
            </ConfirmModalStyled>
          )}
        </>
      }
    >
      <>
        {!confirmChange && (
          <>
            <Alert
              roomBelow
              type="warning"
              css={theme => ({ marginBottom: theme.gridUnit * 4 })}
              message={
                <>
                  <strong>{t('Warning!')}</strong> {CHANGE_WARNING_MSG}
                </>
              }
            />
            <Input
              ref={searchRef}
              type="text"
              value={filter}
              placeholder={t('Search / Filter')}
              onChange={changeSearch}
            />
            {loading && <Loading />}
            {!loading && (
              <TableView
                columns={columns}
                data={resourceCollection}
                pageSize={DATASET_PAGE_SIZE}
                initialPageIndex={pageIndex}
                initialSortBy={sortBy}
                totalCount={resourceCount}
                onServerPagination={onServerPagination}
                className="table-condensed"
                emptyWrapperType={EmptyWrapperType.Small}
                serverPagination
                isPaginationSticky
                scrollTable
              />
            )}
          </>
        )}
        {confirmChange && <>{CONFIRM_WARNING_MESSAGE}</>}
      </>
    </CustomStyledModal>
  );
};

export default withToasts(ChangeDatasourceModal);
