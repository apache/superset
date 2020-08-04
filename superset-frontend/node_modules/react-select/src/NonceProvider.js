// @flow
import React, { Component, type Node } from 'react';
import { CacheProvider } from '@emotion/core';
import createCache from '@emotion/cache';
import memoizeOne from 'memoize-one';

type NonceProviderProps = {
  nonce: string,
  children: Node,
};

export default class NonceProvider extends Component<NonceProviderProps> {
  constructor(props: NonceProviderProps) {
    super(props);
    this.createEmotionCache = memoizeOne(this.createEmotionCache);
  }
  createEmotionCache = (nonce: string) => {
    return createCache({ nonce });
  };
  render() {
    const emotionCache = this.createEmotionCache(this.props.nonce);
    return (
      <CacheProvider value={emotionCache}>{this.props.children}</CacheProvider>
    );
  }
}
