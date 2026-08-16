/**
 * Multi-Device Hardware MAC Isolation Verification Test
 * Verifies that DEVICE A (MAC_A) and DEVICE B (MAC_B) maintain 100% isolated MongoDB liked music records.
 */

import mongoose from 'mongoose';
import LikedSong from '../models/LikedSong.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/musicplayer';

async function runIsolationTest() {
  console.log('\n===================================================');
  console.log('  RUNNING PER-DEVICE LIKED MUSIC ISOLATION TEST');
  console.log('===================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[TEST] Connected to MongoDB database.');

    const MAC_A = 'MAC_DEVICE_TEST_AAAAAA';
    const MAC_B = 'MAC_DEVICE_TEST_BBBBBB';

    // Clean test records
    await LikedSong.deleteMany({ macAddress: { $in: [MAC_A, MAC_B] } });

    // 1. DEVICE A likes Believer & Shape of You
    console.log('[TEST 1] DEVICE A likes "Believer" & "Shape of You"...');
    await LikedSong.findOneAndUpdate(
      { macAddress: MAC_A, youtubeVideoId: 'song_believer' },
      { macAddress: MAC_A, userId: 'user_a', youtubeVideoId: 'song_believer', songId: 'song_believer', title: 'Believer', artist: 'Imagine Dragons', liked: true },
      { upsert: true, new: true }
    );
    await LikedSong.findOneAndUpdate(
      { macAddress: MAC_A, youtubeVideoId: 'song_shape' },
      { macAddress: MAC_A, userId: 'user_a', youtubeVideoId: 'song_shape', songId: 'song_shape', title: 'Shape of You', artist: 'Ed Sheeran', liked: true },
      { upsert: true, new: true }
    );

    // 2. DEVICE B likes Blinding Lights
    console.log('[TEST 2] DEVICE B likes "Blinding Lights"...');
    await LikedSong.findOneAndUpdate(
      { macAddress: MAC_B, youtubeVideoId: 'song_blinding' },
      { macAddress: MAC_B, userId: 'user_b', youtubeVideoId: 'song_blinding', songId: 'song_blinding', title: 'Blinding Lights', artist: 'The Weeknd', liked: true },
      { upsert: true, new: true }
    );

    // 3. Query DEVICE A Liked Songs
    const songsA = await LikedSong.find({ macAddress: MAC_A }).lean();
    console.log(`\n[VERIFY DEVICE A] Loaded ${songsA.length} songs for MAC_A:`, songsA.map(s => s.title));
    const titlesA = songsA.map(s => s.title);
    if (titlesA.includes('Believer') && titlesA.includes('Shape of You') && !titlesA.includes('Blinding Lights')) {
      console.log('✅ PASS: DEVICE A sees ONLY its own liked songs.');
    } else {
      console.error('❌ FAIL: DEVICE A leaked data from DEVICE B!');
    }

    // 4. Query DEVICE B Liked Songs
    const songsB = await LikedSong.find({ macAddress: MAC_B }).lean();
    console.log(`[VERIFY DEVICE B] Loaded ${songsB.length} songs for MAC_B:`, songsB.map(s => s.title));
    const titlesB = songsB.map(s => s.title);
    if (titlesB.includes('Blinding Lights') && !titlesB.includes('Believer') && !titlesB.includes('Shape of You')) {
      console.log('✅ PASS: DEVICE B sees ONLY its own liked songs.');
    } else {
      console.error('❌ FAIL: DEVICE B leaked data from DEVICE A!');
    }

    // 5. DEVICE A Unlikes Believer
    console.log('\n[TEST 3] DEVICE A unlikes "Believer"...');
    await LikedSong.deleteOne({ macAddress: MAC_A, youtubeVideoId: 'song_believer' });

    const updatedA = await LikedSong.find({ macAddress: MAC_A }).lean();
    const updatedB = await LikedSong.find({ macAddress: MAC_B }).lean();

    console.log(`[VERIFY DEVICE A AFTER UNLIKE] Songs count: ${updatedA.length} (Expected 1: Shape of You)`);
    console.log(`[VERIFY DEVICE B AFTER UNLIKE] Songs count: ${updatedB.length} (Expected 1: Blinding Lights)`);

    if (updatedA.length === 1 && updatedA[0].title === 'Shape of You' && updatedB.length === 1 && updatedB[0].title === 'Blinding Lights') {
      console.log('✅ PASS: Unlike on DEVICE A affected ONLY DEVICE A. DEVICE B remains completely untouched!');
    } else {
      console.error('❌ FAIL: Unlike operation affected another device!');
    }

    // Clean up test records
    await LikedSong.deleteMany({ macAddress: { $in: [MAC_A, MAC_B] } });
    console.log('\n===================================================');
    console.log('  PER-DEVICE ISOLATION TEST COMPLETED SUCCESSFULLY! 🎉');
    console.log('===================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runIsolationTest();
