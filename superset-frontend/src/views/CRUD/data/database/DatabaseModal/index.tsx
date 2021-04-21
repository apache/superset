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
import { t } from '@superset-ui/core';
import React, { FunctionComponent, useEffect, useState } from 'react';
import Tabs from 'src/common/components/Tabs';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import {
  testDatabaseConnection,
  useSingleViewResource,
} from 'src/views/CRUD/hooks';
import { useCommonConf } from 'src/views/CRUD/data/database/state';
import { DatabaseObject } from 'src/views/CRUD/data/database/types';
import ExtraOptions from 'src/views/CRUD/data/database/DatabaseModal/ExtraOptions';
import SqlAlchemyForm from 'src/views/CRUD/data/database/DatabaseModal/SqlAlchemyForm';
import {
  StyledBasicTab,
  StyledModal,
} from 'src/views/CRUD/data/database/DatabaseModal/styles';

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  database?: DatabaseObject | null; // If included, will go into edit mode
}

const DEFAULT_TAB_KEY = '1';

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  database = null,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [db, setDB] = useState<DatabaseObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [tabKey, setTabKey] = useState<string>(DEFAULT_TAB_KEY);
  const conf = useCommonConf();

  const isEditMode = database !== null;
  const useSqlAlchemyForm = true; // TODO: set up logic
  const hasConnectedDb = false; // TODO: set up logic

  // Database fetch logic
  const {
    state: { loading: dbLoading, resource: dbFetched },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );

  // Test Connection logic
  const testConnection = () => {
    if (!db?.sqlalchemy_uri) {
      addDangerToast(t('Please enter a SQLAlchemy URI to test'));
      return;
    }

    const connection = {
      sqlalchemy_uri: db?.sqlalchemy_uri || '',
      database_name: db?.database_name?.trim() || undefined,
      impersonate_user: db?.impersonate_user || undefined,
      extra: db?.extra || undefined,
      encrypted_extra: db?.encrypted_extra || undefined,
      server_cert: db?.server_cert || undefined,
    };

    testDatabaseConnection(connection, addDangerToast, addSuccessToast);
  };

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      const update: DatabaseObject = {
        database_name: db?.database_name.trim() || '',
        sqlalchemy_uri: db?.sqlalchemy_uri || '',
        ...db,
      };

      // Need to clean update object
      if (update.id) {
        delete update.id;
      }

      if (db?.id) {
        updateResource(db.id, update).then(result => {
          if (result) {
            if (onDatabaseAdd) {
              onDatabaseAdd();
            }
            hide();
          }
        });
      }
    } else if (db) {
      // Create
      db.database_name = db.database_name.trim();
      createResource(db).then(dbId => {
        if (dbId) {
          if (onDatabaseAdd) {
            onDatabaseAdd();
          }
          hide();
        }
      });
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    const { checked, name, value, type } = target;
    const data = {
      database_name: db?.database_name || '',
      sqlalchemy_uri: db?.sqlalchemy_uri || '',
      ...db,
    };

    if (type === 'checkbox') {
      data[name] = checked;
    } else {
      data[name] = value;
    }

    setDB(data);
  };

  const onTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { target } = event;
    const { name, value } = target;
    const data = {
      database_name: db?.database_name || '',
      sqlalchemy_uri: db?.sqlalchemy_uri || '',
      ...db,
    };

    data[name] = value;
    setDB(data);
  };

  const onEditorChange = (json: string, name: string) => {
    const data = {
      database_name: db?.database_name || '',
      sqlalchemy_uri: db?.sqlalchemy_uri || '',
      ...db,
    };

    data[name] = json;
    setDB(data);
  };

  const validate = () => {
    const canSave = db?.database_name?.trim() && db?.sqlalchemy_uri;
    setDisableSave(!canSave);
  };

  // Initialize
  if (isEditMode && ((db && database?.id !== db.id) || (isHidden && show))) {
    if (database?.id && !dbLoading) {
      const id = database.id || 0;
      setTabKey(DEFAULT_TAB_KEY);

      fetchResource(id)
        .then(() => {
          setDB(dbFetched);
        })
        .catch(e =>
          addDangerToast(
            t(
              'Sorry there was an error fetching database information: %s',
              e.message,
            ),
          ),
        );
    }
  } else if (isEditMode || (!db?.id && !(isHidden || show))) {
    setTabKey(DEFAULT_TAB_KEY);
    setDB({
      database_name: '',
      sqlalchemy_uri: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  }, [db?.database_name || null, db?.sqlalchemy_uri || null]);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  return isEditMode || useSqlAlchemyForm ? (
    <StyledModal
      name="database"
      className="database-modal"
      disablePrimaryButton={disableSave}
      height="600px"
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Connect')}
      width="500px"
      show={show}
      title={
        <h4>{isEditMode ? t('Edit database') : t('Connect a database')}</h4>
      }
    >
      <Tabs
        defaultActiveKey={DEFAULT_TAB_KEY}
        activeKey={tabKey}
        onTabClick={tabChange}
      >
        <StyledBasicTab tab={<span>{t('Basic')}</span>} key="1">
          {useSqlAlchemyForm ? (
            <SqlAlchemyForm
              db={db}
              onInputChange={onInputChange}
              conf={conf}
              testConnection={testConnection}
            />
          ) : (
            <div>
              <p>TODO: db form</p>
            </div>
          )}
        </StyledBasicTab>
        <Tabs.TabPane tab={<span>{t('Advanced')}</span>} key="2">
          <ExtraOptions
            db={db}
            onInputChange={onInputChange}
            onTextChange={onTextChange}
            onEditorChange={onEditorChange}
          />
        </Tabs.TabPane>
      </Tabs>
    </StyledModal>
  ) : (
    <StyledModal
      name="database"
      className="database-modal"
      disablePrimaryButton={disableSave}
      height="600px"
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={hasConnectedDb ? t('Connect') : t('Finish')}
      width="500px"
      show={show}
      title={<h4>{t('Connect a database')}</h4>}
    >
      <div>
        <p>db form;</p>
        <p> no cancel button (just the x at the top);</p>
        <p> 3 steps; form is step 2: back or connect buttons;</p>
        <p> advanced is step 3: back or finish buttons;</p>
        <p>says step 1 of 3, etc</p>
      </div>
    </StyledModal>
  );
};

export default withToasts(DatabaseModal);
