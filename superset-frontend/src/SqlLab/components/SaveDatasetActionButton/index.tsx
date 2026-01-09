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
import { t } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { Menu } from '@superset-ui/core/components/Menu';
import { Button, DropdownButton } from '@superset-ui/core/components';

interface SaveDatasetActionButtonProps {
  setShowSave: (arg0: boolean) => void;
  onSaveAsExplore?: () => void;
  compactMode?: boolean;
}

const SaveDatasetActionButton = ({
  setShowSave,
  onSaveAsExplore,
  compactMode,
}: SaveDatasetActionButtonProps) => {
  const theme = useTheme();

  if (compactMode) {
    return (
      <>
        <Button
          color="primary"
          variant="text"
          onClick={() => setShowSave(true)}
          icon={<Icons.SaveOutlined />}
          tooltip={t('Save query')}
        />
        {onSaveAsExplore && (
          <Button
            color="primary"
            variant="text"
            onClick={() => onSaveAsExplore?.()}
            icon={<Icons.TableOutlined />}
            tooltip={t('Save or Overwrite Dataset')}
          />
        )}
      </>
    );
  }

  return !onSaveAsExplore ? (
    <Button onClick={() => setShowSave(true)} buttonStyle="primary">
      {t('Save')}
    </Button>
  ) : (
    <DropdownButton
      onClick={() => setShowSave(true)}
      popupRender={() => (
        <Menu
          items={[
            {
              label: t('Save dataset'),
              key: 'save-dataset',
              onClick: onSaveAsExplore,
            },
          ]}
        />
      )}
      icon={
        <Icons.DownOutlined iconSize="xs" iconColor={theme.colorPrimaryText} />
      }
      trigger={['click']}
    >
      {t('Save')}
    </DropdownButton>
  );
};

export default SaveDatasetActionButton;
