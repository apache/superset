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
import { useCallback, useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  Checkbox,
  DeleteModal,
  Flex,
  Typography,
  type CheckboxChangeEvent,
} from '@superset-ui/core/components';

interface DeleteFolderModalProps {
  folder: {
    uuid: string;
    name: string;
    asset_count: number;
    children_count: number;
  };
  show: boolean;
  /** When true, suppresses the per-folder success toast (used in bulk-delete flows). */
  silent?: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

export default function DeleteFolderModal({
  folder,
  show,
  silent = false,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: DeleteFolderModalProps) {
  const theme = useTheme();
  const [deleteItems, setDeleteItems] = useState(false);

  // Reset checkbox when folder changes (e.g. queue processing)
  useEffect(() => {
    setDeleteItems(false);
  }, [folder.uuid]);

  const isEmpty = folder.asset_count === 0 && folder.children_count === 0;

  const handleConfirm = useCallback(async () => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/folders/${folder.uuid}${deleteItems ? '?archive_items=true' : ''}`,
      });
      if (!silent) {
        addSuccessToast(t('Folder "%s" deleted', folder.name));
      }
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error deleting folder'));
    }
  }, [
    folder,
    deleteItems,
    silent,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  const handleHide = useCallback(() => {
    setDeleteItems(false);
    onHide();
  }, [onHide]);

  return (
    <DeleteModal
      open={show}
      title={t('Delete folder "%s"', folder.name)}
      onHide={handleHide}
      onConfirm={handleConfirm}
      description={
        <Flex
          vertical
          gap={theme.sizeUnit * 3}
          style={{ marginTop: -theme.sizeUnit * 2 }}
        >
          <Typography.Paragraph style={{ margin: 0 }}>
            {isEmpty
              ? t("This folder doesn't contain any items.")
              : t(
                  'This folder contains items. Items will be moved to the parent folder or Analytics page unless you choose to delete everything together.',
                )}
          </Typography.Paragraph>
          {!isEmpty && (
            <Checkbox
              checked={deleteItems}
              onChange={(e: CheckboxChangeEvent) =>
                setDeleteItems(e.target.checked)
              }
            >
              {t('Delete all items in this folder')}
            </Checkbox>
          )}
        </Flex>
      }
    />
  );
}
