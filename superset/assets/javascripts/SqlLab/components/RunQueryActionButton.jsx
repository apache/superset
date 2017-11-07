import React from 'react';
import PropTypes from 'prop-types';
import Button from '../../components/Button';
import { t } from '../../locales';

const propTypes = {
  allowAsync: PropTypes.bool.isRequired,
  dbId: PropTypes.number,
  queryState: PropTypes.string,
  runQuery: PropTypes.func.isRequired,
  selectedText: PropTypes.string,
  stopQuery: PropTypes.func.isRequired,
};
const defaultProps = {
  allowAsync: false,
};

export default function RunQueryActionButton(props) {
  const runBtnText = props.selectedText ? t('Run Selected Query') : t('Run Query');
  const btnStyle = props.selectedText ? 'warning' : 'primary';
  const shouldShowStopBtn = ['running', 'pending'].indexOf(props.queryState) > -1;

  const commonBtnProps = {
    bsSize: 'small',
    bsStyle: btnStyle,
    disabled: !(props.dbId),
  };

  const syncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => props.runQuery(false)}
      key="run-btn"
      tooltip={t('Run query synchronously')}
    >
      <i className="fa fa-refresh" /> {runBtnText}
    </Button>
  );

  const asyncBtn = (
    <Button
      {...commonBtnProps}
      onClick={() => props.runQuery(true)}
      key="run-async-btn"
      tooltip={t('Run query asynchronously')}
    >
      <i className="fa fa-table" /> {runBtnText}
    </Button>
  );

  const stopBtn = (
    <Button
      {...commonBtnProps}
      onClick={props.stopQuery}
    >
      <i className="fa fa-stop" /> {t('Stop')}
    </Button>
  );

  let button;
  if (shouldShowStopBtn) {
    button = stopBtn;
  } else if (props.allowAsync) {
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
RunQueryActionButton.defaultProps = defaultProps;
