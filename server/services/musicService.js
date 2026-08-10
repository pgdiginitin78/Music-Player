/**
 * Music Service
 * Orchestrates music providers and audio quality services.
 */

import { fetchTracksFromProvider, checkProviderCapabilities } from './providers/musicProvider.js';

export const searchSongs = async (params) => {
  return await fetchTracksFromProvider(params);
};

export const getCapabilities = () => {
  return checkProviderCapabilities();
};
