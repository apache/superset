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
import PropTypes from 'prop-types';
import CheckboxTree from 'react-checkbox-tree';

import renderFilterScopeTreeNodes from './renderFilterScopeTreeNodes';
import treeIcons from './treeIcons';
import { filterScopeSelectorTreeNodePropShape } from '../../util/propShapes';

const propTypes = {
  nodes: PropTypes.arrayOf(filterScopeSelectorTreeNodePropShape).isRequired,
  checked: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  ).isRequired,
  expanded: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  ).isRequired,
  onCheck: PropTypes.func.isRequired,
  onExpand: PropTypes.func.isRequired,
  selectedChartId: PropTypes.oneOfType([null, PropTypes.number]),
};

const defaultProps = {
  selectedChartId: null,
};

const NOOP = () => {};

export default function FilterScopeTree({
  nodes = [],
  checked = [],
  expanded = [],
  onCheck,
  onExpand,
  selectedChartId,
}) {
  return (
    <CheckboxTree
      showExpandAll
      expandOnClick
      showNodeIcon={false}
      nodes={renderFilterScopeTreeNodes({ nodes, selectedChartId })}
      checked={checked}
      expanded={expanded}
      onCheck={onCheck}
      onExpand={onExpand}
      onClick={NOOP}
      icons={treeIcons}
    />
  );
}

FilterScopeTree.propTypes = propTypes;
FilterScopeTree.defaultProps = defaultProps;
