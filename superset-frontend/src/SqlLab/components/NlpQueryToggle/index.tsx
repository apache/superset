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
import { useDispatch } from 'react-redux';
import { toggleIsNlpQuery } from 'src/SqlLab/actions/sqlLab';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { Switch } from 'antd';

export interface NlpQueryToggleProps {
  queryEditorId: string;
}

const NlpQueryToggle = ({ queryEditorId }: NlpQueryToggleProps) => {
  const dispatch = useDispatch();

  const queryEditor = useQueryEditor(queryEditorId, ['id', 'isNlpQuery']);
  const isNlpQuery = queryEditor?.isNlpQuery;
  const setIsNlpQuery = (updatedIsNlpQuery: boolean) =>
    dispatch(toggleIsNlpQuery(queryEditor, updatedIsNlpQuery));

  return (
    <Switch
      defaultChecked={isNlpQuery}
      checkedChildren="NL"
      unCheckedChildren="SQL"
      onChange={() => setIsNlpQuery(!isNlpQuery)}
    />
  );
};

export default NlpQueryToggle;
