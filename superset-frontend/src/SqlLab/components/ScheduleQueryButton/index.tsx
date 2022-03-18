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
import SchemaForm, { FormProps, FormValidation } from 'react-jsonschema-form';
import { Row, Col } from 'src/components';
import { Input, TextArea } from 'src/components/Input';
import { t, styled } from '@superset-ui/core';
import * as chrono from 'chrono-node';
import ModalTrigger from 'src/components/ModalTrigger';
import { Form, FormItem } from 'src/components/Form';
import './ScheduleQueryButton.less';
import Button from 'src/components/Button';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);
const scheduledQueriesConf = bootstrapData?.common?.conf?.SCHEDULED_QUERIES;

const validators = {
  greater: (a: number, b: number) => a > b,
  greater_equal: (a: number, b: number) => a >= b,
  less: (a: number, b: number) => a < b,
  less_equal: (a: number, b: number) => a <= b,
};

const getJSONSchema = () => {
  const jsonSchema = scheduledQueriesConf?.JSONSCHEMA;
  // parse date-time into usable value (eg, 'today' => `new Date()`)
  if (jsonSchema) {
    Object.entries(jsonSchema.properties).forEach(
      ([key, value]: [string, any]) => {
        if (value.default && value.format === 'date-time') {
          jsonSchema.properties[key] = {
            ...value,
            default: chrono.parseDate(value.default).toISOString(),
          };
        }
      },
    );
    return jsonSchema;
  }
  return {};
};

const getUISchema = () => scheduledQueriesConf?.UISCHEMA;

const getValidationRules = () => scheduledQueriesConf?.VALIDATION || [];

const getValidator = () => {
  const rules: any = getValidationRules();
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
};

interface ScheduleQueryButtonProps {
  defaultLabel?: string;
  sql: string;
  schema?: string;
  dbId: number;
  animation?: boolean;
  onSchedule?: Function;
  scheduleQueryWarning: string | null;
  disabled: boolean;
  tooltip: string;
}

const StyledRow = styled(Row)`
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

export const StyledButtonComponent = styled(Button)`
  background: none;
  text-transform: none;
  padding: 0px;
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  &:disabled {
    background: none;
    color: rgba(0, 0, 0, 0.85);
    &:hover {
      background: none;
      color: rgba(0, 0, 0, 0.85);
    }
  }
`;

const ScheduleQueryButton: FunctionComponent<ScheduleQueryButtonProps> = ({
  defaultLabel = t('Undefined'),
  sql,
  schema,
  dbId,
  onSchedule = () => {},
  scheduleQueryWarning,
  tooltip,
  disabled = false,
}) => {
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState(defaultLabel);
  const [showSchedule, setShowSchedule] = useState(false);
  let saveModal: ModalTrigger | null;

  const onScheduleSubmit = ({
    formData,
  }: {
    formData: Omit<FormProps<Record<string, any>>, 'schema'>;
  }) => {
    const query = {
      label,
      description,
      db_id: dbId,
      schema,
      sql,
      extra_json: JSON.stringify({ schedule_info: formData }),
    };
    onSchedule(query);
    saveModal?.close();
  };

  const renderModalBody = () => (
    <Form layout="vertical">
      <StyledRow>
        <Col xs={24}>
          <FormItem label={t('Label')}>
            <Input
              type="text"
              placeholder={t('Label for your query')}
              value={label}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setLabel(event.target.value)
              }
            />
          </FormItem>
        </Col>
      </StyledRow>
      <StyledRow>
        <Col xs={24}>
          <FormItem label={t('Description')}>
            <TextArea
              rows={4}
              placeholder={t('Write a description for your query')}
              value={description}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(event.target.value)
              }
            />
          </FormItem>
        </Col>
      </StyledRow>
      <Row>
        <Col xs={24}>
          <div className="json-schema">
            <SchemaForm
              schema={getJSONSchema()}
              uiSchema={getUISchema}
              onSubmit={onScheduleSubmit}
              validate={getValidator()}
            >
              <Button
                buttonStyle="primary"
                htmlType="submit"
                css={{ float: 'right' }}
              >
                Submit
              </Button>
            </SchemaForm>
          </div>
        </Col>
      </Row>
      {scheduleQueryWarning && (
        <Row>
          <Col xs={24}>
            <small>{scheduleQueryWarning}</small>
          </Col>
        </Row>
      )}
    </Form>
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
          <StyledButtonComponent
            onClick={() => setShowSchedule(!showSchedule)}
            buttonSize="small"
            buttonStyle="link"
            tooltip={tooltip}
            disabled={disabled}
          >
            {t('Schedule')}
          </StyledButtonComponent>
        }
      />
    </span>
  );
};

export default ScheduleQueryButton;
