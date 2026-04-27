/**
 * Customer configuration — resolved at RUNTIME from the browser URL.
 * To add a new customer:
 *   1. Add a folder under src/customers/<id>/ with colors.json, strings.json, constants.json, assets/logo.png
 *   2. Import and register below
 *   3. Add hostname → id mapping in src/hostmap.json
 */
import doqfyColors    from './customers/doqfy/colors.json';
import doqfy1Colors   from './customers/doqfy1/colors.json';
import doqfy2Colors   from './customers/doqfy2/colors.json';
import defaultTheme   from './theme/defaultTheme.json';

import doqfyConstants  from './customers/doqfy/constants.json';
import doqfy1Constants from './customers/doqfy1/constants.json';
import doqfy2Constants from './customers/doqfy2/constants.json';

import doqfyStrings  from './customers/doqfy/strings.json';
import doqfy1Strings from './customers/doqfy1/strings.json';
import doqfy2Strings from './customers/doqfy2/strings.json';

import doqfyLogo  from './customers/doqfy/assets/logo.png';
import doqfy1Logo from './customers/doqfy1/assets/logo.png';
import doqfy2Logo from './customers/doqfy2/assets/logo.png';

import hostmap from './hostmap.json';

// Registry — add new customers here
const CONFIGS = {
  doqfy:  { ...doqfyColors,  ...doqfyConstants,  ...doqfyStrings  },
  doqfy1: { ...doqfy1Colors, ...doqfy1Constants, ...doqfy1Strings },
  doqfy2: { ...doqfy2Colors, ...doqfy2Constants, ...doqfy2Strings },
};

const LOGOS = {
  doqfy:  doqfyLogo,
  doqfy1: doqfy1Logo,
  doqfy2: doqfy2Logo,
};

// Resolve customer from current hostname at runtime
// Override via URL param for local testing: ?customer=doqfy1
const hostname   = window.location.hostname;
const urlParam   = new URLSearchParams(window.location.search).get('customer');
const customerId = urlParam || hostmap[hostname] || 'doqfy';
const config     = CONFIGS[customerId] || defaultTheme;

export const CUSTOMER_CONFIG = {
  ...config,
  customerId,
  logoUrl: LOGOS[customerId] || doqfyLogo,
};
