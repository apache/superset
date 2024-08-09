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
import { SupersetClient, t } from '@superset-ui/core';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import Loading from 'src/components/Loading';
import {
  addDangerToast,
  addInfoToast,
} from 'src/components/MessageToasts/actions';

export default function ExportGoogleSheets() {
  const { clientId }: any = useParams();
  const dispatch = useDispatch();
  const [{ isLoading, data, error }, setState] = useState<{
    isLoading: boolean;
    data: any;
    error: any;
  }>({ isLoading: true, data: null, error: null });
  useEffect(() => {
    if (!dispatch || !clientId) {
      return;
    }
    dispatch(
      addInfoToast(t('Exporting results to Google Sheets'), { duration: 0 }),
    );
    SupersetClient.get({
      endpoint: `/api/v1/sqllab/export/${clientId}/google-sheets/`,
    })
      .then(res => setState({ data: res.json, isLoading: false, error: null }))
      .catch(e => setState({ data: null, isLoading: false, error: e }));
  }, [dispatch, clientId]);
  useEffect(() => {
    if (!dispatch) {
      return;
    }
    if (error) {
      (async () => {
        const message =
          (await error?.json())?.message ||
          (await error?.text()) ||
          error?.message ||
          t('Unknown error.');
        dispatch(addDangerToast(message, { duration: 0 }));
      })();
    }
  }, [dispatch, error]);
  useEffect(() => {
    if (data?.sheet_id) {
      window.location.href = `https://docs.google.com/spreadsheets/d/${data.sheet_id}/`;
    }
  }, [data]);

  if (isLoading) {
    return <Loading />;
  }

  return null;
}
