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
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import { TimeRangeAdjustmentList } from 'src/components/TimeRangeAdjustmentList';
import {
  saveDashboardRequest,
  setCopyAdjustConfirm,
} from 'src/dashboard/actions/dashboardState';
import { DashboardState, RootState } from 'src/dashboard/types';
import { SAVE_TYPE_NEWDASHBOARD_ADJUSTED } from 'src/dashboard/util/constants';

const CopyAdjustConfirm = () => {
  const dispatch = useDispatch();
  const copyAdjustConfirmMetadata = useSelector<
    RootState,
    DashboardState['copyAdjustConfirmMetadata']
  >(({ dashboardState }) => dashboardState.copyAdjustConfirmMetadata);

  const onHide = useCallback(
    () => dispatch(setCopyAdjustConfirm(undefined)),
    [dispatch],
  );
  const onConfirm = useCallback(() => {
    if (copyAdjustConfirmMetadata) {
      dispatch(setCopyAdjustConfirm(undefined));
      dispatch(
        saveDashboardRequest(
          copyAdjustConfirmMetadata.data,
          copyAdjustConfirmMetadata.dashboardId,
          SAVE_TYPE_NEWDASHBOARD_ADJUSTED,
          copyAdjustConfirmMetadata.fingerprint,
        ),
      );
    }
  }, [dispatch, copyAdjustConfirmMetadata]);

  if (!copyAdjustConfirmMetadata) {
    return null;
  }

  if (copyAdjustConfirmMetadata.adjustments.length === 0) {
    return (
      <Modal
        show
        name="copy-adjust-confirm"
        title={t('Adjust time ranges?')}
        onHide={onHide}
        onHandledPrimaryAction={onConfirm}
        primaryButtonName={t('Save')}
      >
        <p>
          {t(
            'The changes needed changed since you reviewed them. No changes are needed any more.',
          )}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      show
      name="copy-adjust-confirm"
      title={t('Adjust time ranges?')}
      onHide={onHide}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={t('Adjust and copy')}
    >
      {copyAdjustConfirmMetadata.changed && (
        <p>
          {t(
            'The changes needed changed since you reviewed them. Review the new list.',
          )}
        </p>
      )}
      <p>
        {t(
          "The copy's time ranges don't fit the time range limits. Saving the copy makes these changes:",
        )}
      </p>
      <TimeRangeAdjustmentList
        adjustments={copyAdjustConfirmMetadata.adjustments}
      />
      <p>
        {t(
          'The original dashboard is not changed. Adjust and copy to save the copy with these changes, or cancel to copy nothing.',
        )}
      </p>
    </Modal>
  );
};

export default CopyAdjustConfirm;
