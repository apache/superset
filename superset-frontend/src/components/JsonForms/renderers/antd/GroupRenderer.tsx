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

import { FC } from 'react';
import {
  LayoutProps,
  RankedTester,
  rankWith,
  uiTypeIs,
  UISchemaElement,
} from '@jsonforms/core';
import {
  withJsonFormsLayoutProps,
  ResolvedJsonFormsDispatch,
} from '@jsonforms/react';

export const GroupRenderer: FC<LayoutProps> = ({
  uischema,
  schema,
  path,
  visible,
  renderers,
  cells,
  label,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="control-group" style={{ marginBottom: '24px' }}>
      {label && <h4 style={{ marginBottom: '16px' }}>{label}</h4>}
      <div style={{ paddingLeft: label ? '16px' : '0' }}>
        {(uischema as any).elements?.map(
          (element: UISchemaElement, index: number) => (
            <ResolvedJsonFormsDispatch
              key={`${path}-${index}`}
              uischema={element}
              schema={schema}
              path={path}
              renderers={renderers}
              cells={cells}
            />
          ),
        )}
      </div>
    </div>
  );
};

export const groupTester: RankedTester = rankWith(1, uiTypeIs('Group'));

export default withJsonFormsLayoutProps(GroupRenderer);
