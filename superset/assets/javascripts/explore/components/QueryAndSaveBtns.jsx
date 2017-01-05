import React, { PropTypes } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import classnames from 'classnames';

const propTypes = {
  canAdd: PropTypes.string.isRequired,
  onQuery: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  disabled: PropTypes.bool,
};

const defaultProps = {
  onSave: () => {},
  disabled: false,
};

export default function QueryAndSaveBtns({ canAdd, onQuery, onSave, disabled }) {
  const saveClasses = classnames({
    'disabled disabledButton': canAdd !== 'True',
  });

  return (
    <ButtonGroup className="query-and-save">
      <Button
        id="query_button"
        onClick={onQuery}
        bsSize="small"
        disabled={disabled}
        bsStyle="primary"
      >
        <i className="fa fa-bolt" /> Query
      </Button>
      <Button
        className={saveClasses}
        bsSize="small"
        data-target="#save_modal"
        data-toggle="modal"
        disabled={disabled}
        onClick={onSave}
      >
        <i className="fa fa-plus-circle"></i> Save as
      </Button>
    </ButtonGroup>
  );
}

QueryAndSaveBtns.propTypes = propTypes;
QueryAndSaveBtns.defaultProps = defaultProps;
