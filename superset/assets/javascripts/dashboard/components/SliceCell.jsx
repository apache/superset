/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';

import { t } from '../../locales';
import { getExploreUrl } from '../../explore/exploreUtils';
import EditableTitle from '../../components/EditableTitle';

const propTypes = {
  slice: PropTypes.object.isRequired,
  removeSlice: PropTypes.func.isRequired,
  updateSliceName: PropTypes.func,
  expandedSlices: PropTypes.object,
};

const SliceCell = ({ expandedSlices, removeSlice, slice, updateSliceName }) => {
  const onSaveTitle = (newTitle) => {
    if (updateSliceName) {
      updateSliceName(slice.slice_id, newTitle);
    }
  };

  return (
    <div className="slice-cell" id={`${slice.slice_id}-cell`}>
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
              <a title={t('Move chart')} data-toggle="tooltip">
                <i className="fa fa-arrows drag" />
              </a>
              <a className="refresh" title={t('Force refresh data')} data-toggle="tooltip">
                <i className="fa fa-repeat" />
              </a>
              {slice.description &&
                <a title={t('Toggle chart description')}>
                  <i
                    className="fa fa-info-circle slice_info"
                    title={slice.description}
                    data-toggle="tooltip"
                  />
                </a>
              }
              <a
                href={slice.edit_url}
                title={t('Edit chart')}
                data-toggle="tooltip"
              >
                <i className="fa fa-pencil" />
              </a>
              <a
                className="exportCSV"
                href={getExploreUrl(slice.form_data, 'csv')}
                title={t('Export CSV')}
                data-toggle="tooltip"
              >
                <i className="fa fa-table" />
              </a>
              <a
                className="exploreChart"
                href={getExploreUrl(slice.form_data)}
                title={t('Explore chart')}
                data-toggle="tooltip"
              >
                <i className="fa fa-share" />
              </a>
              <a
                className="remove-chart"
                title={t('Remove chart from dashboard')}
                data-toggle="tooltip"
              >
                <i
                  className="fa fa-close"
                  onClick={() => { removeSlice(slice.slice_id); }}
                />
              </a>
            </div>
          </div>
        </div>
      </div>
      <div
        className="slice_description bs-callout bs-callout-default"
        style={
          expandedSlices &&
          expandedSlices[String(slice.slice_id)] ? {} : { display: 'none' }
        }
        dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
      />
      <div className="row chart-container">
        <input type="hidden" value="false" />
        <div id={'token_' + slice.slice_id} className="token col-md-12">
          <img
            src="/static/assets/images/loading.gif"
            className="loading"
            alt="loading"
          />
          <div
            id={'con_' + slice.slice_id}
            className={`slice_container ${slice.form_data.viz_type}`}
          />
        </div>
      </div>
    </div>
  );
};

SliceCell.propTypes = propTypes;

export default SliceCell;
