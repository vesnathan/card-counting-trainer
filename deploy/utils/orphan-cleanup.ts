/**
 * Orphaned Resource Cleanup Utility
 * Scans for and deletes orphaned AWS resources that are no longer associated with active stacks
 */

import {
  CloudFormationClient,
  DescribeStacksCommand,
  ListStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  IAMClient,
  ListRolesCommand,
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
  ListRolePoliciesCommand,
  DeleteRolePolicyCommand,
  DeleteRoleCommand,
} from "@aws-sdk/client-iam";
import {
  LambdaClient,
  ListFunctionsCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  DynamoDBClient,
  ListTablesCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  DeleteUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectVersionsCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  ListDistributionsCommand,
  GetDistributionCommand,
  DeleteDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import { logger } from "./logger";

interface CleanupOptions {
  region: string;
  appName: string;
  stage: string;
  dryRun?: boolean;
}

export class OrphanCleanup {
  private cfnClient: CloudFormationClient;
  private iamClient: IAMClient;
  private lambdaClient: LambdaClient;
  private dynamoClient: DynamoDBClient;
  private cognitoClient: CognitoIdentityProviderClient;
  private s3Client: S3Client;
  private cloudFrontClient: CloudFrontClient;
  private options: CleanupOptions;
  private failedCleanups: Array<{ resource: string; error: string }> = [];

  constructor(options: CleanupOptions) {
    this.options = options;
    this.cfnClient = new CloudFormationClient({ region: options.region });
    this.iamClient = new IAMClient({ region: options.region });
    this.lambdaClient = new LambdaClient({ region: options.region });
    this.dynamoClient = new DynamoDBClient({ region: options.region });
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: options.region,
    });
    this.s3Client = new S3Client({ region: options.region });
    this.cloudFrontClient = new CloudFrontClient({ region: options.region });
  }

  /**
   * Get all active stack names for this app/stage
   */
  private async getActiveStacks(): Promise<Set<string>> {
    const stacks = new Set<string>();
    try {
      const response = await this.cfnClient.send(
        new ListStacksCommand({
          StackStatusFilter: [
            "CREATE_COMPLETE",
            "UPDATE_COMPLETE",
            "UPDATE_ROLLBACK_COMPLETE",
            "ROLLBACK_COMPLETE",
          ],
        }),
      );

      const prefix = `${this.options.appName}-${this.options.stage}`;
      for (const stack of response.StackSummaries || []) {
        if (stack.StackName?.startsWith(prefix)) {
          stacks.add(stack.StackName);
        }
      }
    } catch (error) {
      logger.warning(`Failed to list stacks: ${error}`);
    }
    return stacks;
  }

  /**
   * Check if a resource name matches our app/stage pattern
   */
  private matchesPattern(resourceName: string): boolean {
    const patterns = [
      `${this.options.appName}-${this.options.stage}`,
      `${this.options.appName.toLowerCase()}-${this.options.stage}`,
      `cardcountingtrainer-${this.options.stage}`,
      `bjcct-${this.options.stage}`,
      `cct-${this.options.stage}`,
    ];
    return patterns.some((pattern) => resourceName.includes(pattern));
  }

  /**
   * Clean up orphaned IAM roles
   */
  async cleanupOrphanedRoles(): Promise<void> {
    logger.info("Checking for orphaned IAM roles...");
    try {
      const response = await this.iamClient.send(new ListRolesCommand({}));
      const activeStacks = await this.getActiveStacks();

      for (const role of response.Roles || []) {
        if (!role.RoleName || !this.matchesPattern(role.RoleName)) {
          continue;
        }

        // Check if role is associated with an active stack
        let isOrphaned = true;
        try {
          const roleDetails = await this.iamClient.send(
            new GetRoleCommand({ RoleName: role.RoleName }),
          );
          const tags = roleDetails.Role?.Tags || [];
          const stackTag = tags.find(
            (t) => t.Key === "aws:cloudformation:stack-name",
          );
          if (stackTag && activeStacks.has(stackTag.Value || "")) {
            isOrphaned = false;
          }
        } catch (error) {
          // Role doesn't exist or can't be accessed
        }

        if (isOrphaned) {
          logger.warning(`Found orphaned IAM role: ${role.RoleName}`);
          if (!this.options.dryRun) {
            try {
              await this.deleteRole(role.RoleName);
            } catch (error: any) {
              const errorMsg = `Failed to delete IAM role ${role.RoleName}: ${error.message || error}`;
              logger.error(errorMsg);
              this.failedCleanups.push({
                resource: `IAM Role: ${role.RoleName}`,
                error: error.message || String(error),
              });
            }
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list IAM roles: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "IAM Roles (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Delete an IAM role and all its policies
   */
  private async deleteRole(roleName: string): Promise<void> {
    try {
      // Detach managed policies
      const attachedPolicies = await this.iamClient.send(
        new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
      );
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        await this.iamClient.send(
          new DetachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: policy.PolicyArn,
          }),
        );
      }

      // Delete inline policies
      const inlinePolicies = await this.iamClient.send(
        new ListRolePoliciesCommand({ RoleName: roleName }),
      );
      for (const policyName of inlinePolicies.PolicyNames || []) {
        await this.iamClient.send(
          new DeleteRolePolicyCommand({
            RoleName: roleName,
            PolicyName: policyName,
          }),
        );
      }

      // Delete role
      await this.iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
      logger.info(`✓ Deleted orphaned IAM role: ${roleName}`);
    } catch (error) {
      logger.error(`Failed to delete IAM role ${roleName}: ${error}`);
    }
  }

  /**
   * Clean up orphaned Lambda functions
   */
  async cleanupOrphanedLambdas(): Promise<void> {
    logger.info("Checking for orphaned Lambda functions...");
    try {
      const response = await this.lambdaClient.send(
        new ListFunctionsCommand({}),
      );

      for (const func of response.Functions || []) {
        if (!func.FunctionName || !this.matchesPattern(func.FunctionName)) {
          continue;
        }

        logger.warning(`Found orphaned Lambda function: ${func.FunctionName}`);
        if (!this.options.dryRun) {
          try {
            await this.lambdaClient.send(
              new DeleteFunctionCommand({ FunctionName: func.FunctionName }),
            );
            logger.info(`✓ Deleted orphaned Lambda: ${func.FunctionName}`);
          } catch (error: any) {
            const errorMsg = `Failed to delete Lambda ${func.FunctionName}: ${error.message || error}`;
            logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `Lambda: ${func.FunctionName}`,
              error: error.message || String(error),
            });
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list Lambda functions: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "Lambda Functions (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned DynamoDB tables
   */
  async cleanupOrphanedTables(): Promise<void> {
    logger.info("Checking for orphaned DynamoDB tables...");
    try {
      const response = await this.dynamoClient.send(new ListTablesCommand({}));

      for (const tableName of response.TableNames || []) {
        if (!this.matchesPattern(tableName)) {
          continue;
        }

        logger.warning(`Found orphaned DynamoDB table: ${tableName}`);
        if (!this.options.dryRun) {
          try {
            await this.dynamoClient.send(
              new DeleteTableCommand({ TableName: tableName }),
            );
            logger.info(`✓ Deleted orphaned DynamoDB table: ${tableName}`);
          } catch (error: any) {
            const errorMsg = `Failed to delete DynamoDB table ${tableName}: ${error.message || error}`;
            logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `DynamoDB Table: ${tableName}`,
              error: error.message || String(error),
            });
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list DynamoDB tables: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "DynamoDB Tables (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned Cognito User Pools
   */
  async cleanupOrphanedUserPools(): Promise<void> {
    logger.info("Checking for orphaned Cognito User Pools...");
    try {
      const response = await this.cognitoClient.send(
        new ListUserPoolsCommand({ MaxResults: 60 }),
      );

      for (const pool of response.UserPools || []) {
        if (!pool.Name || !this.matchesPattern(pool.Name)) {
          continue;
        }

        logger.warning(
          `Found orphaned Cognito User Pool: ${pool.Name} (${pool.Id})`,
        );
        if (!this.options.dryRun && pool.Id) {
          try {
            await this.cognitoClient.send(
              new DeleteUserPoolCommand({ UserPoolId: pool.Id }),
            );
            logger.info(`✓ Deleted orphaned Cognito User Pool: ${pool.Name}`);
          } catch (error: any) {
            const errorMsg = `Failed to delete User Pool ${pool.Name}: ${error.message || error}`;
            logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `Cognito User Pool: ${pool.Name} (${pool.Id})`,
              error: error.message || String(error),
            });
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list Cognito User Pools: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "Cognito User Pools (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned S3 buckets
   */
  async cleanupOrphanedBuckets(): Promise<void> {
    logger.info("Checking for orphaned S3 buckets...");
    try {
      const response = await this.s3Client.send(new ListBucketsCommand({}));
      const allBuckets = response.Buckets || [];
      logger.debug(`Found ${allBuckets.length} total S3 buckets`);

      for (const bucket of allBuckets) {
        if (!bucket.Name) {
          continue;
        }

        const matches = this.matchesPattern(bucket.Name);
        logger.debug(`Bucket ${bucket.Name}: matches=${matches}`);

        if (!matches) {
          continue;
        }

        logger.warning(`Found orphaned S3 bucket: ${bucket.Name}`);
        if (!this.options.dryRun) {
          try {
            await this.emptyAndDeleteBucket(bucket.Name);
          } catch (error: any) {
            const errorMsg = `Failed to delete S3 bucket ${bucket.Name}: ${error.message || error}`;
            logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `S3 Bucket: ${bucket.Name}`,
              error: error.message || String(error),
            });
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list S3 buckets: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "S3 Buckets (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Empty and delete an S3 bucket
   */
  private async emptyAndDeleteBucket(bucketName: string): Promise<void> {
    // List and delete all object versions
    let isTruncated = true;
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;

    while (isTruncated) {
      const versions = await this.s3Client.send(
        new ListObjectVersionsCommand({
          Bucket: bucketName,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }),
      );

      // Delete versions
      for (const version of versions.Versions || []) {
        if (version.Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: version.Key,
              VersionId: version.VersionId,
            }),
          );
        }
      }

      // Delete delete markers
      for (const marker of versions.DeleteMarkers || []) {
        if (marker.Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: marker.Key,
              VersionId: marker.VersionId,
            }),
          );
        }
      }

      isTruncated = versions.IsTruncated || false;
      keyMarker = versions.NextKeyMarker;
      versionIdMarker = versions.NextVersionIdMarker;
    }

    // Delete bucket
    await this.s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    logger.info(`✓ Deleted orphaned S3 bucket: ${bucketName}`);
  }

  /**
   * Clean up orphaned CloudFront distributions
   */
  async cleanupOrphanedDistributions(): Promise<void> {
    logger.info("Checking for orphaned CloudFront distributions...");
    try {
      const response = await this.cloudFrontClient.send(
        new ListDistributionsCommand({}),
      );

      for (const dist of response.DistributionList?.Items || []) {
        if (!dist.Comment || !this.matchesPattern(dist.Comment)) {
          continue;
        }

        logger.warning(
          `Found orphaned CloudFront distribution: ${dist.Id} (${dist.Comment})`,
        );
        if (!this.options.dryRun && dist.Id) {
          try {
            // Disable distribution first
            const config = await this.cloudFrontClient.send(
              new GetDistributionConfigCommand({ Id: dist.Id }),
            );
            if (config.DistributionConfig && config.ETag) {
              config.DistributionConfig.Enabled = false;
              await this.cloudFrontClient.send(
                new UpdateDistributionCommand({
                  Id: dist.Id,
                  DistributionConfig: config.DistributionConfig,
                  IfMatch: config.ETag,
                }),
              );
              logger.info(
                `✓ Disabled CloudFront distribution: ${dist.Id} (will delete after propagation)`,
              );
            }
          } catch (error: any) {
            const errorMsg = `Failed to disable CloudFront distribution ${dist.Id}: ${error.message || error}`;
            logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `CloudFront Distribution: ${dist.Id} (${dist.Comment})`,
              error: error.message || String(error),
            });
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to list CloudFront distributions: ${error.message || error}`;
      logger.error(errorMsg);
      this.failedCleanups.push({
        resource: "CloudFront Distributions (list operation)",
        error: error.message || String(error),
      });
    }
  }

  /**
   * Run full cleanup
   */
  async cleanupAll(): Promise<void> {
    logger.info(
      `Starting orphan cleanup for ${this.options.appName}-${this.options.stage}${this.options.dryRun ? " (DRY RUN)" : ""}`,
    );

    // Reset failed cleanups tracker
    this.failedCleanups = [];

    await this.cleanupOrphanedLambdas();
    await this.cleanupOrphanedTables();
    await this.cleanupOrphanedUserPools();
    await this.cleanupOrphanedRoles();
    await this.cleanupOrphanedBuckets();
    await this.cleanupOrphanedDistributions();

    // Check if any cleanups failed and throw error with details
    if (this.failedCleanups.length > 0) {
      const failureDetails = this.failedCleanups
        .map((f) => `  - ${f.resource}: ${f.error}`)
        .join("\n");

      const errorMsg = `Orphan cleanup failed for ${this.failedCleanups.length} resource(s):\n${failureDetails}`;
      logger.error(errorMsg);

      throw new Error(errorMsg);
    }

    logger.info("Orphan cleanup complete");
  }
}

/**
 * CLI execution
 */
if (require.main === module) {
  const region = process.env.AWS_REGION || "ap-southeast-2";
  const appName = "cardcountingtrainer";
  const stage = process.argv[2] || "dev";
  const dryRun = process.argv.includes("--dry-run");

  const cleanup = new OrphanCleanup({ region, appName, stage, dryRun });
  cleanup.cleanupAll().catch((error) => {
    logger.error(`Cleanup failed: ${error}`);
    process.exit(1);
  });
}
