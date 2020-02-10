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
import { t } from '@superset-ui/translation';

import { ROW_TYPE } from '../../../util/componentTypes';
import { NEW_ROW_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewRow() {
  return (
    <DraggableNewComponent
      id={NEW_ROW_ID}
      type={ROW_TYPE}
      label={t('Row')}
      className="fa fa-long-arrow-right"
    />
  );
}
