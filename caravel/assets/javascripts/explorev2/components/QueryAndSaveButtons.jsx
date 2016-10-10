import React, { PropTypes } from 'react';
import classnames from 'classnames';

const propTypes = {
  canAdd: PropTypes.string.isRequired,
  onQuery: PropTypes.func.isRequired,
};

export default function QueryAndSaveBtns({ canAdd, onQuery }) {
  const saveClasses = classnames('btn btn-default btn-block btn-sm', {
    'disabled disabledButton': canAdd !== 'True',
  });

  return (
    <div className="btn-group btn-group-justified query-and-save">
      <a className="btn btn-primary btn-block btn-sm" onClick={onQuery}>
        <i className="fa fa-bolt"></i> Query
      </a>
      <a
        className={saveClasses}
        data-target="#save_modal"
        data-toggle="modal"
      >
        <i className="fa fa-plus-circle"></i> Save as
      </a>
    </div>
  );
}

QueryAndSaveBtns.propTypes = propTypes;
