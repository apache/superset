import React from 'react';
import PropTypes from 'prop-types';

import { t } from '@superset-ui/translation';
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
  sliceCanEdit: PropTypes.bool,
};

const defaultProps = {
  innerRef: null,
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
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
      sliceCanEdit,
      editMode,
      updateSliceName,
      annotationQuery,
      annotationError,
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
              sliceCanEdit={sliceCanEdit}
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
