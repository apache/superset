import cx from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';

const propTypes = {
  datasourceLink: PropTypes.string,
  innerRef: PropTypes.func,
  isSelected: PropTypes.bool,
  lastModified: PropTypes.string.isRequired,
  sliceName: PropTypes.string.isRequired,
  style: PropTypes.object,
  visType: PropTypes.string.isRequired,
};

const defaultProps = {
  datasourceLink: '—',
  innerRef: null,
  isSelected: false,
  style: null,
};

function AddSliceCard({
  datasourceLink,
  innerRef,
  isSelected,
  lastModified,
  sliceName,
  style,
  visType,
}) {
  return (
    <div ref={innerRef} className="chart-card-container" style={style}>
      <div className={cx('chart-card', isSelected && 'is-selected')}>
        <div className="card-title">{sliceName}</div>
        <div className="card-body">
          <div className="item">
            <span>{t('Modified')} </span>
            <span>{lastModified}</span>
          </div>
          <div className="item">
            <span>{t('Visualization')} </span>
            <span>{visType}</span>
          </div>
          <div className="item">
            <span>{t('Data source')} </span>
            <span // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: datasourceLink }}
            />
          </div>
        </div>
      </div>
      {isSelected && <div className="is-added-label">{t('Added')}</div>}
    </div>
  );
}

AddSliceCard.propTypes = propTypes;
AddSliceCard.defaultProps = defaultProps;

export default AddSliceCard;
