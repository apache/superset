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
import React, {
  FunctionComponent,
  useState,
  useEffect,
  useCallback,
} from 'react';
import SchemaForm from 'react-jsonschema-form';
import { Row, Col } from 'src/components';
import { t, styled } from '@superset-ui/core';
import { Form } from 'src/components/Form';
import Button from 'src/components/Button';
import {
  FlashExtendTtl,
  FlashServiceObject,
  FormErrors,
} from 'src/views/CRUD/flash/types';
import Modal from 'src/components/Modal';
import withToasts from 'src/components/MessageToasts/withToasts';
import { updateFlash } from '../../services/flash.service';
import { UPDATE_TYPES } from '../../constants';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);

const flashTTLConf = bootstrapData?.common?.conf?.FLASH_TTL;

const getJSONSchema = () => {
  const jsonSchema = flashTTLConf?.JSONSCHEMA;
  return jsonSchema;
};

const getUISchema = () => flashTTLConf?.UISCHEMA;

interface FlashExtendTTLButtonProps {
  flash: FlashServiceObject;
  show: boolean;
  onHide: () => void;
  refreshData: () => void;
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

const StyledModal = styled(Modal)`
  .ant-modal-content {
  }

  .ant-modal-body {
    padding: 24px;
  }

  pre {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    line-height: ${({ theme }) => theme.typography.sizes.l}px;
    height: 375px;
    border: none;
  }
`;

const FlashExtendTTL: FunctionComponent<FlashExtendTTLButtonProps> = ({
  flash,
  onHide,
  show,
  refreshData,
  addDangerToast,
  addSuccessToast,
}) => {
  const flashSchema = getJSONSchema();

  const [formData, setFormData] = useState<FlashExtendTtl>({
    ttl: '',
  });

  useEffect(() => {
    if (flash) {
      formData.ttl = flash?.ttl ? flash?.ttl : '';
    }
  }, []);

  const transformErrors = (errors: FormErrors[]) =>
    errors.map((error: FormErrors) => {
      const newError = { ...error };
      return newError;
    });

  const onFieldChange = (formValues: any) => {
    const formData = { ...formValues };
    setFormData(formData);
  };

  const onFlashUpdation = ({ formData }: { formData: any }) => {
    const payload = { ...formData };
    flashTtlService(Number(flash?.id), UPDATE_TYPES.TTL, payload);
  };

  const flashTtlService = useCallback(
    (id, type, payload) => {
      updateFlash(id, type, payload)
        .then(() => {
          addSuccessToast(t('Your flash object ttl has been extended.'));
          onHide();
          refreshData();
        })
        .catch(error => {
          const apiError = error?.data?.message
            ? error?.data?.message
            : t('There was an issue modifying the ttl of the Flash');
          addDangerToast(t(apiError));
        });
    },
    [addSuccessToast, addDangerToast],
  );

  const renderModalBody = () => (
    <Form layout="vertical">
      <Row>
        <Col xs={24}>
          <StyledJsonSchema>
            <SchemaForm
              schema={flashSchema}
              showErrorList={false}
              formData={formData}
              uiSchema={getUISchema()}
              onSubmit={onFlashUpdation}
              transformErrors={transformErrors}
              onChange={e => onFieldChange(e.formData)}
            >
              <Button
                buttonStyle="primary"
                htmlType="submit"
                css={{ float: 'right' }}
              >
                Update
              </Button>
            </SchemaForm>
          </StyledJsonSchema>
        </Col>
      </Row>
    </Form>
  );

  return (
    <div role="none">
      <StyledModal
        draggable
        onHide={onHide}
        show={show}
        title={t('Update TTL')}
        footer={<></>}
      >
        {renderModalBody()}
      </StyledModal>
    </div>
  );
};

export default withToasts(FlashExtendTTL);
