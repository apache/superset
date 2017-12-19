import React from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import SliceAdder from './SliceAdder';
import { t } from '../../locales';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const $ = window.$ = require('jquery');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  slices: PropTypes.array,
  userId: PropTypes.string.isRequired,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  renderSlices: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  editMode: PropTypes.bool,
};

function MenuItemContent({ faIcon, text, tooltip, children }) {
  return (
    <span>
      <i className={`fa fa-${faIcon}`} /> {text} {''}
      <InfoTooltipWithTrigger
        tooltip={tooltip}
        label={`dash-${faIcon}`}
        placement="top"
      />
      {children}
    </span>
  );
}
MenuItemContent.propTypes = {
  faIcon: PropTypes.string.isRequired,
  text: PropTypes.string,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

function ActionMenuItem(props) {
  return (
    <MenuItem onClick={props.onClick}>
      <MenuItemContent {...props} />
    </MenuItem>
  );
}
ActionMenuItem.propTypes = {
  onClick: PropTypes.func,
};

class Controls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: props.dashboard.css || '',
      cssTemplates: [],
    };
    this.refresh = this.refresh.bind(this);
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
  refresh() {
    // Force refresh all slices
    this.props.renderSlices(true);
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
    const { dashboard, userId, filters,
      addSlicesToDashboard, startPeriodicRender,
      serialize, onSave, editMode } = this.props;
    const emailBody = t('Checkout this dashboard: %s', window.location.href);
    const emailLink = 'mailto:?Subject=Superset%20Dashboard%20'
      + `${dashboard.dashboard_title}&Body=${emailBody}`;
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
            faIcon="refresh"
            onClick={this.refresh}
          />
          <RefreshIntervalModal
            onChange={refreshInterval => startPeriodicRender(refreshInterval * 1000)}
            triggerNode={
              <MenuItemContent
                text={t('Set autorefresh')}
                tooltip={t('Set the auto-refresh interval for this session')}
                faIcon="clock-o"
              />
            }
          />
          <SaveModal
            dashboard={dashboard}
            filters={filters}
            serialize={serialize}
            onSave={onSave}
            css={this.state.css}
            triggerNode={
              <MenuItemContent
                text={saveText}
                tooltip={t('Save the dashboard')}
                faIcon="save"
              />
            }
          />
          {editMode &&
            <ActionMenuItem
              text={t('Edit properties')}
              tooltip={t("Edit the dashboards's properties")}
              faIcon="edit"
              onClick={() => { window.location = `/dashboardmodelview/edit/${dashboard.id}`; }}
            />
          }
          {editMode &&
            <ActionMenuItem
              text={t('Email')}
              tooltip={t('Email a link to this dashbaord')}
              onClick={() => { window.location = emailLink; }}
              faIcon="envelope"
            />
          }
          {editMode &&
            <SliceAdder
              dashboard={dashboard}
              addSlicesToDashboard={addSlicesToDashboard}
              userId={userId}
              triggerNode={
                <MenuItemContent
                  text={t('Add Slices')}
                  tooltip={t('Add some slices to this dashbaord')}
                  faIcon="plus"
                />
              }
            />
          }
          {editMode &&
            <CssEditor
              dashboard={dashboard}
              triggerNode={
                <MenuItemContent
                  text={t('Edit CSS')}
                  tooltip={t('Change the style of the dashboard using CSS code')}
                  faIcon="css3"
                />
              }
              initialCss={this.state.css}
              templates={this.state.cssTemplates}
              onChange={this.changeCss.bind(this)}
            />
          }
        </DropdownButton>
      </span>
    );
  }
}
Controls.propTypes = propTypes;

export default Controls;
