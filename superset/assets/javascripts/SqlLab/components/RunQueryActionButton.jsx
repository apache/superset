import React, { PropTypes } from 'react';
import Button from '../../components/Button';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
  latestQuery: PropTypes.object.isRequired,
  database: PropTypes.object.isRequired,
  runQuery: PropTypes.func.isRequired,
  stopQuery: PropTypes.func.isRequired,
};

export default function RunQueryActionButton(props) {
  const isSelected = props.queryEditor.selectedText;
  const runBtnText = isSelected ? 'Run Selected Query' : 'Run Query';
  const btnStyle = isSelected ? 'warning' : 'primary';
  const hasAsync = props.database && props.database.allow_run_async;
  const shouldShowStopBtn = props.latestQuery &&
    ['running', 'pending'].indexOf(props.latestQuery.state) > -1;
  const asyncToolTip = 'Run query asynchronously';

  const commonBtnProps = {
    bsSize: 'small',
    bsStyle: btnStyle,
    disabled: !(props.queryEditor.dbId),
  };

  const syncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => props.runQuery(false)}
      key="run-btn"
    >
      <i className="fa fa-table" /> {runBtnText}
    </Button>
  );

  const asyncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => props.runQuery(true)}
      key="run-async-btn"
      tooltip={asyncToolTip}
    >
      <i className="fa fa-table" /> {runBtnText}
    </Button>
  );

  const stopBtn = (
    <Button
      {...commonBtnProps}
      onClick={props.stopQuery}
    >
      <i className="fa fa-stop" /> Stop
    </Button>
  );

  let button;
  if (shouldShowStopBtn) {
    button = stopBtn;
  } else if (hasAsync) {
    button = asyncBtn;
  } else {
    button = syncBtn;
  }

  return (
    <div className="inline m-r-5 pull-left">
      {button}
    </div>
  );
}

RunQueryActionButton.propTypes = propTypes;
