#!/usr/bin/env bash
# Instalador do Dia para Linux (x86_64, glibc 2.34+), sem sudo:
#
#   curl -fsSL https://raw.githubusercontent.com/felipebrgs1/Dia/main/install.sh | bash
#
# Opções (depois de `bash -s --` quando vier pelo curl):
#   --version v0.1.0   instala uma versão específica (padrão: a última)
#   --uninstall        remove o Dia (as notas em ~/Dia nunca são tocadas)
#
# Instala em ~/.local (ou $DIA_PREFIX): o programa em share/dia, o comando `dia` em bin, o atalho
# do menu e o ícone. Rodar de novo atualiza. DIA_INSTALL_FILE=<arquivo .tar.gz> instala um pacote
# local em vez de baixar (para testar um build); DIA_RELEASE_URL troca de onde os arquivos vêm.

set -euo pipefail

REPO="felipebrgs1/Dia"
APP_ID="dev.nodebuilder.dia"
PREFIX="${DIA_PREFIX:-$HOME/.local}"
APP_DIR="$PREFIX/share/dia"
BIN_LINK="$PREFIX/bin/dia"
DESKTOP_FILE="$PREFIX/share/applications/$APP_ID.desktop"
ICON_FILE="$PREFIX/share/icons/hicolor/scalable/apps/$APP_ID.svg"

if [ -t 1 ]; then
  bold=$'\033[1m' dim=$'\033[2m' amber=$'\033[33m' red=$'\033[31m' green=$'\033[32m' reset=$'\033[0m'
else
  bold="" dim="" amber="" red="" green="" reset=""
fi
info() { printf '%s\n' "${amber}☀${reset} $*"; }
ok() { printf '%s\n' "${green}✓${reset} $*"; }
die() {
  printf '%s\n' "${red}erro:${reset} $*" >&2
  exit 1
}

refresh_menus() {
  command -v update-desktop-database >/dev/null && update-desktop-database -q "$PREFIX/share/applications" 2>/dev/null || true
  command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
}

version=""
uninstall=0
while [ $# -gt 0 ]; do
  case "$1" in
    --version) version="${2:-}"; shift 2 ;;
    --version=*) version="${1#*=}"; shift ;;
    --uninstall) uninstall=1; shift ;;
    -h | --help) sed -n '2,13p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "opção desconhecida: $1" ;;
  esac
done

if [ "$uninstall" = 1 ]; then
  rm -rf "$APP_DIR"
  rm -f "$BIN_LINK" "$DESKTOP_FILE" "$ICON_FILE"
  refresh_menus
  ok "Dia removido. Suas notas (~/Dia ou \$DIA_VAULT) continuam onde estavam."
  exit 0
fi

# ---- Requisitos ---------------------------------------------------------------------------

[ "$(uname -s)" = "Linux" ] || die "o Dia é só para Linux por enquanto."
arch="$(uname -m)"
[ "$arch" = "x86_64" ] || die "arquitetura $arch não suportada (só x86_64 por enquanto)."

glibc="$(ldd --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+$' || true)"
[ -n "$glibc" ] || die "não encontrei a glibc (distros com musl, como Alpine, não são suportadas)."
if [ "$(printf '%s\n2.34\n' "$glibc" | sort -V | head -n1)" != "2.34" ]; then
  die "o Dia precisa da glibc 2.34 ou mais nova (esta máquina tem $glibc): Ubuntu 22.04+, Debian 12+, Fedora 35+..."
fi

for tool in tar sha256sum; do
  command -v "$tool" >/dev/null || die "preciso do comando '$tool'."
done
if command -v curl >/dev/null; then
  fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }
  fetch_text() { curl -fsSL --retry 3 "$1"; }
elif command -v wget >/dev/null; then
  fetch() { wget -q -O "$2" "$1"; }
  fetch_text() { wget -q -O - "$1"; }
else
  die "preciso do curl ou do wget."
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# ---- Pacote -------------------------------------------------------------------------------

if [ -n "${DIA_INSTALL_FILE:-}" ]; then
  [ -f "$DIA_INSTALL_FILE" ] || die "arquivo não encontrado: $DIA_INSTALL_FILE"
  info "Instalando o pacote local ${bold}$DIA_INSTALL_FILE${reset} ${dim}(sem conferir checksum)${reset}"
  cp "$DIA_INSTALL_FILE" "$tmp/dia.tar.gz"
else
  if [ -z "$version" ]; then
    version="$(fetch_text "https://api.github.com/repos/$REPO/releases/latest" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)"
    [ -n "$version" ] || die "não consegui descobrir a última versão (sem internet, ou nenhum release publicado)."
  fi
  case "$version" in v*) ;; *) version="v$version" ;; esac
  asset="dia-${version#v}-linux-x86_64.tar.gz"
  base="${DIA_RELEASE_URL:-https://github.com/$REPO/releases/download/$version}"

  info "Baixando o Dia ${bold}$version${reset}..."
  fetch "$base/$asset" "$tmp/$asset" || die "falha ao baixar $base/$asset"
  fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS" || die "falha ao baixar a lista de checksums"
  (cd "$tmp" && grep " $asset\$" SHA256SUMS | sha256sum -c --status) || die "o checksum não confere: download corrompido ou adulterado."
  ok "Checksum conferido"
  mv "$tmp/$asset" "$tmp/dia.tar.gz"
fi

mkdir -p "$tmp/x"
tar -xzf "$tmp/dia.tar.gz" -C "$tmp/x"
root="$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d | head -n1)"
[ -x "$root/usr/bin/dia" ] || die "pacote inesperado: não tem usr/bin/dia."

# ---- Instalação ---------------------------------------------------------------------------

mkdir -p "$APP_DIR" "$(dirname "$BIN_LINK")" "$(dirname "$DESKTOP_FILE")" "$(dirname "$ICON_FILE")"
# Troca o executável de uma vez, mesmo com o Dia aberto (o processo antigo segue com o arquivo velho).
install -m 755 "$root/usr/bin/dia" "$APP_DIR/dia.new"
mv -f "$APP_DIR/dia.new" "$APP_DIR/dia"
ln -sf "$APP_DIR/dia" "$BIN_LINK"
install -m 644 "$root/usr/share/icons/hicolor/scalable/apps/$APP_ID.svg" "$ICON_FILE"
# O menu nem sempre tem ~/.local/bin no PATH: o atalho aponta para o caminho completo.
sed "s|^Exec=dia|Exec=$APP_DIR/dia|" "$root/usr/share/applications/$APP_ID.desktop" > "$DESKTOP_FILE"
chmod 644 "$DESKTOP_FILE"
refresh_menus

ok "Dia ${version:-local} instalado em ${bold}$APP_DIR${reset}"
printf '  Abra pelo menu de aplicativos ou rode %s\n' "${bold}dia${reset}"
case ":$PATH:" in
  *":$PREFIX/bin:"*) ;;
  *) printf '  %s\n' "${dim}Para usar o comando no terminal, adicione $PREFIX/bin ao PATH.${reset}" ;;
esac
printf '  %s\n' "${dim}Para remover: curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- --uninstall${reset}"
