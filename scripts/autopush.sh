#!/bin/bash
# Auto-push ke GitHub menggunakan GITHUB_TOKEN
# Dipanggil oleh workflow "Auto Push GitHub" secara periodik

set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[autopush] ERROR: GITHUB_TOKEN tidak ada. Set di Secrets."
  exit 1
fi

REPO_URL="https://${GITHUB_TOKEN}@github.com/tegalsarioneapp-ui/LaKu.git"

cd /home/runner/workspace

# Konfigurasi identity (aman untuk CI)
git config user.email "boprt005@tegalsari.id"
git config user.name "BOP RT 005 Tegalsari"

# Cek apakah ada yang perlu di-push
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git ls-remote "$REPO_URL" refs/heads/main 2>/dev/null | cut -f1)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[autopush] Sudah up-to-date. Tidak ada yang di-push."
  exit 0
fi

# Push ke GitHub
git remote set-url origin "$REPO_URL"
git push origin main

echo "[autopush] Push berhasil ke GitHub: $(git rev-parse --short HEAD)"
