import os from 'os';
import http from 'http';

let cachedHardwareMac = null;

/**
 * Resolves the physical hardware MAC address of the host machine using OS network interfaces
 * with fallback to local Python voice service (uuid.getnode()).
 */
export function getPhysicalMacAddress() {
  if (cachedHardwareMac) {
    return cachedHardwareMac;
  }

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (Array.isArray(netInterface)) {
        for (const item of netInterface) {
          if (
            item &&
            !item.internal &&
            item.mac &&
            item.mac !== '00:00:00:00:00:00' &&
            item.mac !== '00-00-00-00-00-00'
          ) {
            const cleanMac = item.mac.toLowerCase().replace(/[:-]/g, '');
            cachedHardwareMac = `mac_${cleanMac}`;
            console.log(`[HARDWARE RESOLVER] Resolved Physical Hardware MAC Address: ${cachedHardwareMac} (via OS Interface: ${name})`);
            return cachedHardwareMac;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[HARDWARE RESOLVER WARN] OS network interface error:', err.message);
  }

  cachedHardwareMac = 'mac_host_default';
  return cachedHardwareMac;
}

/**
 * Returns diagnostic identity payload
 */
export function getHardwareIdentityInfo() {
  const mac = getPhysicalMacAddress();
  const maskedMac = mac.length > 8 ? `${mac.slice(0, 7)}****${mac.slice(-4)}` : mac;

  return {
    macAddress: mac,
    maskedMac,
    source: 'HARDWARE_OS_NETWORK_INTERFACE',
    scope: 'PHYSICAL_DEVICE',
  };
}
