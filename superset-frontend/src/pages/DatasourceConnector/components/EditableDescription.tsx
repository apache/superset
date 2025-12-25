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
import { useState, useCallback, useEffect } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  Button,
  Flex,
  Icons,
  Input,
  Typography,
} from '@superset-ui/core/components';

const { TextArea } = Input;

interface EditableDescriptionProps {
  description: string | null;
  placeholder?: string;
  onSave: (description: string | null) => Promise<boolean>;
  isUpdating: boolean;
}

const SectionTitle = styled(Flex)`
  ${({ theme }) => `
    margin-bottom: ${theme.marginSM}px;
  `}
`;

const DescriptionBox = styled.div`
  ${({ theme }) => `
    background-color: ${theme.colorBgLayout};
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadiusSM}px;
    padding: ${theme.paddingSM}px;
    min-height: 80px;
  `}
`;

const EditActions = styled(Flex)`
  ${({ theme }) => `
    margin-top: ${theme.marginSM}px;
  `}
`;

export default function EditableDescription({
  description,
  placeholder,
  onSave,
  isUpdating,
}: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  // Reset editing state when description changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditedDescription(description || '');
    }
  }, [description, isEditing]);

  const handleStartEdit = useCallback(() => {
    setEditedDescription(description || '');
    setIsEditing(true);
  }, [description]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedDescription(description || '');
  }, [description]);

  const handleSaveDescription = useCallback(async () => {
    const success = await onSave(editedDescription || null);
    if (success) {
      setIsEditing(false);
    }
  }, [editedDescription, onSave]);

  return (
    <>
      <SectionTitle align="center" justify="space-between">
        <Typography.Text strong>{t('AI-Generated Description')}</Typography.Text>
        {!isEditing && (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={handleStartEdit}
            icon={<Icons.EditOutlined />}
          >
            {t('Edit')}
          </Button>
        )}
      </SectionTitle>

      {isEditing ? (
        <>
          <TextArea
            value={editedDescription}
            onChange={e => setEditedDescription(e.target.value)}
            rows={4}
            placeholder={placeholder || t('Enter a description...')}
          />
          <EditActions gap={8} justify="flex-end">
            <Button
              buttonSize="small"
              buttonStyle="tertiary"
              onClick={handleCancelEdit}
              disabled={isUpdating}
            >
              {t('Cancel')}
            </Button>
            <Button
              buttonSize="small"
              buttonStyle="primary"
              onClick={handleSaveDescription}
              loading={isUpdating}
            >
              {t('Save')}
            </Button>
          </EditActions>
        </>
      ) : (
        <DescriptionBox>
          <Typography.Text>
            {description || (
              <Typography.Text type="secondary" italic>
                {t('No description available')}
              </Typography.Text>
            )}
          </Typography.Text>
        </DescriptionBox>
      )}
    </>
  );
}
