#!/bin/sh
# runs the blur / noblur A/B, alternating, every run in a fresh browser
cd /d/rutul-portfolio
for r in 1 2 3 4; do
  node qa/qa-verify-performance-card-blur-hitch.mjs full blur 1920x1080 light 1
  node qa/qa-verify-performance-card-blur-hitch.mjs full noblur 1920x1080 light 1
done
for r in 1 2 3 4; do
  node qa/qa-verify-performance-card-blur-hitch.mjs isolated blur 1920x1080 light 1
  node qa/qa-verify-performance-card-blur-hitch.mjs isolated noblur 1920x1080 light 1
done
