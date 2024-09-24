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
import { ReactNode } from 'react';
import { t } from '@superset-ui/core';
import Alert from 'src/components/Alert';
import Button, { OnClickHandler } from 'src/components/Button';

export interface ConfirmationAlertProps {
  title: string;
  children: ReactNode;
  onConfirm: OnClickHandler;
  onDismiss: OnClickHandler;
}

export function CancelConfirmationAlert({
  title,
  onConfirm,
  onDismiss,
  children,
}: ConfirmationAlertProps) {
  return (
    <Alert
      closable={false}
      type="warning"
      key="alert"
      message={title}
      css={{
        textAlign: 'left',
        flex: 1,
        '& .ant-alert-action': { alignSelf: 'center' },
      }}
      description={children}
      action={
        <div css={{ display: 'flex' }}>
          <Button
            key="cancel"
            buttonSize="small"
            buttonStyle="secondary"
            onClick={onDismiss}
          >
            {t('Keep editing')}
          </Button>
          <Button
            key="submit"
            buttonSize="small"
            buttonStyle="primary"
            onClick={onConfirm}
          >
            {t('Yes, cancel')}
          </Button>
        </div>
      }
    />
  );
}
