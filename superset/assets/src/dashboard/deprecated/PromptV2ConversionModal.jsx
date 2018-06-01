import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';

import { t } from '../../locales';

const propTypes = {
  v2FeedbackUrl: PropTypes.string,
  v2AutoConvertDate: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  handleConvertToV2: PropTypes.func.isRequired,
  forceV2Edit: PropTypes.func.isRequired,
};

const defaultProps = {
  v2FeedbackUrl: null,
  v2AutoConvertDate: null,
};

function PromptV2ConversionModal({
  v2FeedbackUrl,
  v2AutoConvertDate,
  onClose,
  handleConvertToV2,
  forceV2Edit,
}) {
  const timeUntilAutoConversion = v2AutoConvertDate
    ? `approximately ${moment(v2AutoConvertDate).toNow(
        true,
      )} (${v2AutoConvertDate})` // eg 2 weeks (MM-DD-YYYY)
    : 'a limited amount of time';

  return (
    <Modal onHide={onClose} onExit={onClose} animation show>
      <Modal.Header closeButton>
        <Modal.Title>{t('Convert to Dashboard v2 🎉')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {t('The new dashboard v2 experience is here! 🚀')}
        <br />
        <br />
        {t('You have ')}
        <strong>
          {timeUntilAutoConversion}
          {t(' to convert this v1 dashboard to the new v2 format')}
        </strong>
        {t(' before it is done automatically. ')}
        {forceV2Edit && (
          <em>{t('You may only edit dashboards using the v2 experience.')}</em>
        )}
        <br />
        <br />
        {t('Read more about these changes ')}
        <a href="">here (TODO)</a>
        {v2FeedbackUrl ? ' or ' : ''}
        {v2FeedbackUrl ? (
          <a target="_blank" href={v2FeedbackUrl}>
            {t('provide feedback')}
          </a>
        ) : (
          ''
        )}.
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>
          {t(`${forceV2Edit ? 'View in' : 'Continue with'}  v1`)}
        </Button>
        <Button bsStyle="primary" onClick={handleConvertToV2}>
          {t('Preview v2')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

PromptV2ConversionModal.propTypes = propTypes;
PromptV2ConversionModal.defaultProps = defaultProps;

export default PromptV2ConversionModal;
