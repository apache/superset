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
import { Tabs } from 'src/common/components';

export type DatabaseObject = {
  id: number;
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

const { TabPane } = Tabs;

const StyledIcon = styled(Icon)`
  margin: auto 10px auto 0;
`;

const StyledTabs = styled(Tabs)`
  margin-top: -18px;

  .ant-tabs-nav-list {
    width: 100%;
  }

  .ant-tabs-tab {
    width: 20%;

    &.ant-tabs-tab-active .ant-tabs-tab-btn {
      color: inherit;
    }
  }

  .ant-tabs-tab-btn {
    flex: 1 1 auto;
    font-size: 12px;
    text-align: center;
    text-transform: uppercase;

    .required {
      margin-left: 2px;
      color: #e04355;
    }
  }

  .ant-tabs-ink-bar {
    background: ${({ theme }) => theme.colors.secondary.base};
  }
`;

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  database,
}) => {
  // const [disableSave, setDisableSave] = useState(true);
  const [disableSave] = useState(true);
  const onSave = () => {
    if (onDatabaseAdd) {
      onDatabaseAdd();
    }

    onHide();
  };

  const isEditMode = database !== null;

  return (
    <Modal
      className="database-modal"
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={onHide}
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
      <StyledTabs defaultActiveKey="1">
        <TabPane
          tab={
            <span>
              {t('Connection')}
              <span className="required">*</span>
            </span>
          }
          key="1"
        >
          Connection Form Data
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
      </StyledTabs>
    </Modal>
  );
};

export default withToasts(DatabaseModal);
