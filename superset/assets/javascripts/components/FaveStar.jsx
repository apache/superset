import React, { PropTypes } from 'react';
import cx from 'classnames';

const propTypes = {
  sliceId: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
  isStarred: PropTypes.bool.isRequired,
};

export default class FaveStar extends React.Component {
  componentDidMount() {
    this.props.actions.fetchFaveStar(this.props.sliceId);
  }

  onClick(e) {
    e.preventDefault();
    this.props.actions.saveFaveStar(this.props.sliceId, this.props.isStarred);
  }

  render() {
    const iconClassNames = cx('fa', {
      'fa-star': this.props.isStarred,
      'fa-star-o': !this.props.isStarred,
    });

    return (
      <a
        href="#"
        onClick={this.onClick.bind(this)}
        title="Click to favorite/unfavorite"
      >
        <i className={iconClassNames} />
      </a>
    );
  }
}

FaveStar.propTypes = propTypes;
