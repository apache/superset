import React, { PropTypes } from 'react';

const propTypes = {
  slice: PropTypes.object.isRequired,
  removeSlice: PropTypes.func.isRequired,
  expandedSlices: PropTypes.object,
};

function SliceCell({ expandedSlices, removeSlice, slice }) {
  return (
    <div className="slice-cell" id={`${slice.token}-cell`}>
      <div className="chart-header">
        <div className="row">
          <div className="col-md-12 header">
            <span>{slice.slice_name}</span>
          </div>
          <div className="col-md-12 chart-controls">
            <div className="pull-right">
              <a title="Move chart" data-toggle="tooltip">
                <i className="fa fa-arrows drag" />
              </a>
              <a className="refresh" title="Force refresh data" data-toggle="tooltip">
                <i className="fa fa-repeat" />
              </a>
              {slice.description &&
                <a title="Toggle chart description">
                  <i
                    className="fa fa-info-circle slice_info"
                    title={slice.description}
                    data-toggle="tooltip"
                  />
                </a>
              }
              <a
                href={slice.edit_url}
                title="Edit chart"
                data-toggle="tooltip"
              >
                <i className="fa fa-pencil" />
              </a>
              <a href={slice.slice_url} title="Explore chart" data-toggle="tooltip">
                <i className="fa fa-share" />
              </a>
              <a
                className="remove-chart"
                title="Remove chart from dashboard"
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
      >

      </div>
      <div className="row chart-container">
        <input type="hidden" value="false" />
        <div id={slice.token} className="token col-md-12">
          <img
            src="/static/assets/images/loading.gif"
            className="loading"
            alt="loading"
          />
          <div className="slice_container" id={slice.token + '_con'}></div>
        </div>
      </div>
    </div>
  );
}

SliceCell.propTypes = propTypes;

export default SliceCell;
