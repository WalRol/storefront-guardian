#!/usr/bin/env bash
# Abre un PR para la demo en vivo y sigue el check de Guardian hasta que termina.
#
#   scripts/demo-pr.sh <id>                  Un caso preparado de demo/bugs/<id>
#   scripts/demo-pr.sh --live "<título>"     Los cambios sin commitear en storefront-demo/
#                                            (el bug que escribe el evaluador)
#
# La rama se arma en un worktree temporal sobre origin/main: tu carpeta de trabajo no se toca.
set -euo pipefail

# En Windows, gh puede no estar en el PATH de Git Bash hasta reiniciar la terminal.
command -v gh >/dev/null || export PATH="$PATH:/c/Program Files/GitHub CLI"

root=$(git rev-parse --show-toplevel)
cd "$root"
patch=$(mktemp)
body_file=$(mktemp)

if [[ "${1:-}" == "--live" ]]; then
  title=${2:?Uso: scripts/demo-pr.sh --live "<título>"}
  git diff -- storefront-demo >"$patch"
  [[ -s "$patch" ]] || { echo "No hay cambios sin commitear en storefront-demo/." >&2; exit 1; }
  echo "Cambio escrito en vivo durante la demo." >"$body_file"
  branch="demo/live-$(date +%H%M%S)"
else
  id=${1:?Uso: scripts/demo-pr.sh <id> | --live "<título>"}
  dir="demo/bugs/$id"
  [[ -f "$dir/change.patch" ]] || { echo "No existe $dir/change.patch" >&2; exit 1; }
  cp "$dir/change.patch" "$patch"
  title=$(node -p "require('./$dir/bug.json').title")
  node -p "require('./$dir/bug.json').body" >"$body_file"
  branch="demo/$id-$(date +%H%M%S)"
fi

git fetch -q origin main
worktree=$(mktemp -d)
trap 'git worktree remove --force "$worktree" >/dev/null 2>&1 || true; rm -f "$patch" "$body_file"' EXIT
git worktree add -q -b "$branch" "$worktree" origin/main
git -C "$worktree" apply --index "$patch"
git -C "$worktree" commit -q -m "$title"
git -C "$worktree" push -q -u origin "$branch"

url=$(gh pr create --base main --head "$branch" --title "$title" --body-file "$body_file")
echo "PR abierto: $url"
started=$(date +%s)

# El check tarda unos segundos en registrarse después de abrir el PR.
for _ in $(seq 1 12); do
  gh pr checks "$url" 2>&1 | grep -q "no checks reported" || break
  sleep 5
done
gh pr checks "$url" --watch --interval 10 || true
echo "Guardian terminó en $(( $(date +%s) - started )) s. Comentario: $url"
