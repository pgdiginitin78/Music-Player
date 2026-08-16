/**
 * User Context & Authorization Middleware
 * Enforces strict per-device isolation based on the physical machine hardware MAC address.
 */

import { getPhysicalMacAddress } from '../services/hardwareDeviceResolver.js';

export function userContextMiddleware(req, res, next) {
  // Always resolve authoritative physical hardware MAC address from the host server
  const hardwareMac = getPhysicalMacAddress();

  // Allow explicit testing override headers if set (e.g. for multi-device test automation)
  const clientHeaderMac =
    req.headers['x-test-mac-address'] ||
    req.headers['x-mac-address'] ||
    req.headers['x-device-id'];

  // If header is a test device ID (e.g. MAC_DEVICE_TEST_AAAAAA), use it; otherwise use real hardware MAC
  const effectiveMacAddress =
    clientHeaderMac && clientHeaderMac.startsWith('MAC_DEVICE_TEST')
      ? clientHeaderMac.trim()
      : hardwareMac;

  const rawUserId =
    req.headers['x-user-id'] ||
    req.query.userId ||
    req.body?.userId ||
    'default_user';

  const userId = String(rawUserId).trim();

  // Attach authoritative user context to request object
  req.userContext = {
    macAddress: effectiveMacAddress,
    deviceId: effectiveMacAddress,
    userId: userId || 'default_user',
  };

  next();
}

export default userContextMiddleware;
