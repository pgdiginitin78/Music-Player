import dotenv from 'dotenv';
import { searchSongs, searchArtist, getSong } from '../services/providers/youtubeProvider.js';

dotenv.config();

async function testYouTubeIntegration() {
  console.log('=== TESTING YOUTUBE DATA API v3 INTEGRATION ===');
  console.log('YOUTUBE_API_KEY loaded:', process.env.YOUTUBE_API_KEY ? 'YES' : 'NO');

  if (!process.env.YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY is missing from environment.');
    process.exit(1);
  }

  try {
    console.log('\n--- 1. Testing Artist Search ("Arijit Singh") ---');
    const arijitResult = await searchArtist('Arijit Singh', 5);
    console.log(`Found ${arijitResult.songs.length} songs for Arijit Singh:`);
    arijitResult.songs.forEach((song, i) => {
      console.log(`  ${i+1}. [${song.youtubeVideoId}] ${song.title} - ${song.artist} (${song.duration}s, embeddable: ${song.isPlayable})`);
    });

    console.log('\n--- 2. Testing Category Search ("bollywood-hits") ---');
    const bollywoodResult = await searchSongs({ category: 'bollywood-hits', limit: 5 });
    console.log(`Found ${bollywoodResult.songs.length} songs for Bollywood Hits:`);
    bollywoodResult.songs.forEach((song, i) => {
      console.log(`  ${i+1}. [${song.youtubeVideoId}] ${song.title} - ${song.artist}`);
    });

    if (arijitResult.songs.length > 0) {
      const sampleId = arijitResult.songs[0].youtubeVideoId;
      console.log(`\n--- 3. Testing Single Video Lookup (${sampleId}) ---`);
      const singleSong = await getSong(sampleId);
      console.log('Single Song Result:', singleSong);
    }

    console.log('\n=== YOUTUBE INTEGRATION TEST PASSED SUCCESSFUL ===');
  } catch (error) {
    console.error('YouTube Integration Test Failed:', error);
  }
}

testYouTubeIntegration();
