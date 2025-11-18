#!/bin/bash
# Script to set AWS credentials in the environment

# Set your AWS credentials here
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_REGION="ap-southeast-2"
# Uncomment if using temporary credentials
# export AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN"

echo "AWS credentials set in environment variables."
echo "Region set to: $AWS_REGION"
