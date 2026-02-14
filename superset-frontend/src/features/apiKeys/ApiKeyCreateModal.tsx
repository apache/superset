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
import { useState } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { css, useTheme, Alert } from '@apache-superset/core/ui';
import {
  FormModal,
  FormItem,
  Input,
  Button,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

interface ApiKeyCreateModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
}

export function ApiKeyCreateModal({
  show,
  onHide,
  onSuccess,
}: ApiKeyCreateModalProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFormSubmit = async (values: FormValues) => {
    try {
      const response = await SupersetClient.post({
        endpoint: '/api/v1/security/api_keys/',
        jsonPayload: values,
      });
      setCreatedKey(response.json.result.key);
      addSuccessToast(t('API key created successfully'));
    } catch (error) {
      addDangerToast(t('Failed to create API key'));
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedKey(null);
    setCopied(false);
    onHide();
    if (createdKey) {
      onSuccess();
    }
  };

  if (createdKey) {
    return (
      <FormModal
        show={show}
        onHide={handleClose}
        title={t('API Key Created')}
        onSave={handleClose}
        formSubmitHandler={async () => {}}
        requiredFields={[]}
        footer={
          <Button type="primary" onClick={handleClose}>
            {t('Done')}
          </Button>
        }
      >
        <Alert
          type="warning"
          message={t('Save this API key securely')}
          description={t(
            'This is the only time you will see this key. Store it securely.',
          )}
          showIcon
          css={css`
            margin-bottom: ${theme.sizeUnit * 4}px;
          `}
        />
        <div
          css={css`
            display: flex;
            gap: ${theme.sizeUnit * 2}px;
            align-items: center;
          `}
        >
          <Input
            value={createdKey}
            readOnly
            css={css`
              flex: 1;
              font-family: monospace;
            `}
          />
          <Button onClick={handleCopyKey}>
            {copied ? t('Copied!') : t('Copy')}
          </Button>
        </div>
      </FormModal>
    );
  }

  return (
    <FormModal
      show={show}
      onHide={handleClose}
      title={t('Create API Key')}
      onSave={() => {}}
      formSubmitHandler={handleFormSubmit}
      requiredFields={['name']}
    >
      <FormItem
        name="name"
        label={t('Name')}
        rules={[{ required: true, message: t('API key name is required') }]}
      >
        <Input
          name="name"
          placeholder={t('e.g., CI/CD Pipeline, Analytics Script')}
        />
      </FormItem>
    </FormModal>
  );
}
