import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'react-bootstrap';

import { STATE_BSSTYLE_MAP } from '../constants';

const propTypes = {
  query: PropTypes.object.isRequired,
};

export default function QueryStateLabel({ query }) {
  const bsStyle = STATE_BSSTYLE_MAP[query.state];
  return (
    <Label className="m-r-3" bsStyle={bsStyle}>
      {query.state}
    </Label>
  );
}
QueryStateLabel.propTypes = propTypes;
