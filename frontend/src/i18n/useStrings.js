/**
 * useStrings — returns localized strings for the active customer.
 *
 * Strings are merged: defaultStrings/en.json → customers/{id}/en.json
 * Customer strings override defaults; keys not present in the customer
 * file fall back to the default English value.
 *
 * Usage:
 *   const s = useStrings();
 *   <h1>{s.login.title}</h1>
 */
import { useMemo } from 'react';
import { CUSTOMER_CONFIG } from '../customer.config';

import defaultEn from './defaultStrings/en.json';
import doqfyEn from '../customers/doqfy/strings.json';
import doqfy1En from '../customers/doqfy1/strings.json';

const STRING_MAP = {
  doqfy:  { en: doqfyEn },
  doqfy1: { en: doqfy1En },
};

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      typeof override[key] === 'object' &&
      override[key] !== null &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

export function useStrings(locale = 'en') {
  const { customerId } = CUSTOMER_CONFIG;

  return useMemo(() => {
    const customerStrings = STRING_MAP[customerId]?.[locale] || {};
    return deepMerge(defaultEn, customerStrings);
  }, [customerId, locale]);
}
