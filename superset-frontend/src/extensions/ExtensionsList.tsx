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
import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import { useListViewResource } from 'src/views/CRUD/hooks';
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

type ExtensionsInfo = {
  permissions?: string[];
  status?: 'loaded' | 'not_loaded';
  message?: string;
};

interface ExtensionsListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ExtensionsList: FunctionComponent<ExtensionsListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
    refreshData,
  } = useListViewResource<Extension>(
    'extensions',
    t('Extensions'),
    addDangerToast,
    false, // _info is fetched below, once, for its load status
  );
  const [notLoaded, setNotLoaded] = useState(false);
  const addDangerToastRef = useRef(addDangerToast);
  addDangerToastRef.current = addDangerToast;

  useEffect(() => {
    // The list is empty on a server that did not load extensions at startup;
    // say why instead of showing an empty table without explanation.
    SupersetClient.get({ endpoint: '/api/v1/extensions/_info' }).then(
      ({ json }) => {
        const info: ExtensionsInfo = json;
        setNotLoaded(info.status === 'not_loaded');
      },
      createErrorHandler(errMsg =>
        addDangerToastRef.current(
          t(
            'An error occurred while fetching %s info: %s',
            t('Extensions'),
            errMsg,
          ),
        ),
      ),
    );
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
        count={resourceCount}
        data={resourceCollection}
        initialSort={[{ id: 'name', desc: false }]}
        pageSize={PAGE_SIZE}
        fetchData={fetchData}
        loading={loading}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={refreshData}
      />
    </>
  );
};

export default withToasts(ExtensionsList);
