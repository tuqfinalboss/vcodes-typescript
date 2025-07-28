#!/bin/bash
set -e

# Run lint, build, migrate, and tests (for local CI or pre-push)

npm install
npm run lint
npm run build
npm run migrate
npx jest

echo "All checks passed."
