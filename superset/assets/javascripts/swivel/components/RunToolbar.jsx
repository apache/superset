import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DropdownButton, ButtonGroup, Button,
  SplitButton, MenuItem, OverlayTrigger, Popover, Well } from 'react-bootstrap';
import { abort, setRun, setAutoRun, reset } from '../actions/globalActions';
import { getExploreUrl, getSwivelUrl } from '../../explore/exploreUtils';
import { getSessions, deleteSessions } from '../SessionManager';

const propTypes = {
  run: PropTypes.bool,
  autoRun: PropTypes.bool,
  isRunning: PropTypes.bool,
  formData: PropTypes.object,
  abortQuery: PropTypes.func,
  runQuery: PropTypes.func,
  setMode: PropTypes.func,
  resetSwivel: PropTypes.func,
  outdated: PropTypes.bool,
  error: PropTypes.string,
};

class RunToolbar extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { sessions: [] };
  }

  popoverUrl(formData) {
    const url = `${window.location.origin}${getSwivelUrl(formData, true)}`;
    return (
      <Popover id="popover-positioned-bottom" title="Link to current Swivel">
        <Well style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} bsSize="small">{url}</Well>
      </Popover>
    );
  }

  runButtonStyle(autoRun, isRunning) {
    if (isRunning) {
      return 'warning';
    }
    return (autoRun ? 'success' : 'default');
  }

  renderSpinner() {
    return (
      <div>
        Stop &nbsp; <span><i className="fa fa-circle-o-notch fa-spin" /></span>
      </div>
    );
  }

  render() {
    const { autoRun, abortQuery, runQuery, setMode, isRunning,
      resetSwivel, formData, error, outdated } = this.props;
    const disabled = !formData || outdated || !!error;
    let title = autoRun ? 'Auto Run' : 'Run';
    title = isRunning ? this.renderSpinner() : title;
    return (
      <div id="run-tool-bar">
        <ButtonGroup>
          <Button
            bsSize="xsmall"
            disabled={disabled}
            onClick={() => window.open(getExploreUrl(formData))}
          >
            as Slice
          </Button>
          <DropdownButton
            bsSize="xsmall"
            title={<span><i className="fa fa-eraser" /></span>}
            noCaret
            pullRight
            id="reset-dropdown"
            onToggle={() => this.setState({ sessions: getSessions() })}
          >
            <MenuItem onClick={() => resetSwivel(false)}>
              Clear Session
            </MenuItem>
            <MenuItem onClick={() => resetSwivel(true)}>
              Clear Session & History
            </MenuItem>
            <MenuItem divider />
            <MenuItem header>Switch Session</MenuItem>
            <MenuItem href={'?new=true'} target="_blank">
              New Session
            </MenuItem>
            {
              this.state.sessions.map(({ id, name }) =>
              (<MenuItem key={id} href={`?session=${id}`}>
                {`${name} (${id.substring(0, 7)})`}
              </MenuItem>))
            }
            <MenuItem divider />
            <MenuItem
              onClick={deleteSessions}
              href={'?reset=true'}
            >Delete all Sessions
            </MenuItem>
          </DropdownButton>
          <OverlayTrigger
            trigger="click"
            rootClose
            placement="bottom"
            overlay={this.popoverUrl(formData)}
          >
            <Button
              bsSize="xsmall"
              disabled={disabled}
            >
              <span><i className="fa fa-external-link" /></span>
            </Button>
          </OverlayTrigger>
        </ButtonGroup>
        <div className="run-button">
          <SplitButton
            pullRight
            bsSize="small"
            bsStyle={this.runButtonStyle(autoRun, isRunning)}
            id="run-button-mode"
            title={title}
            onClick={isRunning ? abortQuery : runQuery}
            onSelect={i => setMode(i === '0')}
          >
            <MenuItem eventKey="0"> Auto </MenuItem>
            <MenuItem eventKey="1"> Manual </MenuItem>
          </SplitButton>
        </div>
      </div>
    );
  }
}

RunToolbar.propTypes = propTypes;

const mapStateToProps = state => ({
  run: state.controls.run,
  autoRun: state.controls.autoRun,
  isRunning: state.controls.isRunning,
  error: state.controls.error,
  formData: state.vizData.formData,
  outdated: state.vizData.outdated,
});

const mapDispatchToProps = dispatch => ({
  runQuery: () => {
    dispatch(setRun(true));
  },
  abortQuery: () => {
    dispatch(abort());
  },
  setMode: (autoRun) => {
    dispatch(setAutoRun(autoRun));
  },
  resetSwivel: (clearHistory) => {
    dispatch(reset(clearHistory));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(RunToolbar);

