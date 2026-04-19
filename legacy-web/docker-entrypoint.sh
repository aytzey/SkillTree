#!/bin/sh
node node_modules/prisma/build/index.js db push
exec node server.js
