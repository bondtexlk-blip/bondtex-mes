// Utility to resolve live production hosting URL for machine QR portals
// Prevents mobile phones from getting ERR_CONNECTION_REFUSED by avoiding localhost / 127.0.0.1

export const PRODUCTION_HOST = 'https://bondtexlk-f16f5.web.app';

/**
 * Returns a valid, phone-accessible public or intranet URL host.
 * Always resolves to the live deployed Firebase Hosting domain if on localhost.
 * @param {string} [customHost] - Optional override host address
 * @returns {string} - Clean, trailing-slash-free base URL
 */
export const resolveProductionHost = (customHost) => {
  // If user explicitly provided a non-empty custom host
  if (customHost && typeof customHost === 'string' && customHost.trim()) {
    const clean = customHost.trim().replace(/\/+$/, '');
    // Ignore localhost or 127.0.0.1 which causes mobile phones to fail
    if (!clean.includes('127.0.0.1') && !clean.includes('localhost')) {
      return clean;
    }
  }

  // If running in browser and on a live production domain (e.g. Firebase Hosting or custom domain)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin.replace(/\/+$/, '');
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  // Default fallback is the live deployed Firebase Hosting production URL
  return PRODUCTION_HOST;
};

/**
 * Formats a full worker machine portal scan URL.
 * @param {string} machineCodeOrId - e.g. 'MCH-01'
 * @param {string} [customHost] - Optional host override
 * @returns {string} - Full executable URL
 */
export const buildMachinePortalUrl = (machineCodeOrId, customHost) => {
  const host = resolveProductionHost(customHost);
  const code = encodeURIComponent(machineCodeOrId || 'MCH-01');
  return `${host}/?view=worker&machine=${code}`;
};
