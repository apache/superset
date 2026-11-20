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
import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { useSelector } from 'react-redux';
import { Query, QueryState } from '@superset-ui/core';
import type { DatabaseObject } from 'src/features/databases/types';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  Input,
  Button,
  Form,
  FormItem,
  Modal,
  Row,
  Col,
  Icons,
} from '@superset-ui/core/components';
import SaveDatasetActionButton from 'src/SqlLab/components/SaveDatasetActionButton';
import {
  SaveDatasetModal,
  ISaveableDatasource,
} from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import useLogAction from 'src/logger/useLogAction';
import {
  LOG_ACTIONS_SQLLAB_CREATE_CHART,
  LOG_ACTIONS_SQLLAB_SAVE_QUERY,
} from 'src/logger/LogUtils';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

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
  display: contents;
  white-space: nowrap;
  span[role='img']:not([aria-label='down']) {
    display: flex;
    margin: 0;
    svg {
      vertical-align: -${({ theme }) => theme.sizeUnit * 1.25}px;
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
  const [labelError, setLabelError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Bumped whenever the name is edited or the modal is closed, so a request
  // that settles afterwards cannot restore an error or close a modal the user
  // has since moved on from.
  const generation = useRef(0);
  // Identifies the request that owns the `submitting` state. Closing the modal
  // revokes it, so an obsolete request settling later cannot re-enable the
  // buttons while a newer request is still pending.
  const submissionToken = useRef(0);
  const [showSave, setShowSave] = useState<boolean>(false);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  // Saving a dataset runs the SQL to introspect columns, so it needs a
  // successful run of the SQL being saved that produced at least one column
  // -- editing after a run invalidates it, and running a selection only
  // validates that selection.
  const latestQuery = useSelector<SqlLabRootState, Query | undefined>(
    ({ sqlLab }) => sqlLab.queries[queryEditor.latestQueryId || ''],
  );
  const canSaveDataset =
    latestQuery?.state === QueryState.Success &&
    latestQuery.sql === queryEditor.sql &&
    columns.length > 0;
  const isSaved = !!query.remoteId;
  const isLabelEmpty = label.trim().length === 0;
  const canExploreDatabase = !!database?.allows_virtual_table_explore;
  const shouldShowSaveButton =
    database?.allows_virtual_table_explore !== undefined;

  const onSaveAsExplore = () => {
    logAction(LOG_ACTIONS_SQLLAB_CREATE_CHART, {});
    setShowSaveDatasetModal(true);
  };

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

  const close = () => {
    generation.current += 1;
    submissionToken.current += 1;
    setShowSave(false);
    setLabelError('');
    setSubmitting(false);
  };

  // A rejected save keeps the modal open with the user's input so the name
  // can be changed and the save retried.
  const submit = async (action: SaveQueryProps['onSave']) => {
    const submittedGeneration = generation.current;
    submissionToken.current += 1;
    const token = submissionToken.current;
    setLabelError('');
    setSubmitting(true);
    try {
      await action(queryPayload(), query.id);
    } catch (error) {
      if (generation.current === submittedGeneration) {
        setLabelError(error instanceof Error ? error.message : '');
      }
      return;
    } finally {
      if (submissionToken.current === token) {
        setSubmitting(false);
      }
    }
    if (generation.current === submittedGeneration) {
      close();
    }
  };

  const onSaveWrapper = () => {
    logAction(LOG_ACTIONS_SQLLAB_SAVE_QUERY, {});
    return submit(onSave);
  };

  const onUpdateWrapper = () => submit(onUpdate);

  const onLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
    generation.current += 1;
    setLabel(e.target.value);
    setLabelError('');
  };

  const onDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const renderModalBody = () => (
    <Form layout="vertical">
      <Row>
        <Col xs={24}>
          <FormItem
            label={t('Name')}
            htmlFor="save-query-name"
            validateStatus={labelError ? 'error' : undefined}
            help={
              labelError ? (
                <span id="save-query-name-error" role="alert">
                  {labelError}
                </span>
              ) : undefined
            }
          >
            <Input
              id="save-query-name"
              type="text"
              value={label}
              onChange={onLabelChange}
              aria-invalid={labelError ? true : undefined}
              aria-describedby={
                labelError ? 'save-query-name-error' : undefined
              }
            />
          </FormItem>
        </Col>
      </Row>
      <br />
      <Row>
        <Col xs={24}>
          <FormItem label={t('Description')} htmlFor="save-query-description">
            <Input.TextArea
              id="save-query-description"
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
          onSaveAsExplore={canExploreDatabase ? onSaveAsExplore : undefined}
          canSaveDataset={canSaveDataset}
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
        onHide={close}
        width="620px"
        show={showSave}
        name={t('Save query')}
        title={
          <ModalTitleWithIcon
            title={t('Save query')}
            icon={<Icons.SaveOutlined />}
            data-test="save-query-modal-title"
          />
        }
        footer={
          <>
            <Button
              onClick={close}
              data-test="cancel-query"
              cta
              buttonStyle="secondary"
            >
              {t('Cancel')}
            </Button>
            <Button
              buttonStyle={isSaved ? 'secondary' : 'primary'}
              onClick={onSaveWrapper}
              disabled={isLabelEmpty || submitting}
              cta
            >
              {isSaved ? t('Save as new') : t('Save')}
            </Button>
            {isSaved && (
              <Button
                buttonStyle="primary"
                onClick={onUpdateWrapper}
                disabled={isLabelEmpty || submitting}
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
