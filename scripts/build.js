const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isNetlify = !!process.env.NETLIFY;
const isRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_NAME || process.env.RENDER_INSTANCE_ID);

console.log(`🚀 Build started. Environment: Netlify=${isNetlify}, Render=${isRender}`);

// 1. If on Render (Backend Hosting), only ensure backend dependencies are installed
if (isRender) {
  console.log('📦 Render environment detected: Setting up backend...');
  try {
    execSync('npm install --prefix backend', { stdio: 'inherit' });
    console.log('✅ Backend setup complete for Render!');
  } catch (err) {
    console.error('⚠️ Backend npm install warning:', err.message);
  }
  process.exit(0);
}

// 2. If on Netlify (or local/general), build the React frontend
console.log('📦 Installing frontend dependencies...');
execSync('npm install --prefix frontend', { stdio: 'inherit' });

console.log('⚡ Building Vite frontend...');
execSync('npm run build --prefix frontend', { stdio: 'inherit' });

const srcDist = path.join(__dirname, '..', 'frontend', 'dist');
const rootDist = path.join(__dirname, '..', 'dist');

if (fs.existsSync(srcDist)) {
  console.log('📦 Mirroring frontend/dist to root dist/ for Netlify compatibility...');
  if (fs.existsSync(rootDist)) {
    fs.rmSync(rootDist, { recursive: true, force: true });
  }
  fs.cpSync(srcDist, rootDist, { recursive: true });
  console.log('✅ Build completed and mirrored to dist/ successfully!');
} else {
  console.error('❌ frontend/dist not found after build!');
  process.exit(1);
}

