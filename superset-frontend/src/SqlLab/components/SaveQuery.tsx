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
import { t, styled } from '@superset-ui/core';

import Button from 'src/components/Button';
import FormLabel from 'src/components/FormLabel';
import Modal from 'src/common/components/Modal';

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

const StyledRow = styled(Row)`
  div {
    display: flex;
    justify-content: flex-start;
  }

  button.cta {
    margin: 0 7px;
    min-width: 105px;
    font-size: 12px;

    &:first-of-type {
      margin-left: 0;
    }
  }
`;

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

  const queryPayload = () => {
    return {
      ...query,
      title: label,
      description,
    };
  };

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

  const renderModalBody = () => {
    return (
      <FormGroup bsSize="small">
        <Row>
          <Col md={12}>
            <small>
              <FormLabel htmlFor="embed-height">{t('Label')}</FormLabel>
            </small>
            <FormControl
              type="text"
              placeholder={t('Label for your query')}
              value={label}
              onChange={onLabelChange}
            />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <small>
              <FormLabel htmlFor="embed-height">{t('Description')}</FormLabel>
            </small>
            <FormControl
              componentClass="textarea"
              placeholder={t('Write a description for your query')}
              value={description}
              onChange={onDescriptionChange}
            />
          </Col>
        </Row>
        <br />
        {saveQueryWarning && (
          <div>
            <Row>
              <Col md={12}>
                <small>{saveQueryWarning}</small>
              </Col>
            </Row>
            <br />
          </div>
        )}
        <StyledRow>
          <Col md={12}>
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
            <Button
              buttonStyle={isSaved ? undefined : 'primary'}
              onClick={onSaveWrapper}
              className="m-r-3"
              cta
            >
              {isSaved ? t('Save New') : t('Save')}
            </Button>
            <Button onClick={close} data-test="cancel-query" cta>
              {t('Cancel')}
            </Button>
          </Col>
        </StyledRow>
      </FormGroup>
    );
  };

  return (
    <span className="SaveQuery">
      <Button buttonSize="small" onClick={toggleSave}>
        <i className="fa fa-save" /> {t('Save')}
      </Button>
      <Modal
        className="save-query-modal"
        onHandledPrimaryAction={onSaveWrapper}
        onHide={close}
        primaryButtonName={isSaved ? t('Save') : t('Add')}
        width="390px"
        show={showSave}
        title={<h4>{t('Save Query')}</h4>}
        hideFooter
      >
        {renderModalBody()}
      </Modal>
    </span>
  );
}
