import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import {
  Logger,
  LOG_ACTIONS_READ_ABOUT_V2_CHANGES,
  LOG_ACTIONS_FALLBACK_TO_V1,
} from '../../logger';

import { t } from '../../locales';

const propTypes = {
  v2FeedbackUrl: PropTypes.string.isRequired,
  v2AutoConvertDate: PropTypes.string.isRequired,
  forceV2Edit: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const defaultProps = {
  v2FeedbackUrl: null,
  v2AutoConvertDate: null,
  handleFallbackToV1: null,
};

class V2PreviewModal extends React.Component {
  static logReadAboutV2Changes() {
    Logger.append(
      LOG_ACTIONS_READ_ABOUT_V2_CHANGES,
      { version: 'v2-preview' },
      true,
    );
  }

  handleFallbackToV1() {
    Logger.append(
      LOG_ACTIONS_FALLBACK_TO_V1,
      {
        force_v2_edit: this.props.forceV2Edit,
      },
      true,
    );
    const url = new URL(window.location); // eslint-disable-line
    url.searchParams.set('version', 'v1');
    url.searchParams.delete('edit'); // remove JIC they were editing and v1 editing is not allowed
    window.location = url; // eslint-disable-line
  }

  render() {
    const { v2FeedbackUrl, v2AutoConvertDate, onClose } = this.props;

    const timeUntilAutoConversion = v2AutoConvertDate
      ? `approximately ${moment(v2AutoConvertDate).toNow(
          true,
        )} (${v2AutoConvertDate})` // eg 2 weeks (MM-DD-YYYY)
      : 'a limited amount of time';

    return (
      <Modal onHide={onClose} onExit={onClose} animation show>
        <Modal.Header closeButton>
          <Modal.Title>
            {t('The new dashboard v2 experience is here! 🤩')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {t('You are ')}
          <strong>{t('previewing')}</strong>
          {t(
            ' the auto-converted v2 version of your v1 dashboard. This process may have introduced regressions, such as minor layout variation or incompatible custom CSS ',
          )}
          <em>{t('(non-owners do not see this preview).')}</em>
          <br />
          <br />
          {t('You have ')}
          <strong>
            {timeUntilAutoConversion}
            {t(' to edit and save to persist the v2 version')}
          </strong>
          {t(
            ' before it is auto-converted to this preview. Upon save you will no longer be able to use the v1 experience.',
          )}
          <br />
          <br />
          {t('Read more about these changes ')}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://gist.github.com/williaster/bad4ac9c6a71b234cf9fc8ee629844e5#file-superset-dashboard-v2-md"
            onClick={V2PreviewModal.logReadAboutV2Changes}
          >
            here
          </a>
          {v2FeedbackUrl ? t(' or ') : ''}
          {v2FeedbackUrl ? (
            <a target="_blank" rel="noopener noreferrer" href={v2FeedbackUrl}>
              {t('provide feedback')}
            </a>
          ) : (
            ''
          )}.
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.handleFallbackToV1}>
            {t('Fallback to v1')}
          </Button>
          <Button bsStyle="primary" onClick={onClose}>
            {t('Preview v2')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

V2PreviewModal.propTypes = propTypes;
V2PreviewModal.defaultProps = defaultProps;

export default connect(({ dashboardInfo }) => ({
  v2FeedbackUrl: dashboardInfo.v2FeedbackUrl,
  v2AutoConvertDate: dashboardInfo.v2AutoConvertDate,
  forceV2Edit: dashboardInfo.forceV2Edit,
}))(V2PreviewModal);
