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
import React, { FunctionComponent, useState, useRef, useEffect } from 'react';
import SchemaForm from 'react-jsonschema-form';
import { Row, Col } from 'src/components';
import { t, styled } from '@superset-ui/core';
import * as chrono from 'chrono-node';
import ModalTrigger, { ModalTriggerRef } from 'src/components/ModalTrigger';
import { Form } from 'src/components/Form';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import {
  convertToLocalDateTime,
  removeUnnecessaryProperties,
} from 'src/utils/commonHelper';
import Loading from 'src/components/Loading';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { FlashTypes } from 'src/views/CRUD/flash/enums';
import { FlashObject, FormErrors, Dropdown } from 'src/views/CRUD/flash/types';
import moment from 'moment';
import { useSelector } from 'react-redux';
import { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { getUpToDateQuery } from 'src/SqlLab/actions/sqlLab';
import withToasts from 'src/components/MessageToasts/withToasts';
import { createFlash, fetchDatabases } from '../../services/flash.service';
import { BUTTON_TYPES } from '../../constants';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);
const { user } = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);

const flashObjectConfig = bootstrapData?.common?.conf?.FLASH_CREATION;

const getJSONSchema = () => {
  const jsonSchema = flashObjectConfig?.JSONSCHEMA;
  return jsonSchema;
};

const getUISchema = () => flashObjectConfig?.UISCHEMA;
type Query = {
  query?: string;
  language?: string;
};
interface FlashCreationButtonProps {
  buttonType: string;
  latestQueryFormData?: object;
  sqlEditor?: any;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const StyledJsonSchema = styled.div`
  i.glyphicon {
    display: none;
  }
  .btn-add::after {
    content: '+';
  }
  .array-item-move-up::after {
    content: '↑';
  }
  .array-item-move-down::after {
    content: '↓';
  }
  .array-item-remove::after {
    content: '-';
  }
  .help-block {
    font-size: 12px;
  }
  input::placeholder {
    font-size: 13px
    opacity: 0.7;
  }
  .text-danger{
    font-size: 11px
  }
`;

const FlashCreationButton: FunctionComponent<FlashCreationButtonProps> = ({
  buttonType,
  sqlEditor,
  latestQueryFormData,
  addDangerToast,
  addSuccessToast,
}) => {
  const sql = useSelector<SqlLabRootState, string | undefined>(rootState =>
    sqlEditor
      ? (getUpToDateQuery(rootState, sqlEditor) as unknown as QueryEditor).sql
      : '',
  );

  const [flashSchema, setFlashSchema] = useState(getJSONSchema());
  const [dbDropdown, setDbDropdown] = useState<Dropdown>({
    enum: [''],
    enumNames: ['Please Select'],
  });
  const [formData, setFormData] = useState<FlashObject | null>(null);
  const [sqlQuery, setSqlQuery] = useState<Query>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreateFlashObject = !!sql || !!latestQueryFormData;
  const saveModal: ModalTriggerRef | null = useRef() as ModalTriggerRef;

  useEffect(() => {
    fetchDatabaseDropdown();
  }, []);

  const getSchemas = () => {
    if (flashSchema) {
      const jsonSchema = { ...flashSchema };
      if (jsonSchema) {
        Object.entries(jsonSchema.properties).forEach(
          ([key, value]: [string, any]) => {
            if (key === 'datastoreId') {
              if (dbDropdown) {
                jsonSchema.properties[key] = {
                  ...value,
                  enum: dbDropdown && dbDropdown.enum ? dbDropdown.enum : [''],
                  enumNames:
                    dbDropdown && dbDropdown.enumNames
                      ? dbDropdown.enumNames
                      : ['Please Select'],
                  default:
                    dbDropdown && dbDropdown.enum
                      ? buttonType === BUTTON_TYPES.SCHEDULE
                        ? 3
                        : dbDropdown.enum[0]
                      : '',
                  readOnly: buttonType === BUTTON_TYPES.SCHEDULE,
                };
              }
            }
            if (value.default) {
              if (value.format === 'date-time') {
                jsonSchema.properties[key] = {
                  ...value,
                  default: convertToLocalDateTime(),
                };
              }
              if (value.format === 'date') {
                jsonSchema.properties[key] = {
                  ...value,
                  default: chrono
                    .parseDate(value.default)
                    .toISOString()
                    .split('T')[0],
                };
              }
            }
          },
        );
        setFlashSchema(jsonSchema);
      }
    }
  };

  useEffect(() => {
    getSchemas();
  }, [dbDropdown]);

  const loadQueryFromData = (resultType: string) => {
    setIsLoading(true);
    getChartDataRequest({
      formData: latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(({ json }) => {
        const query = { ...json.result[0] };
        setSqlQuery(query);
        setIsLoading(false);
        setError(null);
      })
      .catch((response: any) => {
        getClientErrorObject(response).then(({ error, message }) => {
          setError(
            error ||
              message ||
              response.statusText ||
              t('Sorry, An error occurred'),
          );
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    if (latestQueryFormData) {
      loadQueryFromData('query');
    }
  }, [JSON.stringify(latestQueryFormData)]);

  const validate = (formData: any, errors: any) => {
    if (formData) {
      if (
        formData.flashType === FlashTypes.SHORT_TERM ||
        formData.flashType === FlashTypes.LONG_TERM
      ) {
        if (Date.parse(formData.scheduleStartTime) < Date.now()) {
          errors.scheduleStartTime.addError(
            'Schedule Start Time should be greater than current data-time',
          );
        }
      }
    }
    return errors;
  };

  const transformErrors = (errors: FormErrors[]) =>
    errors.map((error: FormErrors) => {
      const newError = { ...error };
      if (error.name === 'pattern') {
        if (error.property === '.teamSlackChannel') {
          newError.message = 'Slack Channel must start with #';
        }
        if (error.property === '.teamSlackHandle') {
          newError.message = 'Slack Handle must start with @';
        }
        if (
          error.property === '.serviceName' ||
          error.property === '.domainName' ||
          error.property === '.datasetName'
        ) {
          const keyName = error.property
            .replace('.', '')
            .replace(/([a-z])([A-Z])/, '$1 $2')
            .toUpperCase();
          newError.message = `${keyName} must start with an alphabet and can contain (_) in between e.g: key_name`;
        }
      }
      return newError;
    });

  const fetchDatabaseDropdown = (): Promise<any> =>
    fetchDatabases().then(({ data }) => {
      const dropdown = { ...dbDropdown };
      if (dropdown) {
        data.forEach((item: any) => {
          dropdown.enum.push(item.id);
          dropdown.enumNames = dropdown.enumNames || ['Please Select'];
          dropdown.enumNames.push(item.datastore_name);
        });
      }
      setDbDropdown(dropdown);
    });

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <pre>{error}</pre>;
  }

  const onFieldChange = (formValues: any) => {
    const formData = { ...formValues };
    if (formData) {
      if (formData.flashType === FlashTypes.LONG_TERM) {
        formData.ttl = chrono
          .parseDate('90 days from now')
          .toISOString()
          .split('T')[0];
        formData.scheduleStartTime = convertToLocalDateTime(
          formData.scheduleStartTime,
        );
      } else if (formData.flashType === FlashTypes.SHORT_TERM) {
        formData.ttl = chrono
          .parseDate('7 days from now')
          .toISOString()
          .split('T')[0];
        formData.scheduleStartTime = convertToLocalDateTime(
          formData.scheduleStartTime,
        );
      } else {
        formData.ttl = chrono
          .parseDate('7 days from now')
          .toISOString()
          .split('T')[0];
      }
      if (formData.domainName || formData.serviceName || formData.datasetName) {
        formData.tableName = [
          formData.domainName,
          formData.serviceName,
          formData.datasetName,
        ]
          .filter(val => val != null)
          .join('_');
      }
      setFormData(formData);
    }
  };

  const onFlashCreationSubmit = ({ formData }: { formData: any }) => {
    const payload = { ...formData };
    payload.scheduleStartTime = moment(payload.scheduleStartTime).format(
      'YYYY-MM-DD HH:mm:ss',
    );

    if (payload.flashType === FlashTypes.SHORT_TERM) {
      removeUnnecessaryProperties(payload, [
        'teamSlackChannel',
        'teamSlackHandle',
      ]);
    }
    if (payload.flashType === FlashTypes.ONE_TIME) {
      removeUnnecessaryProperties(payload, [
        'teamSlackChannel',
        'teamSlackHandle',
        'scheduleType',
        'scheduleStartTime',
      ]);
    }
    const flash = {
      owner: user?.email,
      sqlQuery: sql || sqlQuery?.query,
      ...payload,
    } as FlashObject;

    flashCreationService(flash);
  };

  const flashCreationService = (payload: FlashObject) => {
    createFlash(payload)
      .then(() => {
        resetFormData();
        addSuccessToast(
          t(
            'Your request for new flash object is added. Please check status on Flash Management.',
          ),
        );
        saveModal?.current?.close();
      })
      .catch(error => {
        const apiError = error?.data?.message
          ? error?.data?.message
          : t('Your flash could not be created');
        addDangerToast(apiError);
      });
  };

  const resetFormData = () => {
    if (formData) {
      formData.datastoreId = '';
      formData.domainName = '';
      formData.datasetName = '';
      formData.flashType = '';
      formData.scheduleStartTime = convertToLocalDateTime();
      formData.scheduleType = '';
      formData.serviceName = '';
      formData.tableName = '';
      formData.teamSlackChannel = '';
      formData.teamSlackHandle = '';
      formData.ttl = chrono
        .parseDate('7 days from now')
        .toISOString()
        .split('T')[0];
    }
  };

  const renderModalBody = () => (
    <Form layout="vertical">
      <Row>
        <Col xs={24}>
          <StyledJsonSchema>
            <SchemaForm
              schema={flashSchema}
              showErrorList={false}
              formData={formData || {}}
              uiSchema={getUISchema()}
              onSubmit={onFlashCreationSubmit}
              transformErrors={transformErrors}
              validate={validate}
              onChange={e => onFieldChange(e.formData)}
            >
              <Button
                buttonStyle="primary"
                htmlType="submit"
                css={{ float: 'right' }}
              >
                {buttonType === BUTTON_TYPES.SCHEDULE ? 'Schedule' : 'Create'}
              </Button>
            </SchemaForm>
          </StyledJsonSchema>
        </Col>
      </Row>
    </Form>
  );

  return (
    <span className="flashCreationButton">
      <ModalTrigger
        ref={saveModal}
        modalTitle={
          buttonType === BUTTON_TYPES.SCHEDULE
            ? t('Schedule')
            : t('Create Flash Object')
        }
        modalBody={renderModalBody()}
        disabled={!canCreateFlashObject}
        triggerNode={
          <Button
            onClick={() => getSchemas()}
            tooltip={
              canCreateFlashObject
                ? t('Create Flash Object')
                : t('Please add a valid SQL QUERY first')
            }
            disabled={!canCreateFlashObject}
            buttonSize="small"
            buttonStyle="primary"
          >
            {buttonType === BUTTON_TYPES.SCHEDULE ? (
              t('Schedule')
            ) : (
              <>
                <Icons.PlusOutlined iconSize="l" /> {t('Create Flash Object')}
              </>
            )}
          </Button>
        }
      />
    </span>
  );
};

export default withToasts(FlashCreationButton);
