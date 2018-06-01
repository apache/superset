import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';

import { t } from '../../locales';

const propTypes = {
  v2FeedbackUrl: PropTypes.string,
  v2AutoConvertDate: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  handleFallbackToV1: PropTypes.func,
};

const defaultProps = {
  v2FeedbackUrl: null,
  v2AutoConvertDate: null,
  handleFallbackToV1: null,
};

function V2PreviewModal({
  v2FeedbackUrl,
  v2AutoConvertDate,
  onClose,
  handleFallbackToV1,
}) {
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
        <a href="">here (TODO)</a>
        {v2FeedbackUrl ? t(' or ') : ''}
        {v2FeedbackUrl ? (
          <a target="_blank" href={v2FeedbackUrl}>
            {t('provide feedback')}
          </a>
        ) : (
          ''
        )}.
      </Modal.Body>
      <Modal.Footer>
        {handleFallbackToV1 && (
          <Button onClick={handleFallbackToV1}>{t('Fallback to v1')}</Button>
        )}
        <Button bsStyle="primary" onClick={onClose}>
          {t('Continue to v2')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

V2PreviewModal.propTypes = propTypes;
V2PreviewModal.defaultProps = defaultProps;

export default V2PreviewModal;
