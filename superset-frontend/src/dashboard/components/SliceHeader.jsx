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

import { t } from '@superset-ui/core';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';
import SliceHeaderControls from './SliceHeaderControls';

const propTypes = {
  innerRef: PropTypes.func,
  slice: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  updatedDttm: PropTypes.number,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
  annotationError: PropTypes.object,
  sliceName: PropTypes.string,
  supersetCanExplore: PropTypes.bool,
  supersetCanCSV: PropTypes.bool,
  sliceCanEdit: PropTypes.bool,
  componentId: PropTypes.string.isRequired,
  dashboardId: PropTypes.number.isRequired,
  filters: PropTypes.object.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  handleToggleFullSize: PropTypes.func.isRequired,
};

const defaultProps = {
  innerRef: null,
  forceRefresh: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  editMode: false,
  annotationQuery: {},
  annotationError: {},
  cachedDttm: null,
  updatedDttm: null,
  isCached: false,
  isExpanded: false,
  sliceName: '',
  supersetCanExplore: false,
  supersetCanCSV: false,
  sliceCanEdit: false,
};

const annoationsLoading = t('Annotation layers are still loading.');
const annoationsError = t('One ore more annotation layers failed loading.');

class SliceHeader extends React.PureComponent {
  render() {
    const {
      slice,
      isExpanded,
      isCached,
      cachedDttm,
      updatedDttm,
      toggleExpandSlice,
      forceRefresh,
      exploreChart,
      exportCSV,
      innerRef,
      sliceName,
      supersetCanExplore,
      supersetCanCSV,
      sliceCanEdit,
      editMode,
      updateSliceName,
      annotationQuery,
      annotationError,
      componentId,
      dashboardId,
      addDangerToast,
      handleToggleFullSize,
      isFullSize,
    } = this.props;

    return (
      <div className="chart-header" ref={innerRef}>
        <div className="header">
          <EditableTitle
            title={
              sliceName ||
              (editMode
                ? '---' // this makes an empty title clickable
                : '')
            }
            canEdit={editMode}
            emptyText=""
            onSaveTitle={updateSliceName}
            showTooltip={false}
          />
          {!!Object.values(annotationQuery).length && (
            <TooltipWrapper
              label="annotations-loading"
              placement="top"
              tooltip={annoationsLoading}
            >
              <i className="fa fa-refresh warning" />
            </TooltipWrapper>
          )}
          {!!Object.values(annotationError).length && (
            <TooltipWrapper
              label="annoation-errors"
              placement="top"
              tooltip={annoationsError}
            >
              <i className="fa fa-exclamation-circle danger" />
            </TooltipWrapper>
          )}
          {!editMode && (
            <SliceHeaderControls
              slice={slice}
              isCached={isCached}
              isExpanded={isExpanded}
              cachedDttm={cachedDttm}
              updatedDttm={updatedDttm}
              toggleExpandSlice={toggleExpandSlice}
              forceRefresh={forceRefresh}
              exploreChart={exploreChart}
              exportCSV={exportCSV}
              supersetCanExplore={supersetCanExplore}
              supersetCanCSV={supersetCanCSV}
              sliceCanEdit={sliceCanEdit}
              componentId={componentId}
              dashboardId={dashboardId}
              addDangerToast={addDangerToast}
              handleToggleFullSize={handleToggleFullSize}
              isFullSize={isFullSize}
            />
          )}
        </div>
      </div>
    );
  }
}

SliceHeader.propTypes = propTypes;
SliceHeader.defaultProps = defaultProps;

export default SliceHeader;
