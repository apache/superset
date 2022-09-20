// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { CurrencyCode, LocaleCode, NumericCell, Style } from './index';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Components/Table/Cell Renderers/NumericCell',
  component: NumericCell,
} as ComponentMeta<typeof NumericCell>;

export const Basic: ComponentStory<typeof NumericCell> = args => (
  <NumericCell {...args} />
);

Basic.args = {
  value: 5678943,
};

export const FrenchLocale: ComponentStory<typeof NumericCell> = args => (
  <NumericCell {...args} />
);

FrenchLocale.args = {
  value: 5678943,
  locale: LocaleCode.fr,
  options: {
    style: Style.CURRENCY,
    currency: CurrencyCode.EUR,
  },
};
