/* eslint-env browser */
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
  v2FeedbackUrl: PropTypes.string,
  v2AutoConvertDate: PropTypes.string,
  forceV2Edit: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const defaultProps = {
  v2FeedbackUrl: null,
  v2AutoConvertDate: null,
  handleFallbackToV1: null,
};

// This is a gross component but it is temporary!
class V2PreviewModal extends React.Component {
  static logReadAboutV2Changes() {
    Logger.append(
      LOG_ACTIONS_READ_ABOUT_V2_CHANGES,
      { version: 'v2-preview' },
      true,
    );
  }

  constructor(props) {
    super(props);
    this.handleFallbackToV1 = this.handleFallbackToV1.bind(this);
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
    window.location = url;
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
          <div
            style={{ fontSize: 20, fontWeight: 200, margin: '0px 4px -4px' }}
          >
            {t('Welcome to the new Dashboard v2 experience! 🎉')}
          </div>
        </Modal.Header>
        <Modal.Body>
          <h3>{t('Who')}</h3>
          <p>
            {t(
              "As this dashboard's owner or a Superset Admin, we're soliciting your help to ensure a successful transition to the new dashboard experience. You can learn more about these changes ",
            )}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="http://bit.ly/superset-dash-v2"
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
          </p>
          <br />
          <h3>{t('What')}</h3>
          <p>
            {t('You are ')}
            <strong>{t('previewing')}</strong>
            {t(
              ' an auto-converted v2 version of your v1 dashboard. This conversion may have introduced regressions, such as minor layout variation or incompatible custom CSS. ',
            )}
            <strong>
              {t(
                'To persist your dashboard as v2, please make any necessary changes and save the dashboard',
              )}
            </strong>
            {t(
              '. Note that non-owners/-admins will continue to see the original version until you take this action.',
            )}
          </p>
          <br />
          <h3>{t('When')}</h3>
          <p>
            {t('You have ')}
            <strong>
              {timeUntilAutoConversion}
              {t(' to edit and save this version ')}
            </strong>
            {t(
              ' before it is auto-persisted to this preview. Upon save you will no longer be able to use the v1 experience.',
            )}
          </p>
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
