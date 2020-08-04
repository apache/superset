'use strict';

import createAvatarComponent from './avatar';
import gravatarSource from './sources/Gravatar';
import facebookSource from './sources/Facebook';
import githubSource from './sources/Github';
import skypeSource from './sources/Skype';
import valueSource from './sources/Value';
import srcSource from './sources/Src';
import iconSource from './sources/Icon'; // Avatar Redirect

import twitterSource from './sources/Twitter';
import vkontakteSource from './sources/VKontakte';
import instagramSource from './sources/Instagram';
import googleSource from './sources/Google';
var SOURCES = [facebookSource, googleSource, githubSource, twitterSource, instagramSource, vkontakteSource, skypeSource, gravatarSource, srcSource, valueSource, iconSource];
export * from './avatar';
export { default as createAvatarComponent } from './avatar';
export default createAvatarComponent({
  sources: SOURCES
});
export { default as GravatarSource } from './sources/Gravatar';
export { default as FacebookSource } from './sources/Facebook';
export { default as GithubSource } from './sources/Github';
export { default as SkypeSource } from './sources/Skype';
export { default as ValueSource } from './sources/Value';
export { default as SrcSource } from './sources/Src';
export { default as IconSource } from './sources/Icon'; // Avatar Redirect

export { default as VKontakteSource } from './sources/VKontakte';
export { default as InstagramSource } from './sources/Instagram';
export { default as TwitterSource } from './sources/Twitter';
export { default as GoogleSource } from './sources/Google';
export { default as RedirectSource } from './sources/AvatarRedirect';