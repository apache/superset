const $ = window.$ = require('jquery');
import React from 'react';

import { ButtonGroup } from 'react-bootstrap';
import Button from '../../components/Button';
import { showModal } from '../../modules/utils';
import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import CodeModal from './CodeModal';
import SliceAdder from './SliceAdder';

const propTypes = {
  table: React.PropTypes.object,
  dashboard: React.PropTypes.object.isRequired,
};

const defaultProps = {
  actions: {},
};

class Controls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: props.dashboard.css,
      cssTemplates: [],
    };
  }
  refresh() {
    this.props.dashboard.sliceObjects.forEach((slice) => {
      slice.render(true);
    });
  }
  componentWillMount() {
    $.get('/csstemplateasyncmodelview/api/read', (data) => {
      const cssTemplates = data.result.map((row) => ({
        value: row.template_name,
        css: row.css,
        label: row.template_name,
      }));
      this.setState({ cssTemplates });
    });
  }
  save() {
    const dashboard = this.props.dashboard;
    const expandedSlices = {};
    $.each($('.slice_info'), function () {
      const widget = $(this).parents('.widget');
      const sliceDescription = widget.find('.slice_description');
      if (sliceDescription.is(':visible')) {
        expandedSlices[$(widget).attr('data-slice-id')] = true;
      }
    });
    const positions = dashboard.reactGridLayout.serialize();
    const data = {
      positions,
      css: this.state.css,
      expanded_slices: expandedSlices,
    };
    $.ajax({
      type: 'POST',
      url: '/caravel/save_dash/' + dashboard.id + '/',
      data: {
        data: JSON.stringify(data),
      },
      success() {
        showModal({
          title: 'Success',
          body: 'This dashboard was saved successfully.',
        });
      },
      error(error) {
        const errorMsg = this.getAjaxErrorMsg(error);
        showModal({
          title: 'Error',
          body: 'Sorry, there was an error saving this dashboard: </ br>' + errorMsg,
        });
      },
    });
  }
  changeCss(css) {
    this.setState({ css });
  }
  render() {
    const dashboard = this.props.dashboard;
    const canSave = dashboard.context.dash_save_perm;
    return (
      <ButtonGroup>
        <Button
          tooltip="Force refresh the whole dashboard"
          onClick={this.refresh.bind(this)}
        >
          <i className="fa fa-refresh" />
        </Button>
        <SliceAdder
          dashboard={dashboard}
          triggerNode={
            <i className="fa fa-plus" />
          }
        />
        <RefreshIntervalModal
          onChange={refreshInterval => dashboard.startPeriodicRender(refreshInterval * 1000)}
          triggerNode={
            <i className="fa fa-clock-o" />
          }
        />
        <CodeModal
          codeCallback={dashboard.readFilters.bind(dashboard)}
          triggerNode={<i className="fa fa-filter" />}
        />
        <CssEditor
          dashboard={dashboard}
          triggerNode={
            <i className="fa fa-css3" />
          }
          initialCss={dashboard.css}
          templates={this.state.cssTemplates}
          onChange={this.changeCss.bind(this)}
        />
        <Button
          disabled={!canSave}
          onClick={() => {
            window.location = `/dashboardmodelview/edit/${dashboard.id}`;
          }}
          tooltip="Edit this dashboard's property"
        >
          <i className="fa fa-edit" />
        </Button>
        <Button
          disabled={!canSave}
          tooltip="Save the current positioning and CSS"
          onClick={this.save.bind(this)}
        >
          <i className="fa fa-save" />
        </Button>
      </ButtonGroup>
    );
  }
}
Controls.propTypes = propTypes;
Controls.defaultProps = defaultProps;

export default Controls;
