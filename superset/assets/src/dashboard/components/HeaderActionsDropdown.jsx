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
import URLShortLinkModal from '../../components/URLShortLinkModal';
import getDashboardUrl from '../util/getDashboardUrl';

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
  userCanSave: PropTypes.bool.isRequired,
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
      userCanSave,
    } = this.props;

    const emailTitle = t('Superset Dashboard');
    const emailSubject = `${emailTitle} ${dashboardTitle}`;
    const emailBody = t('Check out this dashboard: ');

    return (
      <DropdownButton
        title=""
        id="save-dash-split-button"
        bsStyle={hasUnsavedChanges ? 'primary' : undefined}
        bsSize="small"
        pullRight
      >
        {userCanSave && (
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
        )}

        {hasUnsavedChanges &&
          userCanSave && (
            <div>
              <MenuItem
                eventKey="discard"
                onSelect={HeaderActionsDropdown.discardChanges}
              >
                {t('Discard changes')}
              </MenuItem>
            </div>
          )}

        {userCanSave && <MenuItem divider />}

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

        <URLShortLinkModal
          url={getDashboardUrl(window.location.pathname, this.props.filters)}
          emailSubject={emailSubject}
          emailContent={emailBody}
          addDangerToast={this.props.addDangerToast}
          isMenuItem
          triggerNode={<span>{t('Share dashboard')}</span>}
        />

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
