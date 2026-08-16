import { findLyrics } from '../services/lyricsService.js';

async function test() {
  console.log('Testing lyrics fetch...');
  const testCases = [
    { title: 'Kesariya', artist: 'Arijit Singh' },
    { title: 'Apna Bana Le', artist: 'Arijit Singh' },
    { title: 'Husn', artist: 'Anuv Jain' },
    { title: 'Chaleya', artist: 'Arijit Singh' },
    { title: 'Tum Hi Ho', artist: 'Arijit Singh' },
  ];

  for (const tc of testCases) {
    console.log(`\n--- Querying: ${tc.title} by ${tc.artist} ---`);
    const res = await findLyrics(tc.artist, tc.title);
    console.log('Result:', {
      found: res.found,
      title: res.title,
      artist: res.artist,
      source: res.source,
      reason: res.reason,
      lineCount: res.lyrics ? res.lyrics.length : 0,
      first2Lines: res.lyrics ? res.lyrics.slice(0, 2) : []
    });
  }
}

test().catch(console.error);
