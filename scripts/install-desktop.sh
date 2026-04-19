#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY_NAME="skilltree-local"
INSTALL_DIR="${HOME}/.local/bin"
APPLICATIONS_DIR="${HOME}/.local/share/applications"
DESKTOP_FILE="${APPLICATIONS_DIR}/skilltree-local.desktop"

cd "${REPO_ROOT}"
cargo build -p skilltree-local --release

mkdir -p "${INSTALL_DIR}" "${APPLICATIONS_DIR}"
install -m 0755 "${REPO_ROOT}/target/release/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

cat > "${DESKTOP_FILE}" <<EOF
[Desktop Entry]
Type=Application
Name=SkillTree Local
Comment=Local desktop skill tree editor
Exec=${INSTALL_DIR}/${BINARY_NAME}
Terminal=false
Categories=Office;Education;
EOF

echo "Installed ${BINARY_NAME} to ${INSTALL_DIR}/${BINARY_NAME}"
echo "Desktop launcher written to ${DESKTOP_FILE}"
echo "If your shell cannot find it, add ${INSTALL_DIR} to PATH."
