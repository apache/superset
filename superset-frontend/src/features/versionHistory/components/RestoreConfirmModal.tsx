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
import { t } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import { EntityType } from '../types';

interface Props {
  open: boolean;
  entityType: EntityType;
  summary: string;
  date: string;
  restoring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const RestoreConfirmModal = ({
  open,
  entityType,
  summary,
  date,
  restoring,
  onConfirm,
  onCancel,
}: Props) => {
  const body =
    entityType === 'dashboard'
      ? t(
          'Restoring will revert your dashboard to: "%(summary)s" (%(date)s). Your current version will be saved in version history and you can restore it again at any time.',
          { summary, date },
        )
      : t(
          'Restoring will revert your chart to: "%(summary)s" (%(date)s). Your current version will be saved in version history and you can restore it again at any time.',
          { summary, date },
        );

  return (
    <Modal
      show={open}
      onHide={onCancel}
      title={t('Restore this version?')}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={t('Restore this version')}
      primaryButtonLoading={restoring}
      destroyOnHidden
    >
      <p>{body}</p>
    </Modal>
  );
};

export default RestoreConfirmModal;
