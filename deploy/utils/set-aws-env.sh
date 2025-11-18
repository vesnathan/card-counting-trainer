#!/bin/bash
# Script to set AWS environment variables from mono-repo root .env file


# Path to the root .env file (absolute path)
# Use BASH_SOURCE so this works whether the script is executed or sourced
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROOT_ENV_FILE="${PROJECT_ROOT}/.env"

# Check if the .env file exists
if [ ! -f "$ROOT_ENV_FILE" ]; then
    echo "❌ .env file not found at $ROOT_ENV_FILE"
    echo "💡 Create a .env file in the mono-repo root with AWS credentials"
    exit 1
fi

echo "🔑 Loading AWS credentials from mono-repo root..."
source "$ROOT_ENV_FILE"

# Verify credentials are loaded
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "❌ AWS credentials not found in .env file"
    echo "💡 The .env file should contain AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    exit 1
fi

# Export the variables so they're available to child processes
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_ACCOUNT_ID
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"

echo "✅ AWS credentials loaded successfully"
echo "🌍 Region: $AWS_REGION"
echo "🔑 Access Key: ${AWS_ACCESS_KEY_ID:0:8}..."
