/* eslint complexity: 'off' */
import { css, StyleSheet } from 'aphrodite';
import React from 'react';
import PropTypes from 'prop-types';

const unit = 8;

const styles = StyleSheet.create({
  container: {
    cursor: 'pointer',
    transition: 'background 0.3s, border-color 0.3s',
    border: 0,
    borderRadius: 1,
    background: '#fff',
    padding: Number(unit),
    color: '#484848',
    outline: 'none',

    ':hover': {
      background: '#eaeaea',
    },

    ':active': {
      background: '#ddd',
    },
  },

  active: {
    background: '#eaeaea',
  },

  border: {
    boxShadow: 'inset 0 0 0 1px #ddd',
  },

  text: {
    pointerEvents: 'none',
  },

  text_sizeSmall: {
    fontSize: 12,
  },

  text_sizeRegular: {
    fontSize: 14,
  },

  container_sizeSmall: {
    padding: Number(unit),
  },

  container_sizeRegular: {
    padding: `${1.5 * unit}px ${2 * unit}px`, // eslint-disable-line no-magic-numbers
  },

  container_block: {
    width: '100%',
  },

  container_notBlock: {
    width: 'auto',
  },

  text_wrap: {
    whiteSpace: 'normal',
  },

  text_noWrap: {
    whiteSpace: 'nowrap',
  },

  rounded: {
    borderRadius: unit / 2,
  },

  round: {
    width: 4 * unit, // eslint-disable-line no-magic-numbers
    height: 4 * unit, // eslint-disable-line no-magic-numbers
    lineHeight: `${4 * unit}px`, // eslint-disable-line no-magic-numbers
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },

  round_small: {
    width: 3 * unit,
    height: 3 * unit,
    lineHeight: `${3 * unit}px`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },

  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

const propTypes = {
  active: PropTypes.bool,
  block: PropTypes.bool,
  children: PropTypes.node,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  small: PropTypes.bool,
  wrapText: PropTypes.bool,
  rounded: PropTypes.bool,
  round: PropTypes.bool,
  noBorder: PropTypes.bool,
};

const defaultProps = {
  active: false,
  block: false,
  children: null,
  onClick: () => {},
  disabled: false,
  small: false,
  wrapText: false,
  rounded: false,
  round: false,
  noBorder: false,
};

function Button({
  active,
  block,
  children,
  onClick,
  disabled,
  small,
  round,
  rounded,
  noBorder,
  wrapText,
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={css(
        styles.container,
        !noBorder && styles.border,
        block ? styles.container_block : styles.container_notBlock,
        small ? styles.container_sizeSmall : styles.container_sizeRegular,
        rounded && styles.rounded,
        round && small ? styles.round_small : round && styles.round,
        disabled && styles.disabled,
        active && styles.active,
      )}
    >
      <span
        className={css(
          styles.text,
          small ? styles.text_sizeSmall : styles.text_sizeRegular,
          wrapText ? styles.text_wrap : styles.text_noWrap,
        )}
      >
        {children}
      </span>
    </button>
  );
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;

export default Button;
