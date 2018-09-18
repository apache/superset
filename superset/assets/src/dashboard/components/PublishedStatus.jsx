import React from 'react';
import PropTypes from 'prop-types';
import TooltipWrapper from '../../components/TooltipWrapper';
import { t } from '../../locales';

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  fetchPublished: PropTypes.func.isRequired,
  isPublished: PropTypes.bool.isRequired,
};

export default class PublishedStatus extends React.Component {
  componentDidMount() {
    this.init = false;
    Promise.resolve(this.props.fetchPublished(this.props.dashboardId)).then(
      (this.init = true),
    );
  }

  render() {
    const divStyle = {
      border: '1px dotted black',
      'background-color': '#F9F9F9',
      padding: '3px 7px 3px 7px',
      'font-family': 'Monospace',
      'font-size': '15px',
    };

    const tooltip =
      'This dashboard is not published which means it will not show up in the list of dashboards.' +
      ' Favorite it to see it there or access it by using the URL directly.';

    if (!this.props.isPublished && this.init) {
      return (
        <TooltipWrapper
          label="Unpublished Dashboard"
          placement="bottom"
          tooltip={t(tooltip)}
        >
          <div style={divStyle}>DRAFT</div>
        </TooltipWrapper>
      );
    }

    return null; // Don't show anything for this dashboard if it's published
  }
}

PublishedStatus.propTypes = propTypes;
