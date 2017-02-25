import React, { PropTypes } from 'react';
import { ButtonGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Button from '../../components/Button';
import classnames from 'classnames';

const propTypes = {
  canAdd: PropTypes.string.isRequired,
  onQuery: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onStop: PropTypes.func,
  loading: PropTypes.bool,
  errorMessage: PropTypes.string,
};

const defaultProps = {
  onStop: () => {},
  onSave: () => {},
  disabled: false,
};

export default function QueryAndSaveBtns(
  { canAdd, onQuery, onSave, onStop, loading, errorMessage }) {
  const saveClasses = classnames({
    'disabled disabledButton': canAdd !== 'True',
  });
  const qryButtonStyle = errorMessage ? 'danger' : 'primary';
  const saveButtonDisabled = errorMessage ? true : loading;
  const qryOrStopButton = loading ? (
    <Button
      onClick={onStop}
      bsStyle="warning"
    >
      <i className="fa fa-stop-circle-o" /> Stop
    </Button>
  ) : (
    <Button
      className="query"
      onClick={onQuery}
      bsStyle={qryButtonStyle}
    >
      <i className="fa fa-bolt" /> Query
    </Button>
  );

  return (
    <div>
      <ButtonGroup className="query-and-save">
        {qryOrStopButton}
        <Button
          className={saveClasses}
          data-target="#save_modal"
          data-toggle="modal"
          disabled={saveButtonDisabled}
          onClick={onSave}
        >
          <i className="fa fa-plus-circle"></i> Save as
        </Button>
      </ButtonGroup>
      {errorMessage &&
        <span>
          {' '}
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={'query-error-tooltip'}>
                {errorMessage}
              </Tooltip>}
          >
            <i className="fa fa-exclamation-circle text-danger fa-lg" />
          </OverlayTrigger>
        </span>
      }
    </div>
  );
}

QueryAndSaveBtns.propTypes = propTypes;
QueryAndSaveBtns.defaultProps = defaultProps;
