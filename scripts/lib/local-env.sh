# shellcheck shell=bash
# Clear temp/cache vars that point at detached external volumes (e.g. /Volumes/MIE).
# Source from project scripts so yarn/docker never depend on removable disks.
case "${TMPDIR:-}" in
  /Volumes/*)
    unset TMPDIR
    ;;
esac
case "${TMP:-}" in
  /Volumes/*)
    unset TMP
    ;;
esac
case "${TEMP:-}" in
  /Volumes/*)
    unset TEMP
    ;;
esac
case "${YARN_CACHE_FOLDER:-}" in
  /Volumes/*)
    unset YARN_CACHE_FOLDER
    ;;
esac
# Prefer the project-local Yarn cache from .yarnrc; if env still needs a value, use home.
if [ -z "${YARN_CACHE_FOLDER:-}" ]; then
  export YARN_CACHE_FOLDER="${HOME}/Library/Caches/yarn"
  mkdir -p "$YARN_CACHE_FOLDER" 2>/dev/null || true
fi
