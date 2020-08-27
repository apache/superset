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
import styled from '@superset-ui/style';
import { t } from '@superset-ui/translation';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';
import { Tabs as BaseTabs } from 'src/common/components';

export type DatabaseObject = {
  id?: number;
  name: string;
  uri: string;
  // TODO: add more props
};

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  database?: DatabaseObject | null; // If included, will go into edit mode
}

const { TabPane } = BaseTabs;

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledInputContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

  .label,
  .helper {
    display: block;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    color: ${({ theme }) => theme.colors.grayscale.light1};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    text-align: left;

    .required {
      margin-left: ${({ theme }) => theme.gridUnit / 2}px;
      color: ${({ theme }) => theme.colors.error.base};
    }
  }

  .input-container {
    display: flex;
  }

  input[type='text'] {
    flex: 1 1 auto;
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='name'] {
      flex: 0 1 auto;
      width: 40%;
    }
  }
`;

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  database = null,
}) => {
  // const [disableSave, setDisableSave] = useState(true);
  const [disableSave] = useState<boolean>(true);
  const [db, setDB] = useState<DatabaseObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (onDatabaseAdd) {
      onDatabaseAdd();
    }

    hide();
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const data = {
      name: db ? db.name : '',
      uri: db ? db.uri : '',
      ...db,
    };

    data[target.name] = target.value;

    setDB(data);
  };

  const isEditMode = database !== null;

  // Initialize
  if (
    isEditMode &&
    (!db || !db.id || (database && database.id !== db.id) || (isHidden && show))
  ) {
    setDB(database);
  } else if (!isEditMode && (!db || db.id || (isHidden && show))) {
    setDB({
      name: '',
      uri: '',
    });
  }

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      className="database-modal"
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      width="750px"
      show={show}
      title={
        <h4>
          <StyledIcon name="databases" />
          {isEditMode ? t('Edit Database') : t('Add Database')}
        </h4>
      }
    >
      <Tabs defaultActiveKey="1">
        <TabPane
          tab={
            <span>
              {t('Connection')}
              <span className="required">*</span>
            </span>
          }
          key="1"
        >
          <StyledInputContainer>
            <div className="label">
              {t('Datasource Name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={db ? db.name : ''}
                placeholder={t('Name your datasource')}
                onChange={onInputChange}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="label">
              {t('SQLAlchemy URI')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="uri"
                value={db ? db.uri : ''}
                placeholder={t('SQLAlchemy URI')}
                onChange={onInputChange}
              />
            </div>
            <div className="helper">
              {t('Refer to the ')}
              <a
                href="https://docs.sqlalchemy.org/en/rel_1_2/core/engines.html#"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('SQLAlchemy docs')}
              </a>
              {t(' for more information on how to structure your URI.')}
            </div>
          </StyledInputContainer>
        </TabPane>
        <TabPane tab={<span>{t('Performance')}</span>} key="2">
          Performance Form Data
        </TabPane>
        <TabPane tab={<span>{t('SQL Lab Settings')}</span>} key="3">
          SQL Lab Settings Form Data
        </TabPane>
        <TabPane tab={<span>{t('Security')}</span>} key="4">
          Security Form Data
        </TabPane>
        <TabPane tab={<span>{t('Extra')}</span>} key="5">
          Extra Form Data
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default withToasts(DatabaseModal);
