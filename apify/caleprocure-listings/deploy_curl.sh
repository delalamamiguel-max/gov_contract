#!/bin/bash
export APIFY_TOKEN=$(grep '^APIFY_TOKEN=' ../../.env.local | cut -d '=' -f2)
zip -r source.zip src package.json Dockerfile .actor/actor.json
curl -X POST \
  -H "Content-Type: application/zip" \
  --data-binary @source.zip \
  "https://api.apify.com/v2/acts/Migs_atx~caleprocure-listings/builds?token=${APIFY_TOKEN}&version=0.1" \
  -o build_response.json
cat build_response.json
