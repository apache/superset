import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';
import { Logger, LOG_ACTIONS_READ_ABOUT_V2_CHANGES } from '../../logger';
import { t } from '../../locales';

const propTypes = {
  v2FeedbackUrl: PropTypes.string,
  v2AutoConvertDate: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  handleConvertToV2: PropTypes.func.isRequired,
  forceV2Edit: PropTypes.bool.isRequired,
};

const defaultProps = {
  v2FeedbackUrl: null,
  v2AutoConvertDate: null,
};

function logReadAboutV2Changes() {
  Logger.append(LOG_ACTIONS_READ_ABOUT_V2_CHANGES, { version: 'v1' }, true);
}

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
        <div style={{ fontSize: 20, fontWeight: 200, margin: '0px 4px -4px' }}>
          {t('Convert to Dashboard v2 🎉')}
        </div>
      </Modal.Header>
      <Modal.Body>
        <h4>{t('Who')}</h4>
        <p>
          {t(
            "As this dashboard's owner or a Superset Admin, we're soliciting your help to ensure a successful transition to the new dashboard experience.",
          )}
        </p>
        <br />
        <h4>{t('What and When')}</h4>
        <p>
          {t('You have ')}
          <strong>
            {timeUntilAutoConversion}
            {t(' to convert this v1 dashboard to the new v2 format')}
          </strong>
          {t(' before it is auto-converted. ')}
          {forceV2Edit && (
            <em>
              {t(
                'Note that you may only edit dashboards using the v2 experience.',
              )}
            </em>
          )}
          {t('You may read more about these changes ')}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="http://bit.ly/superset-dash-v2"
            onClick={logReadAboutV2Changes}
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
