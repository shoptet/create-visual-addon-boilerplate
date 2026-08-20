#!/usr/bin/env bash
# Smoke test for the scaffolding wizard: drives the prompts through a pipe
# and verifies the generated projects, including a real production build.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

fail() { echo "FAIL: $*" >&2; exit 1; }
pkg() { node -p "JSON.stringify(require('./$1/package.json').$2)"; }
assert_dep() { [[ "$(pkg "$1" "devDependencies['$2']")" != 'undefined' ]] || fail "$1: $2 should be installed"; }
assert_no_dep() { [[ "$(pkg "$1" "devDependencies['$2']")" == 'undefined' ]] || fail "$1: $2 should not be installed"; }

# Sends each chunk once the wizard's output has gone idle (the active prompt
# is rendered and waiting for input) instead of relying on fixed sleeps.
feed() {
  local logfile="$1"
  shift
  for chunk in "$@"; do
    local prev=-1 size=0 tries=0
    while :; do
      size=$(wc -c < "$logfile" 2>/dev/null || echo 0)
      [[ "$size" -gt 0 && "$size" -eq "$prev" ]] && break
      prev=$size
      [[ $((++tries)) -gt 300 ]] && break # 30s safety net per chunk
      sleep 0.1
    done
    printf '%b' "$chunk"
  done
  sleep 2 # keep stdin open while the wizard writes the project
}

# scaffold <name> <answer chunks...> — runs the wizard, log in $WORKDIR/<name>.log
scaffold() {
  local name="$1"
  shift
  : > "$name.log"
  feed "$name.log" "$@" | node "$REPO_DIR/index.js" >> "$name.log" 2>&1 \
    || { cat "$name.log"; fail "$name: wizard exited non-zero"; }
}

DOWN='\x1b[B'

echo '=== scenario: full (all folders, examples, build, SCSS) ==='
scaffold full-addon 'full-addon\n' 'Full addon\n' 'a' '\n' 'y\n' 'n\n' 'y\n' "${DOWN}${DOWN}" '\n'

for f in header footer orderFinale; do
  [[ -f "full-addon/src/$f/script.js" && -f "full-addon/src/$f/style.scss" ]] || fail "missing example files in src/$f"
done
[[ -f full-addon/webpack.config.js ]] || fail 'missing webpack.config.js'
[[ -f full-addon/config.json ]] || fail 'missing config.json (generated unconditionally for Bender)'
[[ -f full-addon/.gitignore ]] || fail 'missing .gitignore'
[[ ! -e full-addon/yarn.lock ]] || fail 'yarn.lock should not be generated'
[[ ! -e full-addon/dist ]] || fail 'dist/ should not be generated'
[[ "$(pkg full-addon "scripts.build")" == '"webpack --env production"' ]] || fail 'wrong build script'
[[ "$(pkg full-addon "scripts['build:dev']")" == '"webpack"' ]] || fail 'wrong build:dev script'
[[ "$(pkg full-addon "private")" == 'true' ]] || fail 'generated project should be private'
[[ "$(pkg full-addon "_id")" == 'undefined' ]] || fail '_id leaked into package.json'
[[ "$(pkg full-addon "engines.node")" == '">=22.11.0"' ]] || fail 'generated project should declare engines'
assert_dep full-addon sass-loader
assert_dep full-addon terser-webpack-plugin
assert_no_dep full-addon less

echo '=== production and development builds ==='
(
  cd full-addon
  printf '<div>AAA markup</div>' > src/header/a-markup.html
  printf '<div>BBB markup</div>' > src/header/b-markup.html
  printf '<div>footer markup</div>' > src/footer/markup.html
  printf '/*! test-banner v1.0 | MIT */\nconsole.log("footer with banner");\n' > src/footer/script.js
  printf '.scss-marker { color: red; background: url("./logo.png"); }' > src/header/style.scss
  printf '.css-marker { color: green; }' > src/header/extra.css
  printf 'header-logo-content' > src/header/logo.png
  printf '.footer-bg { background: url("./logo.png"); }' > src/footer/style.scss
  printf 'footer-logo-content' > src/footer/logo.png
  mkdir -p assets
  printf '<svg></svg>' > assets/logo.svg
  npm install --no-audit --no-fund --loglevel=error
  npm run build
  for f in scripts.header.min.js scripts.footer.min.js scripts.orderFinale.min.js \
           styles.header.min.css styles.footer.min.css styles.orderFinale.min.css \
           markups.header.html markups.footer.html assets/logo.svg; do
    [[ -f "dist/$f" ]] || fail "production build: missing dist/$f"
  done
  grep -q 'scss-marker' dist/styles.header.min.css || fail 'preprocessor styles missing from merged entry'
  grep -q 'css-marker' dist/styles.header.min.css || fail 'entry-key collision fix regressed (plain CSS is missing next to the preprocessor styles)'
  grep -q '_0x' dist/scripts.header.min.js || fail 'production JS does not look obfuscated'
  [[ -z "$(find dist -name '*.LICENSE.txt' -print -quit)" ]] || fail 'license comments should not be extracted into dist'
  logo_count=$(find dist/assets -name 'logo.*.png' | wc -l | tr -d ' ')
  [[ "$logo_count" == "2" ]] || fail "same-named url() assets should emit 2 hashed files, got $logo_count"
  [[ "$(cat dist/markups.header.html)" == '<div>AAA markup</div>
<div>BBB markup</div>' ]] || fail 'markup is not concatenated in alphabetical order'
  npm run build:dev
  [[ -f dist/scripts.header.js && -f dist/styles.header.css ]] || fail 'development build: missing outputs'
)

echo '=== scenario: minimal (no folders, no build) ==='
scaffold minimal-addon 'minimal-addon\n' 'Minimal addon\n' '\n' 'n\n' 'n\n'

if grep -q 'example files' minimal-addon.log; then
  fail 'example question should be skipped when no folders are selected'
fi
[[ ! -e minimal-addon/webpack.config.js ]] || fail 'webpack.config.js should not be generated'
[[ ! -e minimal-addon/yarn.lock ]] || fail 'yarn.lock should not be generated'
[[ -f minimal-addon/config.json ]] || fail 'config.json should be generated unconditionally'
[[ "$(pkg minimal-addon "scripts")" == '{}' ]] || fail 'scripts should be empty'

echo '=== scenario: LESS flavour with Bender (scaffold only) ==='
scaffold less-addon 'less-addon\n' 'Less addon\n' 'a' '\n' 'y\n' 'y\n' 'https://classic.shoptet.cz/some/path?x=1\n' 'y\n' "$DOWN" '\n'

[[ -f less-addon/src/header/style.less ]] || fail 'missing style.less example'
[[ -f less-addon/config.json ]] || fail 'missing config.json'
[[ "$(pkg less-addon "scripts.dev")" == '"shp-bender --remote https://classic.shoptet.cz"' ]] || fail 'dev script should contain the normalized e-shop origin'
assert_dep less-addon less-loader
assert_no_dep less-addon sass

echo '=== scenario: CSS flavour (scaffold only) ==='
scaffold css-addon 'css-addon\n' 'Css addon\n' 'a' '\n' 'y\n' 'n\n' 'y\n' '\n'

[[ -f css-addon/src/header/style.css ]] || fail 'missing style.css example'
assert_no_dep css-addon sass
assert_no_dep css-addon less
[[ "$(pkg css-addon "engines.node")" == '">=22.11.0"' ]] || fail 'generated project should declare engines'

echo 'OK: all smoke tests passed'
