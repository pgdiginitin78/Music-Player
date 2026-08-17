import { Router } from "express";
import userContextMiddleware from "../middleware/userContext.js";
import { getHardwareIdentityInfo } from "../services/hardwareDeviceResolver.js";

const router = Router();
router.use(userContextMiddleware);

router.get("/identity", (req, res) => {
  const info = getHardwareIdentityInfo();
  return res.status(200).json({
    success: true,
    macAddress: req.userContext.macAddress,
    maskedMac: info.maskedMac,
    source: info.source,
    scope: info.scope,
  });
});

export default router;
