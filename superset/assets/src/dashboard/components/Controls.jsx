/* global window */
import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import { t } from '../../locales';

function updateDom(css) {
  const className = 'CssEditor-css';
  const head = document.head || document.getElementsByTagName('head')[0];
  let style = document.querySelector(`.${className}`);

  if (!style) {
    style = document.createElement('style');
    style.className = className;
    style.type = 'text/css';
    head.appendChild(style);
  }
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.innerHTML = css;
  }
}

const propTypes = {
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  slices: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  editMode: PropTypes.bool,
};

const defaultProps = {
  editMode: false,
  slices: [],
};

class Controls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: '',
      cssTemplates: [],
    };
  }

  componentWillMount() {
    updateDom(this.state.css);

    $.get('/csstemplateasyncmodelview/api/read', data => {
      const cssTemplates = data.result.map(row => ({
        value: row.template_name,
        css: row.css,
        label: row.template_name,
      }));
      this.setState({ cssTemplates });
    });
  }

  changeCss(css) {
    this.setState({ css }, () => {
      updateDom(css);
    });
    this.props.onChange();
  }

  render() {
    const {
      dashboardTitle,
      layout,
      filters,
      expandedSlices,
      startPeriodicRender,
      forceRefreshAllCharts,
      onSave,
      editMode,
    } = this.props;

    const emailBody = t('Checkout this dashboard: %s', window.location.href);
    const emailLink =
      'mailto:?Subject=Superset%20Dashboard%20' +
      `${dashboardTitle}&Body=${emailBody}`;

    return (
      <span>
        <DropdownButton
          title="Actions"
          bsSize="small"
          id="bg-nested-dropdown"
          pullRight
        >
          <MenuItem onClick={forceRefreshAllCharts}>
            {t('Force refresh dashboard')}
          </MenuItem>
          <RefreshIntervalModal
            onChange={refreshInterval =>
              startPeriodicRender(refreshInterval * 1000)
            }
            triggerNode={<span>{t('Set auto-refresh interval')}</span>}
          />
          <SaveModal
            dashboardId={this.props.dashboardInfo.id}
            dashboardTitle={dashboardTitle}
            layout={layout}
            filters={filters}
            expandedSlices={expandedSlices}
            onSave={onSave}
            css={this.state.css}
            triggerNode={<span>{editMode ? t('Save') : t('Save as')}</span>}
            isMenuItem
          />
          {editMode && (
            <MenuItem
              target="_blank"
              href={`/dashboardmodelview/edit/${this.props.dashboardInfo.id}`}
            >
              {t('Edit dashboard metadata')}
            </MenuItem>
          )}
          {editMode && (
            <MenuItem
              onClick={() => {
                window.location = emailLink;
              }}
            >
              {t('Email dashboard link')}
            </MenuItem>
          )}
        </DropdownButton>
      </span>
    );
  }
}

Controls.propTypes = propTypes;
Controls.defaultProps = defaultProps;

export default Controls;
