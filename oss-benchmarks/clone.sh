#!/usr/bin/env bash
# Shallow-clone OSS projects with sparse checkout for local benchmarking.
# Only the specific config files needed by each project are downloaded,
# not the entire repository.
#
# Usage:
#   ./oss-benchmarks/clone.sh            # clone all (skip existing)
#   ./oss-benchmarks/clone.sh --force    # re-clone all (remove existing first)
#   ./oss-benchmarks/clone.sh --dry-run  # preview only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOS="$SCRIPT_DIR/repos"
DRY_RUN=false
FORCE=false

for arg in "${@:-}"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
  esac
done

mkdir -p "$REPOS"

clone_one() {
  local name="$1" branch="$2" repo="$3"
  shift 3
  local files=("$@")
  local target="$REPOS/$name"

  if [[ -d "$target" ]]; then
    if $FORCE; then
      echo "remove         $name"
      rm -rf "$target"
    else
      echo "skip (exists)  $name"
      return 0
    fi
  fi

  local url="https://github.com/${repo}.git"
  printf 'clone          %s  (%s)  [%s]\n' "$name" "$branch" "${files[*]}"

  if $DRY_RUN; then
    printf '  # would run: git clone --depth 1 --filter=blob:none --sparse --single-branch --branch "%s" "%s" "%s"\n' \
      "$branch" "$url" "$target"
    printf '  #             git -C "%s" sparse-checkout set %s\n' \
      "$target" "${files[*]}"
    return 0
  fi

  mkdir -p "$(dirname "$target")"
  if ! git clone --depth 1 --filter=blob:none --sparse --single-branch --branch "$branch" "$url" "$target" >/dev/null; then
    echo "FAILED — clone error (check branch: $branch)" >&2
    rm -rf "$target"
    return 0
  fi
  git -C "$target" sparse-checkout set "${files[@]}" >/dev/null 2>&1 || true
  echo
}

clone_one "nodejs/node"                       "main"   "nodejs/node"                       ".npmrc"
clone_one "expressjs/express"                 "master" "expressjs/express"                 ".npmrc"
clone_one "WordPress/gutenberg"               "trunk"  "WordPress/gutenberg"               ".npmrc"
clone_one "BerriAI/litellm"                   "main"   "BerriAI/litellm"                   ".npmrc"
clone_one "fastify/fastify"                   "main"   "fastify/fastify"                   ".npmrc"
clone_one "withastro/astro"                   "main"   "withastro/astro"                   "pnpm-workspace.yaml"
clone_one "vercel/next.js"                    "canary" "vercel/next.js"                    "pnpm-workspace.yaml"
clone_one "clerk/javascript"                  "main"   "clerk/javascript"                  "pnpm-workspace.yaml"
clone_one "web-infra-dev/rspack"              "main"   "web-infra-dev/rspack"              "pnpm-workspace.yaml"
clone_one "vitejs/vite"                       "main"   "vitejs/vite"                       "pnpm-workspace.yaml"
clone_one "vuejs/core"                        "main"   "vuejs/core"                        "pnpm-workspace.yaml"
clone_one "biomejs/biome"                     "main"   "biomejs/biome"                     "pnpm-workspace.yaml"
clone_one "nuxt/nuxt"                         "main"   "nuxt/nuxt"                         "pnpm-workspace.yaml"
clone_one "TanStack/query"                    "main"   "TanStack/query"                    "pnpm-workspace.yaml"
clone_one "angular/angular"                   "main"   "angular/angular"                   "pnpm-workspace.yaml"
clone_one "vitest-dev/vitest"                 "main"   "vitest-dev/vitest"                 "pnpm-workspace.yaml"
clone_one "oxc-project/oxc"                   "main"   "oxc-project/oxc"                   "pnpm-workspace.yaml"
clone_one "rolldown/rolldown"                 "main"   "rolldown/rolldown"                 "pnpm-workspace.yaml"
clone_one "nrwl/nx"                           "master" "nrwl/nx"                           "pnpm-workspace.yaml"
clone_one "supabase/supabase"                 "master" "supabase/supabase"                 "pnpm-workspace.yaml"
clone_one "tailwindlabs/tailwindcss"          "main"   "tailwindlabs/tailwindcss"          "pnpm-workspace.yaml"
clone_one "docker/actions-toolkit"            "main"   "docker/actions-toolkit"            ".yarnrc.yml"
clone_one "MetaMask/metamask-extension"       "main"   "MetaMask/metamask-extension"       ".yarnrc.yml"
clone_one "electron/electron"                 "main"   "electron/electron"                 ".yarnrc.yml"
clone_one "laurent22/joplin"                  "dev"    "laurent22/joplin"                  ".yarnrc.yml"
clone_one "MetaMask/snaps"                    "main"   "MetaMask/snaps"                    ".yarnrc.yml"
clone_one "babel/babel"                       "main"   "babel/babel"                       ".yarnrc.yml"
clone_one "oven-sh/bun"                       "main"   "oven-sh/bun"                       "bunfig.toml"
clone_one "Uniswap/interface"                 "main"   "Uniswap/interface"                 "bunfig.toml"
clone_one "OpenCut-app/OpenCut"               "main"   "OpenCut-app/OpenCut"               "bunfig.toml"
clone_one "kaito-project/airunway"            "main"   "kaito-project/airunway"            "bunfig.toml"
clone_one "vendurehq/community-plugins"       "main"   "vendurehq/community-plugins"       "bunfig.toml"
clone_one "osmlab/osm-auth"                   "main"   "osmlab/osm-auth"                   "bunfig.toml"
clone_one "yt-dlp/ejs"                        "main"   "yt-dlp/ejs"                        "deno.json"
clone_one "denodrivers/redis"                 "master" "denodrivers/redis"                 "deno.json"
clone_one "oakserver/oak"                     "main"   "oakserver/oak"                     "deno.json"
clone_one "denoland/dnt"                      "main"   "denoland/dnt"                      "deno.jsonc"
clone_one "hexagon/croner"                    "master" "hexagon/croner"                    "deno.json"
clone_one "denoland/fresh"                    "main"   "denoland/fresh"                    "deno.json"
clone_one "denoland/std"                      "main"   "denoland/std"                      "deno.json"
clone_one "yoziru/nextjs-vllm-ui"             "main"   "yoziru/nextjs-vllm-ui"             "aube-workspace.yaml"
clone_one "craftlions/uppy"                   "main"   "craftlions/uppy"                   "aube-workspace.yaml"
clone_one "radiosilence/blit"                 "main"   "radiosilence/blit"                 "aube-workspace.yaml"
clone_one "craftlions/website"                "main"   "craftlions/website"                "aube-workspace.yaml"
clone_one "radiosilence/jaritanet"            "main"   "radiosilence/jaritanet"            "aube-workspace.yaml"
clone_one "leuchtturm-dev/leuchtturm"         "master" "leuchtturm-dev/leuchtturm"         "aube-workspace.yaml"
clone_one "dkarter/dotfiles"                  "master" "dkarter/dotfiles"                  "aube-workspace.yaml"
clone_one "johnsyweb/parkrun-by-public-transport" "main" "johnsyweb/parkrun-by-public-transport" "aube-workspace.yaml"

echo ""
echo "Done."
$DRY_RUN && echo "(dry-run; no clones performed)"
$FORCE && echo "(force mode; existing clones were removed)"
