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
import { t } from '@superset-ui/core';
import { FormItem, Input, FormInstance } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { ValidationObject } from 'src/components/Modal/useModalValidation';

interface BasicInfoSectionProps {
  form: FormInstance;
  isLoading: boolean;
  validationStatus: ValidationObject;
}

const BasicInfoSection = ({
  form,
  isLoading,
  validationStatus,
}: BasicInfoSectionProps) => (
  <>
    <ModalFormField
      label={t('Name')}
      required
      helperText={t('A readable URL for your dashboard')}
      testId="dashboard-name-field"
      error={
        validationStatus.basic?.hasErrors &&
        (!form.getFieldValue('title') ||
          form.getFieldValue('title').trim().length === 0)
          ? t('Dashboard name is required')
          : undefined
      }
    >
      <FormItem name="title" noStyle>
        <Input
          data-test="dashboard-title-input"
          type="text"
          disabled={isLoading}
        />
      </FormItem>
    </ModalFormField>
    <ModalFormField
      label={t('URL Slug')}
      helperText={t('A readable URL for your dashboard')}
      testId="dashboard-slug-field"
      bottomSpacing={false}
    >
      <FormItem name="slug" noStyle>
        <Input
          data-test="dashboard-slug-input"
          type="text"
          disabled={isLoading}
        />
      </FormItem>
    </ModalFormField>
  </>
);

export default BasicInfoSection;
