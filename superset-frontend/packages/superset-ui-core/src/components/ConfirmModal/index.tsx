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
import { styled } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';
import { Icons, Modal, Typography, Button } from '@superset-ui/core/components';
import type { FC, ReactElement, ReactNode } from 'react';

const IconWrapper = styled.span`
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const DEFAULT_ICON = <Icons.QuestionCircleOutlined iconSize="m" />;

export type ConfirmModalProps = {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  title: string;
  body: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: 'primary' | 'danger' | 'dashed';
  icon?: ReactNode;
  loading?: boolean;
};

export const ConfirmModal: FC<ConfirmModalProps> = ({
  show,
  onHide,
  onConfirm,
  title,
  body,
  confirmText = t('Confirm'),
  cancelText = t('Cancel'),
  confirmButtonStyle = 'primary',
  icon = DEFAULT_ICON,
  loading = false,
}: ConfirmModalProps): ReactElement => (
  <Modal
    centered
    responsive
    onHide={onHide}
    show={show}
    width="600px"
    title={
      <>
        <IconWrapper>{icon}</IconWrapper>
        {title}
      </>
    }
    footer={
      <>
        <Button buttonStyle="secondary" onClick={onHide} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          buttonStyle={confirmButtonStyle}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </>
    }
  >
    {typeof body === 'string' ? (
      <Typography.Text>{body}</Typography.Text>
    ) : (
      body
    )}
  </Modal>
);
