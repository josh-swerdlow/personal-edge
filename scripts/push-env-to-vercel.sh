#!/bin/bash
# Script to push environment variables from .env.local to Vercel
# Usage: ./scripts/push-env-to-vercel.sh

if [ ! -f .env.local ]; then
  echo "Error: .env.local file not found"
  exit 1
fi

echo "Reading .env.local and adding variables to Vercel..."
echo "You'll be prompted for each variable's value and environment selection."
echo ""

# Read .env.local and extract variable names
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue

  # Remove any whitespace
  key=$(echo "$key" | xargs)

  # Skip if key is empty
  [[ -z "$key" ]] && continue

  echo "Adding: $key"
  echo "$value" | vercel env add "$key"
  echo ""
done < .env.local

echo "Done! All variables from .env.local have been added to Vercel."

