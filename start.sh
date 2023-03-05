#!/bin/bash

echo "Node: $(node -v)"

cd ./job
npm install
cd ../

crontab crontab.txt
crond -f
