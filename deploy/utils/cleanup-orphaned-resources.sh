#!/bin/bash

# Cleanup Orphaned AWS Resources for The Story Hub
# This script automatically removes orphaned resources from failed deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load AWS credentials from .env
if [ -f "$(dirname "$0")/../../.env" ]; then
    source "$(dirname "$0")/../../.env"
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    export AWS_REGION
fi

STAGE="${1:-dev}"
APP_NAME="thestoryhub"

echo -e "${BLUE}🧹 Starting cleanup of orphaned resources for ${APP_NAME}-${STAGE}${NC}"
echo ""

# Function to delete S3 buckets
cleanup_s3_buckets() {
    echo -e "${YELLOW}📦 Checking for S3 buckets...${NC}"
    local buckets=$(aws s3 ls | grep "${APP_NAME}" | awk '{print $3}')

    if [ -z "$buckets" ]; then
        echo -e "${GREEN}✓ No S3 buckets found${NC}"
        return
    fi

    for bucket in $buckets; do
        echo -e "${YELLOW}  Deleting bucket: ${bucket}${NC}"
        aws s3 rb "s3://${bucket}" --force 2>&1 | grep -v "^delete:" || true
        echo -e "${GREEN}  ✓ Deleted ${bucket}${NC}"
    done
}

# Function to delete Lambda functions
cleanup_lambda_functions() {
    echo -e "${YELLOW}λ Checking for Lambda functions...${NC}"
    local functions=$(aws lambda list-functions \
        --query "Functions[?contains(FunctionName, '${APP_NAME}') && contains(FunctionName, '${STAGE}')].FunctionName" \
        --output text)

    if [ -z "$functions" ]; then
        echo -e "${GREEN}✓ No Lambda functions found${NC}"
        return
    fi

    for func in $functions; do
        echo -e "${YELLOW}  Deleting function: ${func}${NC}"
        aws lambda delete-function --function-name "$func" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${func}${NC}"
    done
}

# Function to delete IAM roles
cleanup_iam_roles() {
    echo -e "${YELLOW}🔑 Checking for IAM roles...${NC}"
    local roles=$(aws iam list-roles \
        --query "Roles[?contains(RoleName, '${APP_NAME}') && contains(RoleName, '${STAGE}')].RoleName" \
        --output text)

    if [ -z "$roles" ]; then
        echo -e "${GREEN}✓ No IAM roles found${NC}"
        return
    fi

    for role in $roles; do
        echo -e "${YELLOW}  Processing role: ${role}${NC}"

        # Detach managed policies
        local managed_policies=$(aws iam list-attached-role-policies \
            --role-name "$role" \
            --query 'AttachedPolicies[].PolicyArn' \
            --output text 2>/dev/null || echo "")

        for policy in $managed_policies; do
            [ -n "$policy" ] && aws iam detach-role-policy --role-name "$role" --policy-arn "$policy" 2>/dev/null || true
        done

        # Delete inline policies
        local inline_policies=$(aws iam list-role-policies \
            --role-name "$role" \
            --query 'PolicyNames' \
            --output text 2>/dev/null || echo "")

        for policy in $inline_policies; do
            [ -n "$policy" ] && aws iam delete-role-policy --role-name "$role" --policy-name "$policy" 2>/dev/null || true
        done

        # Delete the role
        aws iam delete-role --role-name "$role" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${role}${NC}"
    done
}

# Function to delete Cognito user pools
cleanup_cognito_pools() {
    echo -e "${YELLOW}👤 Checking for Cognito user pools...${NC}"
    local pools=$(aws cognito-idp list-user-pools --max-results 60 \
        --query "UserPools[?contains(Name, '${APP_NAME}') || contains(Name, 'tsh')].Id" \
        --output text)

    if [ -z "$pools" ]; then
        echo -e "${GREEN}✓ No Cognito user pools found${NC}"
        return
    fi

    for pool_id in $pools; do
        local pool_name=$(aws cognito-idp describe-user-pool --user-pool-id "$pool_id" \
            --query 'UserPool.Name' --output text 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}  Deleting pool: ${pool_name} (${pool_id})${NC}"
        aws cognito-idp delete-user-pool --user-pool-id "$pool_id" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${pool_name}${NC}"
    done
}

# Function to delete DynamoDB tables
cleanup_dynamodb_tables() {
    echo -e "${YELLOW}📊 Checking for DynamoDB tables...${NC}"
    local tables=$(aws dynamodb list-tables \
        --query "TableNames[?contains(@, '${APP_NAME}') || contains(@, 'tsh')]" \
        --output text)

    if [ -z "$tables" ]; then
        echo -e "${GREEN}✓ No DynamoDB tables found${NC}"
        return
    fi

    for table in $tables; do
        echo -e "${YELLOW}  Deleting table: ${table}${NC}"
        aws dynamodb delete-table --table-name "$table" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${table}${NC}"
    done
}

# Function to delete CloudFormation stacks
cleanup_cloudformation_stacks() {
    echo -e "${YELLOW}📚 Checking for CloudFormation stacks...${NC}"
    local stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE ROLLBACK_COMPLETE UPDATE_ROLLBACK_COMPLETE CREATE_FAILED UPDATE_FAILED \
        --query "StackSummaries[?contains(StackName, '${APP_NAME}') && contains(StackName, '${STAGE}')].StackName" \
        --output text)

    if [ -z "$stacks" ]; then
        echo -e "${GREEN}✓ No CloudFormation stacks found${NC}"
        return
    fi

    for stack in $stacks; do
        echo -e "${YELLOW}  Deleting stack: ${stack}${NC}"
        aws cloudformation delete-stack --stack-name "$stack" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Delete initiated for ${stack}${NC}"
    done
}

# Function to delete AppSync APIs
cleanup_appsync_apis() {
    echo -e "${YELLOW}🔌 Checking for AppSync APIs...${NC}"
    local apis=$(aws appsync list-graphql-apis \
        --query "graphqlApis[?contains(name, '${APP_NAME}') || contains(name, '${STAGE}')].apiId" \
        --output text 2>/dev/null || echo "")

    if [ -z "$apis" ]; then
        echo -e "${GREEN}✓ No AppSync APIs found${NC}"
        return
    fi

    for api_id in $apis; do
        local api_name=$(aws appsync get-graphql-api --api-id "$api_id" \
            --query 'graphqlApi.name' --output text 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}  Deleting API: ${api_name} (${api_id})${NC}"
        aws appsync delete-graphql-api --api-id "$api_id" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${api_name}${NC}"
    done
}

# Function to delete Secrets Manager secrets
cleanup_secrets() {
    echo -e "${YELLOW}🔐 Checking for Secrets Manager secrets...${NC}"
    local secrets=$(aws secretsmanager list-secrets \
        --query "SecretList[?contains(Name, '${APP_NAME}')].Name" \
        --output text 2>/dev/null || echo "")

    if [ -z "$secrets" ]; then
        echo -e "${GREEN}✓ No secrets found${NC}"
        return
    fi

    for secret in $secrets; do
        echo -e "${YELLOW}  Deleting secret: ${secret}${NC}"
        aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery 2>/dev/null || true
        echo -e "${GREEN}  ✓ Deleted ${secret}${NC}"
    done
}

# Main execution
echo -e "${BLUE}Starting cleanup process...${NC}"
echo ""

cleanup_cloudformation_stacks
sleep 2
cleanup_s3_buckets
cleanup_lambda_functions
cleanup_iam_roles
cleanup_cognito_pools
cleanup_dynamodb_tables
cleanup_appsync_apis
cleanup_secrets

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo -e "${BLUE}Summary of actions:${NC}"
echo "  - Deleted all CloudFormation stacks"
echo "  - Deleted all S3 buckets"
echo "  - Deleted all Lambda functions"
echo "  - Deleted all IAM roles (with policies)"
echo "  - Deleted all Cognito user pools"
echo "  - Deleted all DynamoDB tables"
echo "  - Deleted all AppSync APIs"
echo "  - Deleted all Secrets Manager secrets"
echo ""
echo -e "${YELLOW}Note: CloudFormation stacks may take a few minutes to fully delete.${NC}"
