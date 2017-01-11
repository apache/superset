import React, { PropTypes } from 'react';
import { ButtonGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Button from '../../components/Button';
import classnames from 'classnames';

const propTypes = {
  canAdd: PropTypes.string.isRequired,
  onQuery: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  disabled: PropTypes.bool,
  errorMessage: PropTypes.string,
};

const defaultProps = {
  onSave: () => {},
  disabled: false,
};

export default function QueryAndSaveBtns({ canAdd, onQuery, onSave, disabled, errorMessage }) {
  const saveClasses = classnames({
    'disabled disabledButton': canAdd !== 'True',
  });
  const qryButtonStyle = errorMessage ? 'danger' : 'primary';
  const qryButtonDisabled = errorMessage ? true : disabled;

  return (
    <div>
      <ButtonGroup className="query-and-save">
        <Button
          id="query_button"
          onClick={onQuery}
          disabled={qryButtonDisabled}
          bsStyle={qryButtonStyle}
        >
          <i className="fa fa-bolt" /> Query
        </Button>
        <Button
          className={saveClasses}
          data-target="#save_modal"
          data-toggle="modal"
          disabled={qryButtonDisabled}
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
