#!/bin/bash

echo "Node: $(node -v)"

crontab crontab.txt
crond -f
