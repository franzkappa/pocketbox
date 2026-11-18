#!/usr/bin/env bash
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"

if [ ! -d ".next" ]; then
  echo "📦 Building PocketBox..."
  npm run build
fi

echo "🚀 Starting PocketBox at http://localhost:3000..."
echo "📱 Local Wi-Fi access for iPhone: http://$(ipconfig getifaddr en0 2>/dev/null || echo 'localhost'):3000"
npm run start
