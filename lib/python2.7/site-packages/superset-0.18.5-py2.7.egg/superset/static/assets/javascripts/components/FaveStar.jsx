import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  sliceId: PropTypes.number.isRequired,
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
      <TooltipWrapper
        label="fave-unfave"
        tooltip="Click to favorite/unfavorite"
      >
        <a
          href="#"
          onClick={this.onClick.bind(this)}
          className="fave-unfave-icon"
        >
          <i className={iconClassNames} />
        </a>
      </TooltipWrapper>
    );
  }
}

FaveStar.propTypes = propTypes;
