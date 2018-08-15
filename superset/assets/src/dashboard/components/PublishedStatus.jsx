55e910a74826 import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import TooltipWrapper from '../../components/TooltipWrapper';
import { t } from '../../locales';

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  fetchPublished: PropTypes.func.isRequired,
  savePublished: PropTypes.func.isRequired,
  isPublished: PropTypes.bool.isRequired,
};

export default class PublishedStatus extends React.Component {
  componentDidMount() {
    this.onClick = this.onClick.bind(this);
    this.props.fetchPublished(this.props.dashboardId);
  }

  onClick(e) {
    e.preventDefault();
    this.props.savePublished(this.props.dashboardId, !this.props.isPublished);
  }

  render() {
    const iconClassNames = cx('fa', {
      'fa-eye': this.props.isPublished,
      'fa-eye-slash': !this.props.isPublished,
    });

    const buttonStyle = { border: 'none' };

    return (
      <TooltipWrapper
        label="publish/unpublish"
        tooltip={t('Click to publish/unpublish this dashboard')}
      >
        <button
          onClick={this.onClick}
          className="publish-icon"
          style={buttonStyle}
        >
          <i className={iconClassNames} />
        </button>
      </TooltipWrapper>
    );
  }
}

PublishedStatus.propTypes = propTypes;
