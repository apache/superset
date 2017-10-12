import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import { t } from '../../locales';
import { getExploreUrl } from '../../explore/exploreUtils';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  slice: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  formDataExtra: PropTypes.object,
  removeSlice: PropTypes.func.isRequired,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
};

const SliceHeader = ({ removeSlice, updateSliceName, toggleExpandSlice, forceRefresh,
                       formDataExtra, slice, isExpanded }) => {
  const isCached = slice.is_cached;
  const cachedWhen = moment.utc(slice.cached_dttm).fromNow();
  const refreshTooltip = isCached ?
    t('Served from data cached %s . Click to force refresh.', cachedWhen) :
    t('Force refresh data');
  const onSaveTitle = (newTitle) => {
    if (updateSliceName) {
      updateSliceName(slice.slice_id, newTitle);
    }
  };

  return (
    <div className="row chart-header">
      <div className="col-md-12">
        <div className="header">
          <EditableTitle
            title={slice.slice_name}
            canEdit={!!updateSliceName}
            onSaveTitle={onSaveTitle}
            noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
          />
        </div>
        <div className="chart-controls">
          <div id={'controls_' + slice.slice_id} className="pull-right">
            <a>
              <TooltipWrapper
                placement="top"
                label="move"
                tooltip={t('Move chart')}
              >
                <i className="fa fa-arrows drag" />
              </TooltipWrapper>
            </a>
            <a className={`refresh ${isCached ? 'danger' : ''}`} onClick={() => (forceRefresh())}>
              <TooltipWrapper
                placement="top"
                label="refresh"
                tooltip={refreshTooltip}
              >
                <i className="fa fa-repeat" />
              </TooltipWrapper>
            </a>
            {slice.description &&
            <a onClick={() => (toggleExpandSlice(slice, !isExpanded))}>
              <TooltipWrapper
                placement="top"
                label="description"
                tooltip={t('Toggle chart description')}
              >
                <i className="fa fa-info-circle slice_info" />
              </TooltipWrapper>
            </a>
            }
            <a href={slice.edit_url}>
              <TooltipWrapper
                placement="top"
                label="edit"
                tooltip={t('Edit chart')}
              >
                <i className="fa fa-pencil" />
              </TooltipWrapper>
            </a>
            <a className="exportCSV" href={getExploreUrl(formDataExtra, 'csv')}>
              <TooltipWrapper
                placement="top"
                label="exportCSV"
                tooltip={t('Export CSV')}
              >
                <i className="fa fa-table" />
              </TooltipWrapper>
            </a>
            <a className="exploreChart" href={getExploreUrl(formDataExtra)}>
              <TooltipWrapper
                placement="top"
                label="exploreChart"
                tooltip={t('Explore chart')}
              >
                <i className="fa fa-share" />
              </TooltipWrapper>
            </a>
            <a className="remove-chart" onClick={() => (removeSlice(slice.slice_id))}>
              <TooltipWrapper
                placement="top"
                label="close"
                tooltip={t('Remove chart from dashboard')}
              >
                <i className="fa fa-close" />
              </TooltipWrapper>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

SliceHeader.propTypes = propTypes;

export default SliceHeader;
