/**
 * Customer configuration loader.
 * Set VITE_CUSTOMER at build time to select a customer brand:
 *   VITE_CUSTOMER=doqfy    (default)
 *   VITE_CUSTOMER=doqfy1
 *
 * This file is processed by Vite at build time — env vars are baked in.
 */
import doqfyConfig from './customers/doqfy/colors.json';
import doqfy1Config from './customers/doqfy1/colors.json';
import defaultConfig from './theme/defaultTheme.json';

import doqfyConstants from './customers/doqfy/constants.json';
import doqfy1Constants from './customers/doqfy1/constants.json';

import doqfyStrings from './customers/doqfy/strings.json';
import doqfy1Strings from './customers/doqfy1/strings.json';

import doqfyLogo from './customers/doqfy/assets/logo.png';
import doqfy1Logo from './customers/doqfy1/assets/logo.png';

const CONFIGS = {
  doqfy: { ...doqfyConfig, ...doqfyConstants, ...doqfyStrings },
  doqfy1: { ...doqfy1Config, ...doqfy1Constants, ...doqfy1Strings },
};

const LOGOS = {
  doqfy: doqfyLogo,
  doqfy1: doqfy1Logo,
};

const customerId = import.meta.env.VITE_CUSTOMER || 'doqfy1';
const config = CONFIGS[customerId] || defaultConfig;

export const CUSTOMER_CONFIG = {
  ...config,
  customerId,
  logoUrl: LOGOS[customerId] || doqfyLogo,
};
