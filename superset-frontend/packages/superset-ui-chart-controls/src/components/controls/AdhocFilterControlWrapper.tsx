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
import { useSelector } from 'react-redux';
import { ExplorePageState } from 'src/explore/types';
import AdhocFilterControlOriginal from 'src/explore/components/controls/FilterControl/AdhocFilterControl/index';
import { ControlHeader } from '../ControlHeader';

export interface AdhocFilterControlProps {
  name: string;
  value?: any[];
  onChange: (value: any[]) => void;
  label?: string;
  description?: string;
  required?: boolean;
  renderTrigger?: boolean;
}

/**
 * Wrapper around the existing AdhocFilterControl that simplifies its API
 */
export const AdhocFilterControl: React.FC<AdhocFilterControlProps> = ({
  name,
  value = [],
  onChange,
  label,
  description,
  required,
  renderTrigger,
}) => {
  // Get datasource from Redux state
  const datasource = useSelector<ExplorePageState>(
    state => state.explore.datasource,
  ) as any;

  const columns = datasource?.columns || [];
  const savedMetrics = datasource?.metrics || [];

  return (
    <div className="control-wrapper">
      {label && (
        <ControlHeader
          label={label}
          description={description}
          renderTrigger={renderTrigger}
          required={required}
        />
      )}
      <AdhocFilterControlOriginal
        name={name}
        value={value}
        onChange={onChange}
        columns={columns}
        savedMetrics={savedMetrics}
        datasource={datasource}
      />
    </div>
  );
};
