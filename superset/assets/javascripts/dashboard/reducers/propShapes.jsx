import PropTypes from 'prop-types';

export const slicePropShape = PropTypes.shape({ // eslint-disable-line
  slice_id: PropTypes.number.isRequired,
  slice_url: PropTypes.string.isRequired,
  slice_name: PropTypes.string.isRequired,
  edit_url: PropTypes.string.isRequired,
  datasource_name: PropTypes.string,
  datasource_link: PropTypes.string,
  changed_on: PropTypes.number,
  modified: PropTypes.string,
  viz_type: PropTypes.string.isRequired,
  description: PropTypes.string,
  description_markeddown: PropTypes.string,
});
