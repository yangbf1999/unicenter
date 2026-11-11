#!/usr/bin/env bash
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  echo "Usage: ./release.sh <version>"
  echo "  version   Semver without a v prefix (for example 1.2.0)"
  exit 1
}

[[ $# -eq 1 ]] || usage
VERSION="$1"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Invalid semver: $VERSION"

TAG="v${VERSION}"
BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == "main" ]] || die "Releases must be created from main (current: $BRANCH)"
[[ -z "$(git status --porcelain)" ]] || die "The worktree is not clean"
git rev-parse "$TAG" >/dev/null 2>&1 && die "Tag $TAG already exists"

echo "==> Updating package metadata to $VERSION"
npm --prefix frontend version "$VERSION" --no-git-tag-version

echo "==> Updating the application version fallback"
sed -i "s/|| '[0-9]*\.[0-9]*\.[0-9]*'/|| '$VERSION'/" frontend/src/config/version.ts

git add frontend/package.json frontend/package-lock.json frontend/src/config/version.ts
git commit -m "release: $TAG"
git tag -a "$TAG" -m "Release $TAG"

echo "==> Pushing main and $TAG"
git push origin main "$TAG"
echo "Release $TAG pushed successfully."
