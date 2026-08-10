import fs from 'fs';
import https from 'https';
import path from 'path';

const wallpapersDir = path.resolve('../client/public/wallpapers');

if (!fs.existsSync(wallpapersDir)) {
  fs.mkdirSync(wallpapersDir, { recursive: true });
}

const wallpapers = [
  { name: 'for-you.webp', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80' },
  { name: 'bollywood.webp', url: 'https://images.unsplash.com/photo-1605368427756-3b610c14b304?auto=format&fit=crop&w=1920&q=80' },
  { name: 'lofi-hindi.webp', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80' },
  { name: 'old-hindi.webp', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1920&q=80' },
  { name: 'rain-hindi.webp', url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80' },
  { name: 'romantic-hindi.webp', url: 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?auto=format&fit=crop&w=1920&q=80' },
  { name: 'sad-hindi.webp', url: 'https://images.unsplash.com/photo-1481595357459-86667104b281?auto=format&fit=crop&w=1920&q=80' },
  { name: 'devotional.webp', url: 'https://images.unsplash.com/photo-1604143306869-906cb9e407ea?auto=format&fit=crop&w=1920&q=80' },
  { name: 'workout-hindi.webp', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1920&q=80' },
  { name: 'truck-songs.webp', url: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=1920&q=80' }
];

console.log('Downloading cinematic wallpapers to local public directory...');

wallpapers.forEach((wp) => {
  const filePath = path.join(wallpapersDir, wp.name);
  const file = fs.createWriteStream(filePath);
  
  https.get(wp.url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`✅ Downloaded: ${wp.name}`);
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => {});
    console.error(`❌ Error downloading ${wp.name}: ${err.message}`);
  });
});
