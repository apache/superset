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

import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { isEqual, isEmpty } from 'lodash';
import { styled, t, usePrevious } from '@superset-ui/core';
import { sanitizeFormData } from 'src/explore/exploreUtils/formData';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { safeStringify } from 'src/utils/safeStringify';
import { Tooltip } from 'src/components/Tooltip';
import ModalTrigger from '../ModalTrigger';
import TableView from '../TableView';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
};

const StyledLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.dark1};
    background-color: ${theme.colors.alert.base};

    &: hover {
      background-color: ${theme.colors.alert.dark1};
    }
  `}
`;

export const alterForComparison = value => {
  // Considering `[]`, `{}`, `null` and `undefined` as identical
  // for this purpose
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value) && value.length === 0) {
      return null;
    }
    const keys = Object.keys(value);
    if (keys && keys.length === 0) {
      return null;
    }
  }
  return value;
};

export const formatValueHandler = (value, key, controlsMap) => {
  // Format display value based on the control type
  // or the value type
  if (value === undefined) {
    return 'N/A';
  }
  if (value === null) {
    return 'null';
  }
  if (controlsMap[key]?.type === 'AdhocFilterControl') {
    if (!value.length) {
      return '[]';
    }
    return value
      .map(v => {
        const filterVal =
          v.comparator && v.comparator.constructor === Array
            ? `[${v.comparator.join(', ')}]`
            : v.comparator;
        return `${v.subject} ${v.operator} ${filterVal}`;
      })
      .join(', ');
  }
  if (controlsMap[key]?.type === 'BoundsControl') {
    return `Min: ${value[0]}, Max: ${value[1]}`;
  }
  if (controlsMap[key]?.type === 'CollectionControl') {
    return value.map(v => safeStringify(v)).join(', ');
  }
  if (
    controlsMap[key]?.type === 'MetricsControl' &&
    value.constructor === Array
  ) {
    const formattedValue = value.map(v => v?.label ?? v);
    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value.constructor === Array) {
    const formattedValue = value.map(v => v?.label ?? v);
    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return safeStringify(value);
};

export const getRowsFromDiffs = (diffs, controlsMap) =>
  Object.entries(diffs).map(([key, diff]) => ({
    control: (controlsMap[key] && controlsMap[key].label) || key,
    before: formatValueHandler(diff.before, key, controlsMap),
    after: formatValueHandler(diff.after, key, controlsMap),
  }));

export const isEqualish = (val1, val2) =>
  isEqual(alterForComparison(val1), alterForComparison(val2));

const AlteredSliceTag = props => {
  const prevProps = usePrevious(props);
  const [rows, setRows] = useState([]);
  const [hasDiffs, setHasDiffs] = useState(false);

  const getDiffs = useCallback(() => {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = sanitizeFormData(props.origFormData);
    const cfd = sanitizeFormData(props.currentFormData);

    const fdKeys = Object.keys(cfd);
    const diffs = {};
    fdKeys.forEach(fdKey => {
      if (!ofd[fdKey] && !cfd[fdKey]) {
        return;
      }
      if (['filters', 'having', 'where'].includes(fdKey)) {
        return;
      }
      if (!isEqualish(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    });
    return diffs;
  }, [props.currentFormData, props.origFormData]);

  useEffect(() => {
    const diffs = getDiffs();
    const controlsMap = getControlsForVizType(props.origFormData?.viz_type);
    setRows(getRowsFromDiffs(diffs, controlsMap));
    setHasDiffs(!isEmpty(diffs));
  }, [getDiffs, props]);

  useEffect(() => {
    const diffs = getDiffs();

    const updateStateWithDiffs = () => {
      if (isEqual(prevProps, props)) {
        return;
      }
      setRows(prevRows => getRowsFromDiffs(diffs, prevRows));
      setHasDiffs(!isEmpty(diffs));
    };

    updateStateWithDiffs();
  }, [getDiffs, props, prevProps]);

  const renderModalBody = useCallback(() => {
    const columns = [
      {
        accessor: 'control',
        Header: t('Control'),
      },
      {
        accessor: 'before',
        Header: t('Before'),
      },
      {
        accessor: 'after',
        Header: t('After'),
      },
    ];
    // set the wrap text in the specific columns.
    const columnsForWrapText = ['Control', 'Before', 'After'];

    return (
      <TableView
        columns={columns}
        data={rows}
        pageSize={50}
        className="table-condensed"
        columnsForWrapText={columnsForWrapText}
      />
    );
  }, [rows]);

  const renderTriggerNode = useCallback(
    () => (
      <Tooltip id="difference-tooltip" title={t('Click to see difference')}>
        <StyledLabel className="label">{t('Altered')}</StyledLabel>
      </Tooltip>
    ),
    [],
  );

  if (!hasDiffs) {
    return null;
  }
  // Render the label-warning 'Altered' tag which the user may
  // click to open a modal containing a table summarizing the
  // differences in the slice
  return (
    <ModalTrigger
      triggerNode={renderTriggerNode()}
      modalTitle={t('Chart changes')}
      modalBody={renderModalBody()}
      responsive
    />
  );
};

export default AlteredSliceTag;

AlteredSliceTag.propTypes = propTypes;
