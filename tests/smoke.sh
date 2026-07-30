#!/usr/bin/env bash
# Smoke test for the scaffolding wizard: drives the prompts through a pipe
# and verifies the generated projects, including a real production build.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

# Prints each argument after a short delay so every prompt is rendered
# before its answer arrives.
feed() {
  for chunk in "$@"; do
    sleep 1
    printf '%b' "$chunk"
  done
  sleep 2
}

fail() { echo "FAIL: $*" >&2; exit 1; }
pkg() { node -p "JSON.stringify(require('./$1/package.json').$2)"; }

DOWN='\x1b[B'

echo '=== scenario: full (all folders, examples, build, SCSS) ==='
feed 'full-addon\n' 'Full addon\n' 'a' '\n' 'y\n' 'n\n' 'y\n' "${DOWN}${DOWN}" '\n' \
  | node "$REPO_DIR/index.js" > full.log 2>&1 || { cat full.log; fail 'wizard exited non-zero'; }

for f in header footer orderFinale; do
  [[ -f "full-addon/src/$f/script.js" && -f "full-addon/src/$f/style.scss" ]] || fail "missing example files in src/$f"
done
[[ -f full-addon/webpack.config.js ]] || fail 'missing webpack.config.js'
[[ ! -e full-addon/config.json ]] || fail 'config.json should only be generated with Bender'
[[ -f full-addon/.gitignore ]] || fail 'missing .gitignore'
[[ ! -e full-addon/yarn.lock ]] || fail 'yarn.lock should not be generated'
[[ ! -e full-addon/dist ]] || fail 'dist/ should not be generated'
[[ "$(pkg full-addon "scripts.build")" == '"webpack --env production"' ]] || fail 'wrong build script'
[[ "$(pkg full-addon "scripts['build:dev']")" == '"webpack"' ]] || fail 'wrong build:dev script'
[[ "$(pkg full-addon "devDependencies['sass-loader']")" != 'undefined' ]] || fail 'sass-loader should be installed'
[[ "$(pkg full-addon "devDependencies['less']")" == 'undefined' ]] || fail 'less should not be installed'
[[ "$(pkg full-addon "private")" == 'true' ]] || fail 'generated project should be private'
[[ "$(pkg full-addon "_id")" == 'undefined' ]] || fail '_id leaked into package.json'

echo '=== production and development builds ==='
(
  cd full-addon
  printf '<div>AAA markup</div>' > src/header/a-markup.html
  printf '<div>BBB markup</div>' > src/header/b-markup.html
  mkdir -p assets
  printf '<svg></svg>' > assets/logo.svg
  npm install --no-audit --no-fund --loglevel=error
  npm run build
  for f in scripts.header.min.js scripts.footer.min.js scripts.orderFinale.min.js \
           styles.header.min.css styles.footer.min.css styles.orderFinale.min.css \
           markups.header.html assets/logo.svg; do
    [[ -f "dist/$f" ]] || fail "production build: missing dist/$f"
  done
  grep -q '_0x' dist/scripts.header.min.js || fail 'production JS does not look obfuscated'
  [[ "$(cat dist/markups.header.html)" == '<div>AAA markup</div>
<div>BBB markup</div>' ]] || fail 'markup is not concatenated in alphabetical order'
  npm run build:dev
  [[ -f dist/scripts.header.js && -f dist/styles.header.css ]] || fail 'development build: missing outputs'
)

echo '=== scenario: minimal (no folders, no build) ==='
feed 'minimal-addon\n' 'Minimal addon\n' '\n' 'n\n' 'n\n' \
  | node "$REPO_DIR/index.js" > minimal.log 2>&1 || { cat minimal.log; fail 'wizard exited non-zero'; }

if grep -q 'example files' minimal.log; then
  fail 'example question should be skipped when no folders are selected'
fi
[[ ! -e minimal-addon/webpack.config.js ]] || fail 'webpack.config.js should not be generated'
[[ ! -e minimal-addon/yarn.lock ]] || fail 'yarn.lock should not be generated'
[[ "$(pkg minimal-addon "scripts")" == '{}' ]] || fail 'scripts should be empty'

echo '=== scenario: LESS flavour with Bender (scaffold only) ==='
feed 'less-addon\n' 'Less addon\n' 'a' '\n' 'y\n' 'y\n' 'https://classic.shoptet.cz/some/path?x=1\n' 'y\n' "$DOWN" '\n' \
  | node "$REPO_DIR/index.js" > less.log 2>&1 || { cat less.log; fail 'wizard exited non-zero'; }

[[ -f less-addon/src/header/style.less ]] || fail 'missing style.less example'
[[ -f less-addon/config.json ]] || fail 'config.json should be generated with Bender'
[[ "$(pkg less-addon "scripts.dev")" == '"shp-bender --remote https://classic.shoptet.cz"' ]] || fail 'dev script should contain the normalized e-shop origin'
[[ "$(pkg less-addon "devDependencies['less-loader']")" != 'undefined' ]] || fail 'less-loader should be installed'
[[ "$(pkg less-addon "devDependencies['sass']")" == 'undefined' ]] || fail 'sass should not be installed'

echo 'OK: all smoke tests passed'
