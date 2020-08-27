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
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import React, { useEffect, useState } from 'react';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import { commonMenuData } from 'src/views/CRUD/data/common';
import DatabaseModal, { DatabaseObject } from './DatabaseModal';

interface DatabaseListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function DatabaseList({ addDangerToast, addSuccessToast }: DatabaseListProps) {
  const [databaseModalOpen, setDatabaseModalOpen] = useState<boolean>(false);
  const [currentDatabase, setCurrentDatabase] = useState<DatabaseObject | null>(
    null,
  );
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchDatasetInfo = () => {
    SupersetClient.get({
      endpoint: `/api/v1/dataset/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        setPermissions(infoJson.permissions);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('An error occurred while fetching datasets', errMsg)),
      ),
    );
  };

  useEffect(() => {
    fetchDatasetInfo();
  }, []);

  const hasPerm = (perm: string) => {
    if (!permissions.length) {
      return false;
    }

    return Boolean(permissions.find(p => p === perm));
  };

  const canCreate = hasPerm('can_add');

  const menuData: SubMenuProps = {
    activeChild: 'Databases',
    ...commonMenuData,
  };

  if (canCreate) {
    menuData.primaryButton = {
      name: (
        <>
          {' '}
          <i className="fa fa-plus" /> {t('Database')}{' '}
        </>
      ),
      onClick: () => {
        // Ensure modal will be opened in add mode
        setCurrentDatabase(null);
        setDatabaseModalOpen(true);
      },
    };
  }

  return (
    <>
      <SubMenu {...menuData} />
      <DatabaseModal
        database={currentDatabase}
        show={databaseModalOpen}
        onHide={() => setDatabaseModalOpen(false)}
        onDatabaseAdd={() => {
          /* TODO: add database logic here */
        }}
      />
    </>
  );
}

export default withToasts(DatabaseList);
