import React, { PropTypes } from 'react';
import ModalTrigger from './../../components/ModalTrigger';

const propTypes = {
  query: PropTypes.string,
};

const defaultProps = {
  query: '',
};

export default function DisplayQueryButton({ query }) {
  const modalBody = (<pre>{query}</pre>);
  return (
    <ModalTrigger
      isButton
      triggerNode={<span>Query</span>}
      modalTitle="Query"
      modalBody={modalBody}
    />
  );
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
