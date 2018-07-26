/* global window */
import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import injectCustomCss from '../util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from '../util/constants';
import { t } from '../../locales';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  css: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  userCanEdit: PropTypes.bool.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
};

const defaultProps = {};

class HeaderActionsDropdown extends React.PureComponent {
  static discardChanges() {
    window.location.reload();
  }

  constructor(props) {
    super(props);
    this.state = {
      css: props.css,
      cssTemplates: [],
    };

    this.changeCss = this.changeCss.bind(this);
  }

  componentWillMount() {
    injectCustomCss(this.state.css);

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
      injectCustomCss(css);
    });
    this.props.onChange();
    this.props.updateCss(css);
  }

  render() {
    const {
      dashboardTitle,
      dashboardId,
      startPeriodicRender,
      forceRefreshAllCharts,
      editMode,
      css,
      hasUnsavedChanges,
      layout,
      filters,
      expandedSlices,
      onSave,
      userCanEdit,
    } = this.props;

    const emailBody = t('Check out this dashboard: %s', window.location.href);
    const emailLink = `mailto:?Subject=Superset%20Dashboard%20${dashboardTitle}&Body=${emailBody}`;

    return (
      <DropdownButton
        title=""
        id="save-dash-split-button"
        bsStyle={hasUnsavedChanges ? 'primary' : undefined}
        bsSize="small"
        pullRight
      >
        <SaveModal
          addSuccessToast={this.props.addSuccessToast}
          addDangerToast={this.props.addDangerToast}
          dashboardId={dashboardId}
          dashboardTitle={dashboardTitle}
          saveType={SAVE_TYPE_NEWDASHBOARD}
          layout={layout}
          filters={filters}
          expandedSlices={expandedSlices}
          css={css}
          onSave={onSave}
          isMenuItem
          triggerNode={<span>{t('Save as')}</span>}
          canOverwrite={userCanEdit}
        />
        {hasUnsavedChanges && (
          <MenuItem
            eventKey="discard"
            onSelect={HeaderActionsDropdown.discardChanges}
          >
            {t('Discard changes')}
          </MenuItem>
        )}

        <MenuItem divider />

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
            href={`/dashboardmodelview/edit/${dashboardId}`}
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
    );
  }
}

HeaderActionsDropdown.propTypes = propTypes;
HeaderActionsDropdown.defaultProps = defaultProps;

export default HeaderActionsDropdown;
