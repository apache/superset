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
import Form, { FormValidation } from 'react-jsonschema-form';
import { Col, FormControl, FormGroup, Row } from 'react-bootstrap';
import { t, styled } from '@superset-ui/core';
import chrono from 'chrono-node';
import ModalTrigger from 'src/components/ModalTrigger';
import FormLabel from 'src/components/FormLabel';
import './ScheduleQueryButton.less';

const validators = {
  greater: (a: number, b: number) => a > b,
  greater_equal: (a: number, b: number) => a >= b,
  less: (a: number, b: number) => a < b,
  less_equal: (a: number, b: number) => a <= b,
};

function getJSONSchema() {
  const jsonSchema = window.featureFlags.SCHEDULED_QUERIES.JSONSCHEMA;
  // parse date-time into usable value (eg, 'today' => `new Date()`)
  Object.entries(jsonSchema.properties).forEach(
    ([key, properties]: [string, any]) => {
      if (properties.default && properties.format === 'date-time') {
        jsonSchema.properties[key] = {
          ...properties,
          default: chrono.parseDate(properties.default).toISOString(),
        };
      }
    },
  );
  return jsonSchema;
}

function getUISchema() {
  return window.featureFlags.SCHEDULED_QUERIES.UISCHEMA;
}

function getValidationRules() {
  return window.featureFlags.SCHEDULED_QUERIES.VALIDATION || [];
}

function getValidator() {
  const rules = getValidationRules();
  return (formData: Record<string, any>, errors: FormValidation) => {
    rules.forEach((rule: any) => {
      const test = validators[rule.name];
      const args = rule.arguments.map((name: string) => formData[name]);
      const container = rule.container || rule.arguments.slice(-1)[0];
      if (!test(...args)) {
        errors[container].addError(rule.message);
      }
    });
    return errors;
  };
}

interface ScheduleQueryButtonProps {
  defaultLabel?: string;
  sql: string;
  schema?: string;
  dbId: number;
  animation?: boolean;
  onSchedule?: Function;
  scheduleQueryWarning: string | null;
  disabled: boolean;
  tooltip: string | null;
}

const StyledRow = styled(Row)`
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ScheduleQueryButton: FunctionComponent<ScheduleQueryButtonProps> = ({
  defaultLabel = t('Undefined'),
  sql,
  schema,
  dbId,
  onSchedule = () => {},
  scheduleQueryWarning = null,
  disabled = false,
  tooltip = null,
}) => {
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState(defaultLabel);
  const [showSchedule, setShowSchedule] = useState(false);
  let saveModal: any;
  // this is for the ref that is created in the modal trigger. the modal is created in order to use the .close() function on it.

  const onScheduleSubmit = ({ formData }: Record<string, any>) => {
    const query = {
      label,
      description,
      db_id: dbId,
      schema,
      sql,
      extra_json: JSON.stringify({ schedule_info: formData }),
    };
    onSchedule(query);
    saveModal.close();
  };

  const renderModalBody = () => (
    <FormGroup>
      <StyledRow>
        <Col md={12}>
          <FormLabel className="control-label" htmlFor="embed-height">
            {t('Label')}
          </FormLabel>
          <FormControl
            type="text"
            placeholder={t('Label for your query')}
            value={label}
            onChange={(event: any) => setLabel(event.target?.value)}
          />
        </Col>
      </StyledRow>
      <StyledRow>
        <Col md={12}>
          <FormLabel className="control-label" htmlFor="embed-height">
            {t('Description')}
          </FormLabel>
          <FormControl
            componentClass="textarea"
            placeholder={t('Write a description for your query')}
            value={description}
            onChange={(event: any) => setDescription(event.target?.value)}
          />
        </Col>
      </StyledRow>
      <Row>
        <Col md={12}>
          <div className="json-schema">
            <Form
              schema={getJSONSchema()}
              uiSchema={getUISchema()}
              onSubmit={onScheduleSubmit}
              validate={getValidator()}
            />
          </div>
        </Col>
      </Row>
      {scheduleQueryWarning && (
        <Row>
          <Col md={12}>
            <small>{scheduleQueryWarning}</small>
          </Col>
        </Row>
      )}
    </FormGroup>
  );

  return (
    <span className="ScheduleQueryButton">
      <ModalTrigger
        ref={ref => {
          saveModal = ref;
        }}
        modalTitle={t('Schedule query')}
        modalBody={renderModalBody()}
        triggerNode={
          <div
            role="button"
            buttonSize="small"
            onClick={() => setShowSchedule(!showSchedule)}
            disabled={disabled}
            tooltip={tooltip}
          >
            {t('Schedule')}
          </div>
        }
      />
    </span>
  );
};

export default ScheduleQueryButton;
