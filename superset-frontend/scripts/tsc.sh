#!/bin/bash
startTime=$(node -e 'console.log(Date.now())')
tscExitCode=$(tsc "$@")
duration=$(node -e "console.log('%ss', (Date.now() - $startTime) / 1000)")

if [ ! "$tscExitCode" ]; then
  echo "compiled in ${duration}"
else
  exit "$tscExitCode"
fi
