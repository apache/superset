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
import { useSelector } from 'react-redux';
import { ExplorePageState } from 'src/explore/types';
import { DndColumnSelect as DndColumnSelectControl } from 'src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { ControlHeader } from '../ControlHeader';

export interface DndColumnSelectProps {
  name: string;
  value?: any;
  onChange: (value: any) => void;
  label?: string;
  description?: string;
  multi?: boolean;
  required?: boolean;
  renderTrigger?: boolean;
  canDelete?: boolean;
  ghostButtonText?: string;
  isTemporal?: boolean;
}

/**
 * Wrapper around the existing DndColumnSelect that simplifies its API
 */
export const DndColumnSelect: React.FC<DndColumnSelectProps> = ({
  name,
  value,
  onChange,
  label,
  description,
  multi = false,
  required,
  renderTrigger,
  canDelete = true,
  ghostButtonText,
  isTemporal,
}) => {
  // Get columns from Redux state
  const columns = useSelector<ExplorePageState>(
    state => state.explore.datasource?.columns || [],
  ) as any[];

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
      <DndColumnSelectControl
        name={name}
        value={value}
        onChange={onChange}
        options={columns}
        multi={multi}
        canDelete={canDelete}
        ghostButtonText={
          ghostButtonText || (multi ? 'Drop columns here' : 'Drop column here')
        }
        isTemporal={isTemporal}
        type="DndColumnSelect"
        actions={
          {
            setControlValue: (controlName: string, value: any) => ({
              type: 'SET_CONTROL_VALUE',
              controlName,
              value,
              validationErrors: undefined,
            }),
          } as any
        }
      />
    </div>
  );
};
