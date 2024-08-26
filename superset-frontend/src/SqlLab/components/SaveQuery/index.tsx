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
import { useState, useEffect, useMemo, ChangeEvent } from 'react';

import type { DatabaseObject } from 'src/features/databases/types';
import { Row, Col } from 'src/components';
import { Input, TextArea } from 'src/components/Input';
import { t, styled } from '@superset-ui/core';
import Button from 'src/components/Button';
import { Menu } from 'src/components/Menu';
import { Form, FormItem } from 'src/components/Form';
import Modal from 'src/components/Modal';
import SaveDatasetActionButton from 'src/SqlLab/components/SaveDatasetActionButton';
import {
  SaveDatasetModal,
  ISaveableDatasource,
} from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { QueryEditor } from 'src/SqlLab/types';
import useLogAction from 'src/logger/useLogAction';
import {
  LOG_ACTIONS_SQLLAB_CREATE_CHART,
  LOG_ACTIONS_SQLLAB_SAVE_QUERY,
} from 'src/logger/LogUtils';

interface SaveQueryProps {
  queryEditorId: string;
  columns: ISaveableDatasource['columns'];
  onSave: (arg0: QueryPayload, id: string) => void;
  onUpdate: (arg0: QueryPayload, id: string) => void;
  saveQueryWarning: string | null;
  database: Partial<DatabaseObject> | undefined;
}

export type QueryPayload = {
  name: string;
  description?: string;
  id?: string;
  remoteId?: number;
} & Pick<QueryEditor, 'dbId' | 'catalog' | 'schema' | 'sql'>;

const Styles = styled.span`
  span[role='img'] {
    display: flex;
    margin: 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    svg {
      vertical-align: -${({ theme }) => theme.gridUnit * 1.25}px;
      margin: 0;
    }
  }
`;

const SaveQuery = ({
  queryEditorId,
  onSave = () => {},
  onUpdate,
  saveQueryWarning,
  database,
  columns,
}: SaveQueryProps) => {
  const queryEditor = useQueryEditor(queryEditorId, [
    'autorun',
    'name',
    'description',
    'remoteId',
    'dbId',
    'latestQueryId',
    'queryLimit',
    'catalog',
    'schema',
    'selectedText',
    'sql',
    'templateParams',
  ]);
  const query = useMemo(
    () => ({
      ...queryEditor,
      columns,
    }),
    [queryEditor, columns],
  );
  const logAction = useLogAction({ queryEditorId });
  const defaultLabel = query.name || query.description || t('Undefined');
  const [description, setDescription] = useState<string>(
    query.description || '',
  );
  const [label, setLabel] = useState<string>(defaultLabel);
  const [showSave, setShowSave] = useState<boolean>(false);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const isSaved = !!query.remoteId;
  const canExploreDatabase = !!database?.allows_virtual_table_explore;
  const shouldShowSaveButton =
    database?.allows_virtual_table_explore !== undefined;

  const overlayMenu = (
    <Menu>
      <Menu.Item
        onClick={() => {
          logAction(LOG_ACTIONS_SQLLAB_CREATE_CHART, {});
          setShowSaveDatasetModal(true);
        }}
      >
        {t('Save dataset')}
      </Menu.Item>
    </Menu>
  );

  const queryPayload = () => ({
    name: label,
    description,
    dbId: query.dbId ?? 0,
    sql: query.sql,
    catalog: query.catalog,
    schema: query.schema,
    templateParams: query.templateParams,
    remoteId: query?.remoteId || undefined,
  });

  useEffect(() => {
    if (!isSaved) setLabel(defaultLabel);
  }, [defaultLabel]);

  const close = () => setShowSave(false);

  const onSaveWrapper = () => {
    logAction(LOG_ACTIONS_SQLLAB_SAVE_QUERY, {});
    onSave(queryPayload(), query.id);
    close();
  };

  const onUpdateWrapper = () => {
    onUpdate(queryPayload(), query.id);
    close();
  };

  const onLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  const onDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const renderModalBody = () => (
    <Form layout="vertical">
      <Row>
        <Col xs={24}>
          <FormItem label={t('Name')}>
            <Input type="text" value={label} onChange={onLabelChange} />
          </FormItem>
        </Col>
      </Row>
      <br />
      <Row>
        <Col xs={24}>
          <FormItem label={t('Description')}>
            <TextArea
              rows={4}
              value={description}
              onChange={onDescriptionChange}
            />
          </FormItem>
        </Col>
      </Row>
      {saveQueryWarning && (
        <>
          <br />
          <div>
            <Row>
              <Col xs={24}>
                <small>{saveQueryWarning}</small>
              </Col>
            </Row>
            <br />
          </div>
        </>
      )}
    </Form>
  );

  return (
    <Styles className="SaveQuery">
      {shouldShowSaveButton && (
        <SaveDatasetActionButton
          setShowSave={setShowSave}
          overlayMenu={canExploreDatabase ? overlayMenu : null}
        />
      )}
      <SaveDatasetModal
        visible={showSaveDatasetModal}
        onHide={() => setShowSaveDatasetModal(false)}
        buttonTextOnSave={t('Save & Explore')}
        buttonTextOnOverwrite={t('Overwrite & Explore')}
        datasource={getDatasourceAsSaveableDataset(query)}
      />
      <Modal
        className="save-query-modal"
        onHandledPrimaryAction={onSaveWrapper}
        onHide={close}
        primaryButtonName={isSaved ? t('Save') : t('Save as')}
        width="620px"
        show={showSave}
        title={<h4>{t('Save query')}</h4>}
        footer={
          <>
            <Button onClick={close} data-test="cancel-query" cta>
              {t('Cancel')}
            </Button>
            <Button
              buttonStyle={isSaved ? undefined : 'primary'}
              onClick={onSaveWrapper}
              className="m-r-3"
              cta
            >
              {isSaved ? t('Save as new') : t('Save')}
            </Button>
            {isSaved && (
              <Button
                buttonStyle="primary"
                onClick={onUpdateWrapper}
                className="m-r-3"
                cta
              >
                {t('Update')}
              </Button>
            )}
          </>
        }
      >
        {renderModalBody()}
      </Modal>
    </Styles>
  );
};

export default SaveQuery;
