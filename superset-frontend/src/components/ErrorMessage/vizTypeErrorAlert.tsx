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
import React from 'react';
import Alert from 'src/components/Alert';
import { t } from '@superset-ui/core';

interface vizTypeErrorAlertProps {
  onClickFunction: () => void;
}

export default function vizTypeErrorAlert({
  onClickFunction,
}: vizTypeErrorAlertProps) {
  return (
    <Alert
      closable
      type="error"
      message="Chart type requires a dataset"
      description={
        <>
          {t(
            'This chart type is not supported when using an unsaved query as a chart source. ',
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={() => onClickFunction()}
            className="add-dataset-alert-description"
            css={{ textDecoration: 'underline' }}
          >
            {t('Create a dataset')}
          </span>
          {t(' to visualize your data.')}
        </>
      }
    />
  );
}
