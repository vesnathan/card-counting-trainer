#!/bin/bash

# Install AWS CLI v2 locally in project directory
# This creates a local AWS CLI installation that doesn't require system-wide installation

set -e  # Exit on error

echo "========================================="
echo "AWS CLI Local Installation"
echo "========================================="

# Determine the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SCRIPT_DIR}/.local-aws/v2"
AWS_VERSION="2.27.45"

echo "Installation directory: $INSTALL_DIR"

# Check if already installed
if [ -f "${INSTALL_DIR}/${AWS_VERSION}/dist/aws" ]; then
    echo "✅ AWS CLI v${AWS_VERSION} is already installed at ${INSTALL_DIR}/${AWS_VERSION}"
    echo ""
    echo "To use this AWS CLI, run:"
    echo "  ${INSTALL_DIR}/${AWS_VERSION}/dist/aws --version"
    echo ""
    echo "Or add to your PATH temporarily:"
    echo "  export PATH=\"${INSTALL_DIR}/${AWS_VERSION}/dist:\$PATH\""
    exit 0
fi

# Create installation directory
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

echo ""
echo "Downloading AWS CLI v2..."
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWS_VERSION}.zip" -o "awscliv2.zip"

echo "Extracting..."
unzip -q awscliv2.zip

echo "Installing to ${INSTALL_DIR}/${AWS_VERSION}..."
./aws/install --install-dir "${INSTALL_DIR}/${AWS_VERSION}" --bin-dir "${INSTALL_DIR}/${AWS_VERSION}/dist" --update

# Clean up
rm -rf aws awscliv2.zip

# Create a symlink to 'current' version
ln -sf "${INSTALL_DIR}/${AWS_VERSION}" "${INSTALL_DIR}/current"

echo ""
echo "========================================="
echo "✅ AWS CLI Installation Complete!"
echo "========================================="
echo ""
echo "AWS CLI installed at: ${INSTALL_DIR}/${AWS_VERSION}/dist/aws"
echo ""
echo "To use this AWS CLI:"
echo "  ${INSTALL_DIR}/${AWS_VERSION}/dist/aws --version"
echo ""
echo "Or add to your PATH:"
echo "  export PATH=\"${INSTALL_DIR}/${AWS_VERSION}/dist:\$PATH\""
echo ""
echo "Or use the 'current' symlink:"
echo "  ${INSTALL_DIR}/current/dist/aws --version"
