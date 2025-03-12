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
import { logging, t } from '@superset-ui/core';
import React, { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import Loading from 'src/components/Loading';
import {
  addDangerToast,
  addInfoToast,
} from 'src/components/MessageToasts/actions';
import { getExportSliceToGoogleSheetsUrl } from '../../dashboard/util/exportToGoogleSheet';

export default function ExportSliceToGoogleSheets() {
  const { sliceId }: any = useParams();
  const dispatch = useDispatch();

  const handleGoogleSheetsExport = useCallback(async () => {
    try {
      const googleSheetUrl = await getExportSliceToGoogleSheetsUrl(sliceId);
      logging.info(`Exported to Google Sheets ${googleSheetUrl}`);
      window.location.href = googleSheetUrl;
    } catch (error) {
      logging.error(error);
      dispatch(
        addDangerToast(t('Sorry, something went wrong. Try again later.')),
      );
    }
  }, [dispatch, sliceId]);

  useEffect(() => {
    if (!dispatch || !handleGoogleSheetsExport) {
      return;
    }
    dispatch(
      addInfoToast(t('Exporting results to Google Sheets'), { duration: 0 }),
    );

    handleGoogleSheetsExport();
  }, [handleGoogleSheetsExport]);

  return <Loading />;
}
