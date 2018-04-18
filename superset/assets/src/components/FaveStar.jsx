import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import TooltipWrapper from './TooltipWrapper';
import { t } from '../locales';

const propTypes = {
  itemId: PropTypes.number.isRequired,
  fetchFaveStar: PropTypes.func,
  saveFaveStar: PropTypes.func,
  isStarred: PropTypes.bool.isRequired,
};

export default class FaveStar extends React.Component {
  componentDidMount() {
    this.props.fetchFaveStar(this.props.itemId);
  }

  onClick(e) {
    e.preventDefault();
    this.props.saveFaveStar(this.props.itemId, this.props.isStarred);
  }

  render() {
    const iconClassNames = cx('fa', {
      'fa-star': this.props.isStarred,
      'fa-star-o': !this.props.isStarred,
    });

    return (
      <TooltipWrapper
        label="fave-unfave"
        tooltip={t('Click to favorite/unfavorite')}
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
