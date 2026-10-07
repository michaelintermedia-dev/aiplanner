#!/usr/bin/env bash
# Sends a Telegram message to the developer (long builds, deploys, decisions needed).
#   bash tools/notify.sh "APK ready: https://..."
# Token and chat id live in tools/qa/.local/telegram-token.txt and telegram-chat.txt
# (gitignored - never commit them).
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)/qa/.local"
token=$(tr -d '\r\n\xef\xbb\xbf ' < "$dir/telegram-token.txt")
chat=$(tr -d '\r\n ' < "$dir/telegram-chat.txt")
curl -s -o /dev/null -w "%{http_code}\n" "https://api.telegram.org/bot$token/sendMessage" \
  --data-urlencode "chat_id=$chat" --data-urlencode "text=$*"
