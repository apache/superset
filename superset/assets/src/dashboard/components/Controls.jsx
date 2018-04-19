import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { DropdownButton } from 'react-bootstrap';

import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import { ActionMenuItem, MenuItemContent } from './ActionMenuItem';
import { t } from '../../locales';

const propTypes = {
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  slices: PropTypes.array,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  forceRefreshAllCharts: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  editMode: PropTypes.bool,
};

class Controls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: '',
      cssTemplates: [],
    };
    this.toggleModal = this.toggleModal.bind(this);
    this.updateDom = this.updateDom.bind(this);
  }
  componentWillMount() {
    this.updateDom(this.state.css);

    $.get('/csstemplateasyncmodelview/api/read', (data) => {
      const cssTemplates = data.result.map(row => ({
        value: row.template_name,
        css: row.css,
        label: row.template_name,
      }));
      this.setState({ cssTemplates });
    });
  }
  toggleModal(modal) {
    let currentModal;
    if (modal !== this.state.currentModal) {
      currentModal = modal;
    }
    this.setState({ currentModal });
  }
  changeCss(css) {
    this.setState({ css }, () => {
      this.updateDom(css);
    });
    this.props.onChange();
  }
  updateDom(css) {
    const className = 'CssEditor-css';
    const head = document.head || document.getElementsByTagName('head')[0];
    let style = document.querySelector('.' + className);

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
  render() {
    const { dashboardTitle, layout, filters, expandedSlices,
      startPeriodicRender, forceRefreshAllCharts, onSave,
      editMode } = this.props;
    const emailBody = t('Checkout this dashboard: %s', window.location.href);
    const emailLink = 'mailto:?Subject=Superset%20Dashboard%20'
      + `${dashboardTitle}&Body=${emailBody}`;
    let saveText = t('Save as');
    if (editMode) {
      saveText = t('Save');
    }
    return (
      <span>
        <DropdownButton title="Actions" bsSize="small" id="bg-nested-dropdown" pullRight>
          <ActionMenuItem
            text={t('Force Refresh')}
            tooltip={t('Force refresh the whole dashboard')}
            onClick={forceRefreshAllCharts}
          />
          <RefreshIntervalModal
            onChange={refreshInterval => startPeriodicRender(refreshInterval * 1000)}
            triggerNode={
              <MenuItemContent
                text={t('Set autorefresh')}
                tooltip={t('Set the auto-refresh interval for this session')}
              />
            }
          />
          <SaveModal
            dashboardId={this.props.dashboardInfo.id}
            dashboardTitle={dashboardTitle}
            layout={layout}
            filters={filters}
            expandedSlices={expandedSlices}
            onSave={onSave}
            css={this.state.css}
            triggerNode={
              <MenuItemContent
                text={saveText}
                tooltip={t('Save the dashboard')}
              />
            }
          />
          {editMode &&
            <ActionMenuItem
              text={t('Edit properties')}
              tooltip={t("Edit the dashboards's properties")}
              onClick={() => { window.location = `/dashboardmodelview/edit/${this.props.dashboardInfo.id}`; }}
            />
          }
          {editMode &&
            <ActionMenuItem
              text={t('Email')}
              tooltip={t('Email a link to this dashboard')}
              onClick={() => { window.location = emailLink; }}
            />
          }
        </DropdownButton>
      </span>
    );
  }
}
Controls.propTypes = propTypes;

export default Controls;
