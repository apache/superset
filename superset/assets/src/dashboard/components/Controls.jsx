/* global window */
import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
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
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  css: PropTypes.string.isRequired,
  slices: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
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
      css: props.css,
      cssTemplates: [],
    };

    this.changeCss = this.changeCss.bind(this);
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
    this.props.updateCss(css);
  }

  render() {
    const {
      dashboardTitle,
      startPeriodicRender,
      forceRefreshAllCharts,
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
          {editMode && (
            <MenuItem
              target="_blank"
              href={`/dashboardmodelview/edit/${this.props.dashboardInfo.id}`}
            >
              {t('Edit dashboard metadata')}
            </MenuItem>
          )}
          {editMode && (
            <MenuItem href={emailLink}>{t('Email dashboard link')}</MenuItem>
          )}
          {editMode && (
            <CssEditor
              triggerNode={<span>{t('Edit CSS')}</span>}
              initialCss={this.state.css}
              templates={this.state.cssTemplates}
              onChange={this.changeCss}
            />
          )}
        </DropdownButton>
      </span>
    );
  }
}

Controls.propTypes = propTypes;
Controls.defaultProps = defaultProps;

export default Controls;
