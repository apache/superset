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
import { SupersetClient, SupersetClientResponse } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
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
    false, // _info is requested below, where its status code is visible
  );
  // The extensions APIs are registered only when ENABLE_EXTENSIONS is on at
  // startup, while the menu entry and this route follow the flag per request.
  // A 404 here means the server never registered them; say so instead of
  // surfacing the generic error the list requests would produce.
  const [availability, setAvailability] = useState<
    'checking' | 'available' | 'not_enabled'
  >('checking');
  const addDangerToastRef = useRef(addDangerToast);
  addDangerToastRef.current = addDangerToast;

  useEffect(() => {
    SupersetClient.get({ endpoint: '/api/v1/extensions/_info' }).then(
      () => setAvailability('available'),
      (error: SupersetClientResponse) => {
        if ((error as Response).status === 404) {
          setAvailability('not_enabled');
          return;
        }
        setAvailability('available');
        createErrorHandler(errMsg =>
          addDangerToastRef.current(
            t(
              'An error occurred while fetching %s info: %s',
              t('Extensions'),
              errMsg,
            ),
          ),
        )(error);
      },
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

  if (availability === 'checking') {
    return (
      <>
        <SubMenu {...menuData} />
        <Loading />
      </>
    );
  }

  if (availability === 'not_enabled') {
    return (
      <>
        <SubMenu {...menuData} />
        <Alert
          type="warning"
          showIcon
          message={t('Extensions are not enabled on this server')}
          description={t(
            'The ENABLE_EXTENSIONS feature flag must be on when the server starts. Enable it in the server configuration and restart.',
          )}
        />
      </>
    );
  }

  return (
    <>
      <SubMenu {...menuData} />
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
