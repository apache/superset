import React from 'react';
import { Link, LinkProps } from 'react-router-dom';

export const GenericLink = ({
  to,
  component,
  replace,
  innerRef,
  children,
  ...rest
}: // css prop type check was failing, override with any
LinkProps & { css?: any }) => {
  if (typeof to === 'string' && /^https?:\/\//.test(to)) {
    return (
      <a data-test="external-link" href={to} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link
      data-test="internal-link"
      to={to}
      component={component}
      replace={replace}
      innerRef={innerRef}
      {...rest}
    >
      {children}
    </Link>
  );
};
