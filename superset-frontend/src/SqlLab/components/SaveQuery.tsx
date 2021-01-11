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
import React, { useState } from 'react';
import { FormControl, FormGroup, Row, Col } from 'react-bootstrap';
import { t, supersetTheme, styled } from '@superset-ui/core';

import Button from 'src/components/Button';
import FormLabel from 'src/components/FormLabel';
import Modal from 'src/common/components/Modal';
import Icon from 'src/components/Icon';

const Styles = styled.span`
  svg {
    vertical-align: -${supersetTheme.gridUnit * 1.25}px;
  }
`;

interface SaveQueryProps {
  query: any;
  defaultLabel: string;
  onSave: (arg0: QueryPayload) => void;
  onUpdate: (arg0: QueryPayload) => void;
  saveQueryWarning: string | null;
}

type QueryPayload = {
  autorun: boolean;
  dbId: number;
  description?: string;
  id?: string;
  latestQueryId: string;
  queryLimit: number;
  remoteId: number;
  schema: string;
  schemaOptions: Array<{
    label: string;
    title: string;
    value: string;
  }>;
  selectedText: string | null;
  sql: string;
  tableOptions: Array<{
    label: string;
    schema: string;
    title: string;
    type: string;
    value: string;
  }>;
  title: string;
};

export default function SaveQuery({
  query,
  defaultLabel = t('Undefined'),
  onSave = () => {},
  onUpdate,
  saveQueryWarning = null,
}: SaveQueryProps) {
  const [description, setDescription] = useState<string>(
    query.description || '',
  );
  const [label, setLabel] = useState<string>(defaultLabel);
  const [showSave, setShowSave] = useState<boolean>(false);
  const isSaved = !!query.remoteId;

  const queryPayload = () => ({
    ...query,
    title: label,
    description,
  });

  const close = () => {
    setShowSave(false);
  };

  const onSaveWrapper = () => {
    onSave(queryPayload());
    close();
  };

  const onUpdateWrapper = () => {
    onUpdate(queryPayload());
    close();
  };

  const onLabelChange = (e: React.FormEvent<FormControl>) => {
    setLabel((e.target as HTMLInputElement).value);
  };

  const onDescriptionChange = (e: React.FormEvent<FormControl>) => {
    setDescription((e.target as HTMLInputElement).value);
  };

  const toggleSave = () => {
    setShowSave(!showSave);
  };

  const renderModalBody = () => (
    <FormGroup bsSize="small">
      <Row>
        <Col md={12}>
          <small>
            <FormLabel htmlFor="embed-height">{t('Name')}</FormLabel>
          </small>
          <FormControl type="text" value={label} onChange={onLabelChange} />
        </Col>
      </Row>
      <br />
      <Row>
        <Col md={12}>
          <small>
            <FormLabel htmlFor="embed-height">{t('Description')}</FormLabel>
          </small>
          <FormControl
            rows={5}
            componentClass="textarea"
            value={description}
            onChange={onDescriptionChange}
          />
        </Col>
      </Row>
      {saveQueryWarning && (
        <>
          <br />
          <div>
            <Row>
              <Col md={12}>
                <small>{saveQueryWarning}</small>
              </Col>
            </Row>
            <br />
          </div>
        </>
      )}
    </FormGroup>
  );

  return (
    <Styles className="SaveQuery">
      <Button buttonSize="small" onClick={toggleSave}>
        <Icon
          name="save"
          color={supersetTheme.colors.primary.base}
          width={20}
          height={20}
        />{' '}
        {isSaved ? t('Save') : t('Save as')}
      </Button>
      <Modal
        className="save-query-modal"
        onHandledPrimaryAction={onSaveWrapper}
        onHide={close}
        primaryButtonName={isSaved ? t('Save') : t('Save as')}
        width="620px"
        show={showSave}
        title={<h4>{t('Save Query')}</h4>}
        footer={[
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
              {isSaved ? t('Save As New') : t('Save')}
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
          </>,
        ]}
      >
        {renderModalBody()}
      </Modal>
    </Styles>
  );
}
