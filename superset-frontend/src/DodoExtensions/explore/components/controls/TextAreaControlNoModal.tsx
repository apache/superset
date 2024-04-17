// DODO added #32232659

import React, { FC } from 'react';
import TextAreaControl from '../../../../explore/components/controls/TextAreaControl';

type Props = {
  value?: string;
  [key: string]: any;
};

const TextAreaControlNoModal: FC<Props> = ({ value = '', ...props }) => (
  <TextAreaControl {...props} initialValue={value} offerEditInModal={false} />
);
export default TextAreaControlNoModal;
