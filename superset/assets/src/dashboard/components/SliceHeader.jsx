import React from 'react';
import PropTypes from 'prop-types';

import { t } from '../../locales';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';
import SliceHeaderControls from './SliceHeaderControls';

const propTypes = {
  innerRef: PropTypes.func,
  slice: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
  annotationError: PropTypes.object,
  sliceName: PropTypes.string,
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
  isCached: false,
  isExpanded: false,
  sliceName: '',
};

class SliceHeader extends React.PureComponent {
  render() {
    const {
      slice,
      isExpanded,
      isCached,
      cachedDttm,
      toggleExpandSlice,
      forceRefresh,
      exploreChart,
      exportCSV,
      innerRef,
      sliceName,
    } = this.props;

    const annoationsLoading = t('Annotation layers are still loading.');
    const annoationsError = t('One ore more annotation layers failed loading.');

    return (
      <div className="chart-header" ref={innerRef}>
        <div className="header">
          <EditableTitle
            title={sliceName}
            canEdit={this.props.editMode}
            onSaveTitle={this.props.updateSliceName}
            showTooltip={this.props.editMode}
          />
          {!!Object.values(this.props.annotationQuery).length && (
            <TooltipWrapper
              label="annotations-loading"
              placement="top"
              tooltip={annoationsLoading}
            >
              <i className="fa fa-refresh warning" />
            </TooltipWrapper>
          )}
          {!!Object.values(this.props.annotationError).length && (
            <TooltipWrapper
              label="annoation-errors"
              placement="top"
              tooltip={annoationsError}
            >
              <i className="fa fa-exclamation-circle danger" />
            </TooltipWrapper>
          )}
          {!this.props.editMode && (
            <SliceHeaderControls
              slice={slice}
              isCached={isCached}
              isExpanded={isExpanded}
              cachedDttm={cachedDttm}
              toggleExpandSlice={toggleExpandSlice}
              forceRefresh={forceRefresh}
              exploreChart={exploreChart}
              exportCSV={exportCSV}
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
