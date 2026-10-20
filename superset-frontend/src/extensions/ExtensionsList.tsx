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
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { SupersetClient } from '@superset-ui/core';
import {
  FunctionComponent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';

const PAGE_SIZE = 25;

type Extension = {
  id: number;
  name: string;
  enabled: boolean;
};

type ExtensionsListResponse = {
  result?: Extension[];
  count?: number;
  status?: 'loaded' | 'not_loaded';
};

type ExtensionsListState = {
  loading: boolean;
  collection: Extension[];
  count: number;
  notLoaded: boolean;
};

interface ExtensionsListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ExtensionsList: FunctionComponent<ExtensionsListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  // The rows and the load status come from the same list response, so the
  // restart notice always describes the list on screen, even when requests
  // reach different servers during a rolling restart.
  const [{ loading, collection, count, notLoaded }, setState] =
    useState<ExtensionsListState>({
      loading: true,
      collection: [],
      count: 0,
      notLoaded: false,
    });
  const addDangerToastRef = useRef(addDangerToast);
  addDangerToastRef.current = addDangerToast;
  const latestRequestIdRef = useRef(0);

  // The endpoint returns every servable extension in one page and ignores
  // paging and sorting parameters.
  const fetchData = useCallback(() => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const isLatest = () => latestRequestIdRef.current === requestId;
    setState(current => ({ ...current, loading: true }));
    return SupersetClient.get({ endpoint: '/api/v1/extensions/' })
      .then(
        ({ json }) => {
          if (!isLatest()) return;
          const response: ExtensionsListResponse = json;
          setState(current => ({
            ...current,
            collection: response.result ?? [],
            count: response.count ?? 0,
            notLoaded: response.status === 'not_loaded',
          }));
        },
        createErrorHandler(errMsg => {
          if (!isLatest()) return;
          addDangerToastRef.current(
            t(
              'An error occurred while fetching %ss: %s',
              t('Extensions'),
              errMsg,
            ),
          );
        }),
      )
      .finally(() => {
        if (isLatest()) {
          setState(current => ({ ...current, loading: false }));
        }
      });
  }, []);

  const columns = useMemo(
    () => [
      {
        Header: t('Name'),
        accessor: 'name',
        size: 'lg',
        id: 'name',
        Cell: ({
          row: {
            original: { name },
          },
        }: any) => name,
      },
    ],
    [loading], // We need to monitor loading to avoid stale state in actions
  );

  const menuData: SubMenuProps = {
    activeChild: 'Extensions',
    name: t('Extensions'),
    buttons: [],
  };

  return (
    <>
      <SubMenu {...menuData} />
      {notLoaded && (
        <Alert
          type="warning"
          showIcon
          message={t('Extensions not loaded')}
          description={t(
            'Extensions are enabled but were not loaded when this server started. Restart the server to load them.',
          )}
        />
      )}
      <ListView<Extension>
        columns={columns}
        count={count}
        data={collection}
        initialSort={[{ id: 'name', desc: false }]}
        pageSize={PAGE_SIZE}
        fetchData={fetchData}
        loading={loading}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={fetchData}
      />
    </>
  );
};

export default withToasts(ExtensionsList);
