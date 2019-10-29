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
import cx from 'classnames';
import { t } from '@superset-ui/translation';

import { DASHBOARD_ROOT_TYPE } from '../../util/componentTypes';

function traverse({ currentNode, selectedFilterId }) {
  if (!currentNode) {
    return null;
  }

  const { label, type, children } = currentNode;
  if (children && children.length) {
    const updatedChildren = children.map(child =>
      traverse({ currentNode: child, selectedFilterId }),
    );
    return {
      ...currentNode,
      label: (
        <a className={`filter-scope-type ${type.toLowerCase()}`}>
          {type !== DASHBOARD_ROOT_TYPE && (
            <span className="type-indicator">{t(type)}</span>
          )}
          {label}
        </a>
      ),
      children: updatedChildren,
    };
  }

  const { value } = currentNode;
  return {
    ...currentNode,
    label: (
      <a
        className={cx(`filter-scope-type ${type.toLowerCase()}`, {
          'selected-filter': selectedFilterId === value,
        })}
      >
        <span className="type-indicator">{t(type)}</span>
        {label}
      </a>
    ),
  };
}

export default function renderFilterScopeTreeNodes({
  nodes = [],
  selectedFilterId = 0,
}) {
  return nodes.map(node => traverse({ currentNode: node, selectedFilterId }));
}
