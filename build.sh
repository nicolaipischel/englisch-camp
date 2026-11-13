#!/bin/sh
cd "$(dirname "$0")" && cat src/0*.html > index.html && wc -c index.html
