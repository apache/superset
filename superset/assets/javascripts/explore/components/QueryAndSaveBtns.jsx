import React, { PropTypes } from 'react';
import classnames from 'classnames';

const propTypes = {
  canAdd: PropTypes.string.isRequired,
  onQuery: PropTypes.func.isRequired,
};

export default function QueryAndSaveBtns({ canAdd, onQuery }) {
  const saveClasses = classnames('btn btn-default btn-sm', {
    'disabled disabledButton': canAdd !== 'True',
  });

  return (
    <div className="btn-group query-and-save">
      <button type="button" className="btn btn-primary btn-sm" onClick={onQuery}>
        <i className="fa fa-bolt"></i> Query
      </button>
      <button
        type="button"
        className={saveClasses}
        data-target="#save_modal"
        data-toggle="modal"
      >
        <i className="fa fa-plus-circle"></i> Save as
      </button>
    </div>
  );
}

QueryAndSaveBtns.propTypes = propTypes;
