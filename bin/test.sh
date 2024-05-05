#!/usr/bin/env bash
set -e
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Get all Patrim programs in tests/
shopt -s nullglob
TEST_PROGRAMS=($SCRIPT_DIR/../tests/*.pat)
shopt -u nullglob

TEST_COUNT="${#TEST_PROGRAMS[@]}"
if [ "$TEST_COUNT" -eq 0 ]; then
  >&2 echo "Error: no tests found."
  exit 1
fi

# Run all tests.
SUCCESS_COUNT=0
FAILURE_COUNT=0
for TEST_PROGRAM in ${TEST_PROGRAMS[@]}; do
  echo "Testing $TEST_PROGRAM..."
  pnpm run pc $TEST_PROGRAM

  # Tests are considered passing if the exit status is 0.
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    >&2 echo "Error: test failed: $TEST_PROGRAM"

    # Don't early out so we see all failures.
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

if [ "$FAILURE_COUNT" -ne 0 ]; then
  >&2 echo "Error: $FAILURE_COUNT of $TEST_COUNT tests failed."
  exit 1
fi

echo "$SUCCESS_COUNT tests passed."

exit 0
