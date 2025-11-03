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
import { useState, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { Button } from '../Button';
import { Form } from '../Form';
import { Modal } from './Modal';
import type { FormModalProps } from './types';

export function FormModal({
  show,
  onHide,
  title,
  onSave,
  children,
  initialValues = {},
  formSubmitHandler,
  bodyStyle = {},
  requiredFields = [],
  name,
}: FormModalProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const resetForm = useCallback(() => {
    form.resetFields();
    setIsSaving(false);
  }, [form]);
  const [submitDisabled, setSubmitDisabled] = useState(true);

  const handleClose = useCallback(() => {
    resetForm();
    onHide();
  }, [onHide, resetForm]);

  const handleSave = useCallback(() => {
    resetForm();
    onSave();
  }, [onSave, resetForm]);

  const handleFormSubmit = useCallback(
    async values => {
      try {
        setIsSaving(true);
        await formSubmitHandler(values);
        handleSave();
      } catch (err) {
        console.error(err);
      } finally {
        setIsSaving(false);
      }
    },
    [formSubmitHandler, handleSave],
  );

  const onFormChange = () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);

    const values = form.getFieldsValue();
    const hasEmptyRequired = requiredFields.some(field => !values[field]);

    setSubmitDisabled(hasErrors || hasEmptyRequired);
  };

  return (
    <Modal
      name={name}
      show={show}
      title={title}
      onHide={handleClose}
      bodyStyle={bodyStyle}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            data-test="modal-cancel-button"
            onClick={handleClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            htmlType="submit"
            onClick={() => form.submit()}
            data-test="form-modal-save-button"
            disabled={isSaving || submitDisabled}
          >
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
        initialValues={initialValues}
        onValuesChange={onFormChange}
        onFieldsChange={onFormChange}
      >
        {typeof children === 'function' ? children(form) : children}
      </Form>
    </Modal>
  );
}
