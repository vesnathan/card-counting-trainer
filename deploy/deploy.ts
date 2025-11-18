import { config } from "dotenv";
import * as path from "path";

// Load environment variables from .env file
config({ path: path.resolve(__dirname, "../.env") });

import {
  CloudFormationClient,
  Parameter,
  Capability,
  CreateStackCommand,
  UpdateStackCommand,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  DeleteStackCommand,
} from "@aws-sdk/client-cloudformation";
import {
  S3,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
  _Object,
  PutPublicAccessBlockCommand,
  PutBucketVersioningCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import {
  DeploymentOptions,
  DeploymentAction,
  StackType,
  getStackName,
  getTemplateBucketName,
  TEMPLATE_PATHS,
  TEMPLATE_RESOURCES_PATHS,
} from "./types";
import { logger, setLogFile, closeLogFile } from "./utils/logger";
import { IamManager } from "./utils/iam-manager";
import { ResolverCompiler } from "./utils/resolver-compiler";
import { LambdaCompiler } from "./utils/lambda-compiler";
import { S3BucketManager } from "./utils/s3-bucket-manager";
import { OutputsManager } from "./outputs-manager";
import { candidateExportNames } from "./utils/export-names";
import { seedDB } from "./utils/seed-db";
import { addAppSyncBucketPolicy } from "./utils/s3-resolver-validator";
import { cleanupLogGroups } from "./utils/loggroup-cleanup";
import { createReadStream, readFileSync, readdirSync, statSync, existsSync } from "fs";
import { rm } from "fs/promises";
import { execSync } from "child_process";
import { UserSetupManager } from "./utils/user-setup";
import { OrphanCleanup } from "./utils/orphan-cleanup";

const findYamlFiles = (dir: string): string[] => {
  const files = readdirSync(dir);
  let yamlFiles: string[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      yamlFiles = yamlFiles.concat(findYamlFiles(filePath));
    } else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
      yamlFiles.push(filePath);
    }
  }

  return yamlFiles;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      logger.warning(
        `Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
      );
      await sleep(RETRY_DELAY * attempt);
    }
  }
  throw new Error("Unexpected: Should not reach here");
}

// Helper function to empty an S3 bucket
async function emptyBucket(s3: S3, bucketName: string): Promise<void> {
  try {
    let continuationToken: string | undefined;
    let deletedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });
      const listResponse = await s3.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: listResponse.Contents.map((obj: _Object) => ({
              Key: obj.Key!,
            })),
          },
        });
        await s3.send(deleteCommand);
        deletedCount += listResponse.Contents.length;
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    if (deletedCount > 0) {
      logger.debug(`    Deleted ${deletedCount} objects from ${bucketName}`);
    }
  } catch (error: any) {
    if (error.name === "NoSuchBucket") {
      logger.debug(`    Bucket ${bucketName} does not exist`);
    } else {
      throw error;
    }
  }
}

// Helper function to wait for stack deletion
async function waitForStackDeletion(
  cfn: CloudFormationClient,
  stackName: string,
): Promise<void> {
  const maxAttempts = 120; // 20 minutes
  const delay = 10000; // 10 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const describeResponse = await cfn.send(
        new DescribeStacksCommand({ StackName: stackName }),
      );

      const status = describeResponse.Stacks?.[0]?.StackStatus;

      if (status === "DELETE_COMPLETE") {
        logger.success(`Stack ${stackName} deleted successfully`);
        return;
      }

      if (status === "DELETE_FAILED") {
        throw new Error(`Stack deletion failed with status: ${status}`);
      }

      // Still deleting, wait and try again
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error: any) {
      // Stack not found means it was deleted
      if (
        error.name === "ValidationError" ||
        error.message?.includes("does not exist")
      ) {
        logger.success(`Stack ${stackName} deleted successfully`);
        return;
      }

      if (i === maxAttempts - 1) {
        throw error;
      }

      logger.warning(
        `Error checking stack status (attempt ${i + 1}/${maxAttempts}): ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `Timeout waiting for stack ${stackName} deletion after ${(maxAttempts * delay) / 1000} seconds`,
  );
}

// Helper function to force delete a stack with retry logic for failed resources
async function forceDeleteStack(
  cfn: CloudFormationClient,
  stackName: string,
): Promise<void> {
  // Try normal deletion first
  logger.info(`⏳ Attempting stack deletion...`);
  try {
    await cfn.send(new DeleteStackCommand({ StackName: stackName }));
    await waitForStackDeletion(cfn, stackName);
    return; // Success!
  } catch (error: any) {
    if (error.name === "ValidationError" || error.message?.includes("does not exist")) {
      logger.info("Stack does not exist");
      return;
    }

    // Check if deletion failed
    const describeResponse = await cfn.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    const status = describeResponse.Stacks?.[0]?.StackStatus;

    if (status !== "DELETE_FAILED") {
      throw error; // Some other error
    }

    logger.warning(
      "⚠️  Stack deletion failed, identifying problematic resources...",
    );
  }

  // Get failed resources
  const eventsResponse = await cfn.send(
    new DescribeStackEventsCommand({ StackName: stackName }),
  );

  const failedResources = eventsResponse.StackEvents?.filter(
    (event) =>
      event.ResourceStatus === "DELETE_FAILED" &&
      event.LogicalResourceId !== stackName,
  )
    .map((event) => event.LogicalResourceId!)
    .filter((id, index, self) => self.indexOf(id) === index); // unique

  if (!failedResources || failedResources.length === 0) {
    throw new Error("Stack deletion failed but no failed resources found");
  }

  logger.warning(
    `🔧 Retrying deletion while retaining ${failedResources.length} failed resource(s):`,
  );
  failedResources.forEach((resourceId) => {
    logger.warning(`  - ${resourceId}`);
  });

  // Retry deletion with --retain-resources
  await cfn.send(
    new DeleteStackCommand({
      StackName: stackName,
      RetainResources: failedResources,
    }),
  );

  await waitForStackDeletion(cfn, stackName);

  logger.info("✓ Stack deleted (some resources retained)");
  logger.info(
    "💡 You may need to manually delete retained resources from AWS Console",
  );
}

// Deploy DNS stack to us-east-1 (ACM certificates for CloudFront must be in us-east-1)
async function deployDNSStack(
  domainName: string,
  hostedZoneId: string,
  stage: string,
  cloudFrontDomainName?: string,
): Promise<string> {
  const region = "us-east-1"; // ACM certs for CloudFront MUST be in us-east-1
  const cfn = new CloudFormationClient({ region });
  const s3 = new S3({ region });
  const stackName = `cardcountingtrainer-dns-${stage}`;
  const templateBucketName = `cardcountingtrainer-dns-templates-${stage}`;

  logger.info(`📋 Deploying DNS stack to us-east-1 for domain: ${domainName}`);

  // Create S3 bucket for DNS template in us-east-1
  const s3BucketManager = new S3BucketManager(region);
  const bucketExists =
    await s3BucketManager.ensureBucketExists(templateBucketName);
  if (!bucketExists) {
    throw new Error(
      `Failed to create DNS template bucket ${templateBucketName} in us-east-1`,
    );
  }

  // Upload DNS template to S3
  const dnsTemplatePath = path.join(__dirname, "resources/DNS/dns.yaml");
  const dnsTemplateKey = "dns.yaml";

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: templateBucketName,
        Key: dnsTemplateKey,
        Body: createReadStream(dnsTemplatePath),
        ContentType: "application/x-yaml",
      }),
    );
    logger.debug("DNS template uploaded to us-east-1");
  } catch (error: any) {
    throw new Error(`Failed to upload DNS template: ${error.message}`);
  }

  // Prepare CloudFormation parameters
  const stackParams: Parameter[] = [
    { ParameterKey: "Stage", ParameterValue: stage },
    { ParameterKey: "DomainName", ParameterValue: domainName },
    { ParameterKey: "HostedZoneId", ParameterValue: hostedZoneId },
    {
      ParameterKey: "CloudFrontDomainName",
      ParameterValue: cloudFrontDomainName || "",
    },
  ];

  const templateUrl = `https://s3.${region}.amazonaws.com/${templateBucketName}/${dnsTemplateKey}`;

  // Check if stack exists
  let stackExists = false;
  try {
    const describeResponse = await cfn.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    stackExists = !!(
      describeResponse.Stacks && describeResponse.Stacks.length > 0
    );
  } catch (error: any) {
    if (
      error.name === "ValidationError" ||
      error.message?.includes("does not exist")
    ) {
      stackExists = false;
    } else {
      throw error;
    }
  }

  // Create or update stack
  if (stackExists) {
    logger.info(`Updating DNS stack in us-east-1...`);
    try {
      await cfn.send(
        new UpdateStackCommand({
          StackName: stackName,
          TemplateURL: templateUrl,
          Parameters: stackParams,
          Capabilities: [Capability.CAPABILITY_NAMED_IAM],
        }),
      );
      await waitForStackCompletion(cfn, stackName, "UPDATE");
    } catch (error: any) {
      if (error.message?.includes("No updates are to be performed")) {
        logger.info("DNS stack is already up to date");
      } else {
        throw error;
      }
    }
  } else {
    logger.info(`Creating DNS stack in us-east-1...`);
    logger.info(
      `⏳ This may take 5-10 minutes for ACM certificate validation...`,
    );
    await cfn.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateURL: templateUrl,
        Parameters: stackParams,
        Capabilities: [Capability.CAPABILITY_NAMED_IAM],
      }),
    );
    await waitForStackCompletion(cfn, stackName, "CREATE");
  }

  // Get certificate ARN from stack outputs
  const stackData = await cfn.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  const certificateArn = stackData.Stacks?.[0]?.Outputs?.find(
    (output) => output.OutputKey === "CertificateArn",
  )?.OutputValue;

  if (!certificateArn) {
    throw new Error("Failed to get Certificate ARN from DNS stack outputs");
  }

  logger.success(`✓ DNS stack deployed successfully in us-east-1`);
  logger.info(`📜 Certificate ARN: ${certificateArn}`);

  return certificateArn;
}

// Update CloudFront distribution with custom domain and certificate
async function updateCloudFrontWithDomain(
  distributionId: string,
  certificateArn: string,
  domainName: string,
): Promise<void> {
  const cloudfront = new CloudFrontClient({ region: "us-east-1" }); // CloudFront is global but API is in us-east-1

  logger.info(`☁️  Updating CloudFront distribution ${distributionId}...`);

  // Get current distribution configuration
  const getConfigResponse = await cloudfront.send(
    new GetDistributionConfigCommand({ Id: distributionId }),
  );

  const config = getConfigResponse.DistributionConfig;
  const etag = getConfigResponse.ETag;

  if (!config || !etag) {
    throw new Error("Failed to get CloudFront distribution configuration");
  }

  // Update configuration with custom domain and certificate
  config.Aliases = {
    Quantity: 2,
    Items: [domainName, `www.${domainName}`],
  };

  config.ViewerCertificate = {
    ACMCertificateArn: certificateArn,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: "TLSv1.2_2021",
    Certificate: certificateArn,
    CertificateSource: "acm",
  };

  // Update the distribution
  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: distributionId,
      DistributionConfig: config,
      IfMatch: etag,
    }),
  );

  logger.success(
    `✓ CloudFront distribution updated with custom domain: ${domainName}`,
  );
}

// Recursively find all .ts files
function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  } catch (error: any) {
    logger.warning(`Error reading directory ${dir}: ${error.message}`);
  }
  return files;
}

// Helper function to wait for stack creation or update to complete
async function waitForStackCompletion(
  cfn: CloudFormationClient,
  stackName: string,
  operation: "CREATE" | "UPDATE",
): Promise<void> {
  const maxAttempts = 120; // 20 minutes
  const delay = 10000; // 10 seconds

  const inProgressStatuses =
    operation === "CREATE"
      ? ["CREATE_IN_PROGRESS", "REVIEW_IN_PROGRESS"]
      : ["UPDATE_IN_PROGRESS", "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS"];

  const successStatus =
    operation === "CREATE" ? "CREATE_COMPLETE" : "UPDATE_COMPLETE";
  const failureStatuses =
    operation === "CREATE"
      ? [
          "CREATE_FAILED",
          "ROLLBACK_COMPLETE",
          "ROLLBACK_FAILED",
          "ROLLBACK_IN_PROGRESS",
        ]
      : [
          "UPDATE_FAILED",
          "UPDATE_ROLLBACK_COMPLETE",
          "UPDATE_ROLLBACK_FAILED",
          "UPDATE_ROLLBACK_IN_PROGRESS",
        ];

  // Track event IDs we've already logged to avoid duplicates
  const loggedEventIds = new Set<string>();
  // Track nested stacks we've discovered
  const nestedStacks = new Set<string>();

  // Helper function to fetch and log events from a stack (including nested stacks)
  const fetchStackEvents = async (
    targetStackName: string,
    isNested: boolean = false,
  ) => {
    try {
      const eventsResponse = await cfn.send(
        new DescribeStackEventsCommand({ StackName: targetStackName }),
      );

      if (eventsResponse.StackEvents) {
        // Events come newest first, reverse to show chronologically
        const newEvents = eventsResponse.StackEvents.filter(
          (event) => event.EventId && !loggedEventIds.has(event.EventId),
        ).reverse();

        for (const event of newEvents) {
          if (event.EventId) {
            loggedEventIds.add(event.EventId);

            const timestamp = event.Timestamp?.toISOString() || "unknown";
            const resourceType = event.ResourceType || "Unknown";
            const logicalId = event.LogicalResourceId || "Unknown";
            const resourceStatus = event.ResourceStatus || "Unknown";
            const statusReason = event.ResourceStatusReason || "";

            // Track nested stacks for recursive event fetching
            if (
              resourceType === "AWS::CloudFormation::Stack" &&
              event.PhysicalResourceId
            ) {
              const nestedStackId = event.PhysicalResourceId;
              if (!nestedStacks.has(nestedStackId)) {
                nestedStacks.add(nestedStackId);
                logger.debug(
                  `Discovered nested stack: ${logicalId} (${nestedStackId})`,
                );
              }
            }

            // Add prefix for nested stack events
            const prefix = isNested
              ? `[NESTED:${targetStackName.split("/")[1] || targetStackName}] `
              : "";

            // Log based on status
            if (resourceStatus.includes("FAILED")) {
              logger.error(
                `[CFN] ${prefix}${timestamp} | ${resourceType} | ${logicalId} | ${resourceStatus} | ${statusReason}`,
              );
            } else if (resourceStatus.includes("COMPLETE")) {
              logger.success(
                `[CFN] ${prefix}${timestamp} | ${resourceType} | ${logicalId} | ${resourceStatus}`,
              );
            } else {
              logger.info(
                `[CFN] ${prefix}${timestamp} | ${resourceType} | ${logicalId} | ${resourceStatus}`,
              );
            }
          }
        }
      }
    } catch (eventsError: any) {
      // Don't warn for nested stacks that might have been deleted
      if (!isNested) {
        logger.warning(
          `Failed to fetch CloudFormation events from ${targetStackName}: ${eventsError.message}`,
        );
      }
    }
  };

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await cfn.send(
        new DescribeStacksCommand({ StackName: stackName }),
      );
      const stack = response.Stacks?.[0];

      if (!stack) {
        throw new Error(
          `Stack ${stackName} not found during ${operation.toLowerCase()} operation`,
        );
      }

      const status = stack.StackStatus;

      if (!status) {
        throw new Error(`Stack ${stackName} status is undefined`);
      }

      // Fetch and log CloudFormation events from main stack
      await fetchStackEvents(stackName, false);

      // Fetch events from all discovered nested stacks and check their status
      for (const nestedStackId of nestedStacks) {
        await fetchStackEvents(nestedStackId, true);

        // Check if nested stack has failed
        try {
          const nestedStackResponse = await cfn.send(
            new DescribeStacksCommand({ StackName: nestedStackId }),
          );
          const nestedStack = nestedStackResponse.Stacks?.[0];
          const nestedStatus = nestedStack?.StackStatus;

          if (nestedStatus && failureStatuses.includes(nestedStatus)) {
            const nestedStackName =
              nestedStackId.split("/")[1] || nestedStackId;
            const nestedReason =
              nestedStack.StackStatusReason || "No reason provided";
            const errorMsg = `Nested stack ${nestedStackName} failed with status ${nestedStatus}: ${nestedReason}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        } catch (nestedError: any) {
          // Re-throw if it's a failure error we just threw
          if (nestedError.message?.includes("failed with status")) {
            throw nestedError;
          }
          // If we can't describe the nested stack, it might have been deleted
          // Only log if it's not a "does not exist" error
          if (!nestedError.message?.includes("does not exist")) {
            logger.warning(
              `Could not check nested stack ${nestedStackId}: ${nestedError.message}`,
            );
          }
        }
      }

      if (status === successStatus) {
        logger.success(
          `Stack ${stackName} ${operation.toLowerCase()} completed successfully`,
        );
        return;
      }

      // Check for failure statuses and exit immediately
      if (failureStatuses.includes(status)) {
        const statusReason = stack.StackStatusReason || "No reason provided";
        const errorMsg = `Stack ${stackName} ${operation.toLowerCase()} failed with status ${status}: ${statusReason}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error: any) {
      // Re-throw immediately if it's a stack failure error (not a transient network error)
      if (error.message?.includes("failed with status")) {
        throw error;
      }

      if (i === maxAttempts - 1) {
        throw error;
      }

      logger.warning(
        `Error checking stack status (attempt ${i + 1}/${maxAttempts}): ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `Timeout waiting for stack ${stackName} ${operation.toLowerCase()} after ${(maxAttempts * delay) / 1000} seconds`,
  );
}

// Helper function to empty an S3 bucket
async function emptyBucket(s3: S3, bucketName: string): Promise<void> {
  try {
    let continuationToken: string | undefined;
    let deletedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });
      const listResponse = await s3.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: listResponse.Contents.map((obj: _Object) => ({
              Key: obj.Key!,
            })),
          },
        });
        await s3.send(deleteCommand);
        deletedCount += listResponse.Contents.length;
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    if (deletedCount > 0) {
      logger.debug(`    Deleted ${deletedCount} objects from ${bucketName}`);
    }
  } catch (error: any) {
    if (error.name === "NoSuchBucket") {
      logger.debug(`    Bucket ${bucketName} does not exist`);
    } else {
      throw error;
    }
  }
}

// Helper function to wait for stack deletion
async function waitForStackDeletion(
  cfn: CloudFormationClient,
  stackName: string,
): Promise<void> {
  const maxAttempts = 120; // 20 minutes
  const delay = 10000; // 10 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const describeResponse = await cfn.send(
        new DescribeStacksCommand({ StackName: stackName }),
      );

      const status = describeResponse.Stacks?.[0]?.StackStatus;

      if (status === "DELETE_COMPLETE") {
        logger.success(`Stack ${stackName} deleted successfully`);
        return;
      }

      if (status === "DELETE_FAILED") {
        throw new Error(`Stack deletion failed with status: ${status}`);
      }

      // Still deleting, wait and try again
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error: any) {
      // Stack not found means it was deleted
      if (
        error.name === "ValidationError" ||
        error.message?.includes("does not exist")
      ) {
        logger.success(`Stack ${stackName} deleted successfully`);
        return;
      }

      if (i === maxAttempts - 1) {
        throw error;
      }

      logger.warning(
        `Error checking stack status (attempt ${i + 1}/${maxAttempts}): ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `Timeout waiting for stack ${stackName} deletion after ${(maxAttempts * delay) / 1000} seconds`,
  );
}

export async function deployCardCountingTrainer(
  options: DeploymentOptions,
): Promise<void> {
  // Set up timestamped log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(__dirname, "..", ".cache", "deploy", "logs");
  const logFile = path.join(
    logDir,
    `deploy-cct-${options.stage}-${timestamp}.log`,
  );

  // Create log directory if it doesn't exist
  const fs = require("fs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Set up logging
  setLogFile(logFile);
  logger.info(`Deployment log: ${logFile}`);

  try {
    await deployCardCountingTrainerInternal(options);
  } finally {
    closeLogFile();
  }
}

async function deployCardCountingTrainerInternal(
  options: DeploymentOptions,
): Promise<void> {
  const stackName = getStackName(StackType.CardCountingTrainer, options.stage);
  const templateBucketName = getTemplateBucketName(options.stage);

  const stopSpinner = logger.infoWithSpinner(
    "Starting Card Counting Trainer stack deployment in ap-southeast-2",
  );

  const region = options.region || process.env.AWS_REGION || "ap-southeast-2";

  // Deploy DNS stack first if domain configuration is provided (prod only)
  let certificateArn: string | undefined;
  if (options.domainName && options.hostedZoneId && options.stage === "prod") {
    try {
      logger.info(`🌐 Domain configuration detected for ${options.domainName}`);
      logger.info(
        `📋 Deploying DNS stack to us-east-1 (ACM certificates for CloudFront must be in us-east-1)`,
      );

      // First deployment: Create certificate without CloudFront domain
      certificateArn = await deployDNSStack(
        options.domainName,
        options.hostedZoneId,
        options.stage,
        undefined, // CloudFront domain not available yet
      );

      logger.success(
        `✓ DNS stack deployed with certificate: ${certificateArn.substring(0, 50)}...`,
      );
    } catch (error: any) {
      logger.error(`Failed to deploy DNS stack: ${error.message}`);
      logger.error(
        `Deployment cannot continue without DNS configuration. Please fix the issue and try again.`,
      );
      throw error;
    }
  }

  // Initialize clients early to check if stack exists
  const cfn = new CloudFormationClient({ region });

  // Always clean up orphaned resources before deployment
  logger.info("🧹 Cleaning up orphaned resources before deployment...");
  const orphanCleanup = new OrphanCleanup({
    region,
    appName: "cardcountingtrainer",
    stage: options.stage,
    dryRun: false,
  });
  try {
    await orphanCleanup.cleanupAll();
  } catch (cleanupError: any) {
    logger.warning(
      `Orphan cleanup had some failures, continuing with deployment: ${cleanupError.message}`,
    );
  }

  // Check if stack already exists
  let stackExists = false;
  let stackIsHealthy = false;
  let stackStatus: string | undefined = undefined;
  try {
    const describeCommand = new DescribeStacksCommand({ StackName: stackName });
    const response = await cfn.send(describeCommand);
    const stack = response.Stacks?.[0];

    if (stack) {
      stackExists = true;
      stackStatus = stack.StackStatus;

      // Only consider stack healthy if it's in a complete/operational state
      stackIsHealthy =
        stackStatus === "CREATE_COMPLETE" ||
        stackStatus === "UPDATE_COMPLETE" ||
        stackStatus === "UPDATE_ROLLBACK_COMPLETE";

      logger.debug(`Stack ${stackName} exists with status: ${stackStatus}`);
      logger.debug(`Stack is healthy for frontend build: ${stackIsHealthy}`);
    }
  } catch (error: any) {
    if (
      error.name === "ValidationError" ||
      error.message?.includes("does not exist")
    ) {
      logger.debug(
        `Stack ${stackName} does not exist - will perform initial deployment`,
      );
    } else {
      logger.warning(`Error checking stack existence: ${error.message}`);
    }
  }

  // Build GraphQL schema
  try {
    logger.info("📦 Building GraphQL schema...");
    const frontendPath = path.join(__dirname, "../frontend");

    logger.debug(`Running: yarn build-gql in ${frontendPath}`);
    execSync("yarn build-gql", {
      cwd: frontendPath,
      stdio: options.debugMode ? "inherit" : "pipe",
      encoding: "utf8",
    });
    logger.success("✓ GraphQL schema generated successfully");

    // Skip pre-deployment frontend build
    logger.info("⏭️  Skipping pre-deployment frontend build");
    logger.info("   Frontend will be built after backend deployment completes");
  } catch (error: any) {
    logger.error(`Failed to build GraphQL schema: ${error.message}`);
    throw error;
  }

  // Initialize remaining clients
  const s3 = new S3({ region });
  let resolversBuildHash: string | undefined = undefined;

  // Set up IAM role
  const iamManager = new IamManager(region);
  const roleArn = await iamManager.setupRole(
    StackType.CardCountingTrainer,
    options.stage,
    templateBucketName,
  );
  if (!roleArn) {
    throw new Error("Failed to setup role for Card Counting Trainer");
  }

  // Wait for IAM role to propagate
  logger.debug("Waiting 10 seconds for IAM role to propagate...");
  await sleep(10000);

  try {
    // Create S3 bucket for templates if it doesn't exist
    const s3BucketManager = new S3BucketManager(region);

    // Make multiple attempts to ensure the bucket exists
    let bucketExists = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (options.debugMode) {
        logger.debug(
          `Attempt ${attempt}/3 to ensure bucket ${templateBucketName} exists...`,
        );
      }
      bucketExists =
        await s3BucketManager.ensureBucketExists(templateBucketName);

      if (bucketExists) {
        logger.debug(
          `Bucket ${templateBucketName} exists and is accessible (attempt ${attempt})`,
        );
        break;
      }

      logger.warning(
        `Bucket operation failed on attempt ${attempt}, retrying...`,
      );
      await sleep(3000 * attempt); // Exponential backoff
    }

    if (!bucketExists) {
      throw new Error(
        `Failed to ensure template bucket ${templateBucketName} exists after multiple attempts`,
      );
    }

    // Configure bucket for public access block and versioning
    try {
      const putBucketPublicAccessBlockCommand = new PutPublicAccessBlockCommand(
        {
          Bucket: templateBucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        },
      );

      await s3.send(putBucketPublicAccessBlockCommand);
      if (options.debugMode) {
        logger.debug(`Set public access block on bucket ${templateBucketName}`);
      }

      const putBucketVersioningCommand = new PutBucketVersioningCommand({
        Bucket: templateBucketName,
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });

      await s3.send(putBucketVersioningCommand);
      if (options.debugMode) {
        logger.debug(`Enabled versioning on bucket ${templateBucketName}`);
      }
    } catch (configError: any) {
      logger.warning(`Error configuring bucket: ${configError.message}`);
      // Continue despite configuration errors
    }

    if (options.debugMode) {
      logger.debug(`Template bucket ${templateBucketName} is ready for use`);
    }

    // Upload main CloudFormation template
    const mainTemplateS3Key = "cfn-template.yaml";
    const templateUrl = `https://s3.${region}.amazonaws.com/${templateBucketName}/${mainTemplateS3Key}`;

    if (options.debugMode) {
      logger.debug(
        `Uploading main template to s3://${templateBucketName}/${mainTemplateS3Key}`,
      );
    }
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: templateBucketName,
          Key: mainTemplateS3Key,
          Body: readFileSync(TEMPLATE_PATHS[StackType.CardCountingTrainer]),
          ContentType: "application/x-yaml",
        }),
      );
      logger.debug("Main template uploaded successfully.");
    } catch (error: any) {
      throw new Error(`Failed to upload main template: ${error.message}`);
    }

    // Clear existing templates and verify bucket is writable
    if (options.debugMode) {
      logger.debug("Clearing existing templates...");
    }
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: templateBucketName,
        Prefix: "resources/",
      });
      const existingObjects: any = await retryOperation(() => s3.send(listCommand));
      if (options.debugMode) {
        logger.debug(
          `Found ${existingObjects.Contents?.length || 0} existing objects to delete`,
        );
      }

      if (existingObjects.Contents?.length) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: templateBucketName,
          Delete: {
            Objects: existingObjects.Contents.map((obj: _Object) => ({
              Key: obj.Key!,
            })),
          },
        });
        await retryOperation(() => s3.send(deleteCommand));
        if (options.debugMode) {
          logger.debug("Deleted existing templates");
        }
      }
    } catch (error: any) {
      logger.warning(`Error clearing templates: ${error.message}`);
      if (options.debugMode) {
        logger.debug(
          "Continuing with deployment despite template clearing error",
        );
      }
    }

    // Upload nested stack templates
    if (options.debugMode) {
      logger.debug(
        `Looking for templates in: ${TEMPLATE_RESOURCES_PATHS[StackType.CardCountingTrainer]}`,
      );
    }
    const templateFiles = findYamlFiles(
      TEMPLATE_RESOURCES_PATHS[StackType.CardCountingTrainer],
    );
    if (options.debugMode) {
      logger.debug(`Found ${templateFiles.length} template files`);
    }

    if (templateFiles.length === 0) {
      throw new Error(
        `No template files found in ${TEMPLATE_RESOURCES_PATHS[StackType.CardCountingTrainer]}`,
      );
    }

    // Track successful uploads
    const successfulUploads: string[] = [];
    const failedUploads: string[] = [];

    for (const file of templateFiles) {
      const relativePath = path.relative(
        TEMPLATE_RESOURCES_PATHS[StackType.CardCountingTrainer],
        file,
      );
      // Prepend 'resources/' to match CloudFormation template expectations
      const key = `resources/${relativePath.replace(/\\/g, "/")}`; // Ensure forward slashes for S3
      if (options.debugMode) {
        logger.debug(`Uploading ${file} to ${key}`);
      }

      const putCommand = new PutObjectCommand({
        Bucket: templateBucketName,
        Key: key,
        Body: readFileSync(file),
        ContentType: "application/x-yaml",
      });

      try {
        await retryOperation(async () => {
          await s3.send(putCommand);
          if (options.debugMode) {
            logger.debug(`Uploaded template: ${key}`);
          }
          successfulUploads.push(key);
        });
      } catch (error: any) {
        logger.error(`Failed to upload template ${key}: ${error.message}`);
        failedUploads.push(key);
      }
    }

    // Verify crucial templates were uploaded
    if (failedUploads.length > 0) {
      logger.warning(
        `Failed to upload ${failedUploads.length} templates: ${failedUploads.join(", ")}`,
      );

      // Check if AppSync template was uploaded, as it's crucial for resolvers
      const appSyncTemplateKey = "resources/AppSync/appsync.yaml";
      if (failedUploads.includes(appSyncTemplateKey)) {
        throw new Error(
          `Failed to upload critical AppSync template: ${appSyncTemplateKey}`,
        );
      }
    }

    logger.debug(
      `Successfully uploaded ${successfulUploads.length} template files`,
    );

    // Add AppSync bucket policy to allow AppSync to read resolver code from S3
    logger.info("Adding AppSync bucket policy...");
    try {
      await addAppSyncBucketPolicy(templateBucketName, region);
      logger.success("AppSync bucket policy configured successfully");
    } catch (error: any) {
      logger.error(`Failed to add AppSync bucket policy: ${error.message}`);
      throw new Error(
        `AppSync bucket policy configuration failed - deployment cannot continue`,
      );
    }

    // Upload GraphQL schema with content hash
    logger.debug("Uploading GraphQL schema file...");
    const schemaPath = path.join(__dirname, "../backend/combined_schema.graphql");

    let schemaHash = "";
    if (existsSync(schemaPath)) {
      // Calculate hash of schema content for versioning
      const crypto = require("crypto");
      const fs = require("fs");
      const schemaContent = fs.readFileSync(schemaPath, "utf8");
      schemaHash = crypto
        .createHash("sha256")
        .update(schemaContent)
        .digest("hex")
        .substring(0, 16); // Use first 16 chars of hash

      const schemaKey = `schema-${schemaHash}.graphql`;
      logger.debug(`Schema hash: ${schemaHash}, uploading as ${schemaKey}`);

      const schemaUploadCommand = new PutObjectCommand({
        Bucket: templateBucketName,
        Key: schemaKey,
        Body: readFileSync(schemaPath),
        ContentType: "application/graphql",
      });

      try {
        await retryOperation(async () => {
          await s3.send(schemaUploadCommand);
          logger.debug(
            `GraphQL schema uploaded successfully with hash ${schemaHash}`,
          );
        });
      } catch (error: any) {
        logger.error(`Failed to upload GraphQL schema: ${error.message}`);
        throw new Error(
          "GraphQL schema upload failed - deployment cannot continue",
        );
      }
    } else {
      throw new Error(`GraphQL schema file not found at ${schemaPath}`);
    }

    // Compile Lambda functions
    if (options.debugMode) {
      logger.debug("Compiling Lambda functions...");
    }

    const lambdaSourceDir = path.join(__dirname, "../backend/lambda");
    // Use a project-local cache for generated Lambda artifacts to avoid committing them
    const lambdaOutputDir = path.join(
      __dirname,
      "..",
      ".cache",
      "deploy",
      "functions",
    );

    if (options.skipResolversBuild) {
      logger.info(
        "⏭️  Skipping Lambda function compilation (--skip-resolvers-build)",
      );
    } else {
      logger.info(`Looking for Lambda functions in: ${lambdaSourceDir}`);

      if (existsSync(lambdaSourceDir)) {
        logger.success(`Lambda directory found: ${lambdaSourceDir}`);

        const lambdaCompiler = new LambdaCompiler({
          logger: logger,
          baseLambdaDir: lambdaSourceDir,
          outputDir: lambdaOutputDir,
          s3BucketName: templateBucketName,
          s3KeyPrefix: "functions",
          stage: options.stage,
          region: region,
          debugMode: options.debugMode,
        });

        try {
          // Clean up previous Lambda cache before compilation
          await lambdaCompiler.clean();

          await lambdaCompiler.compileLambdaFunctions();
          logger.success(
            "✓ Lambda functions compiled and uploaded successfully",
          );
        } catch (error: any) {
          logger.error(`Lambda compilation failed: ${error.message}`);
          throw error;
        }
      } else {
        logger.warning(
          `Lambda directory not found at ${lambdaSourceDir}. Skipping Lambda compilation.`,
        );
      }
    }

    // Compile and upload TypeScript resolvers
    if (options.debugMode) {
      logger.debug("Compiling and uploading AppSync resolvers...");
    }

    if (options.skipResolversBuild) {
      logger.info(
        "⏭️  Skipping resolver compilation (--skip-resolvers-build)",
      );
      logger.info("Fetching latest resolver build hash from S3...");

      // Get the latest resolver build hash from S3
      const resolverPrefix = `resolvers/${options.stage}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: templateBucketName,
        Prefix: resolverPrefix,
        Delimiter: "/",
      });

      const listedObjects = await s3.send(listCommand);
      const commonPrefixes = listedObjects.CommonPrefixes || [];

      if (commonPrefixes.length === 0) {
        throw new Error(
          `No existing resolver builds found in S3 at ${resolverPrefix}. Cannot skip resolver build - you must build at least once.`,
        );
      }

      // Extract build hashes from common prefixes
      const buildHashes = commonPrefixes
        .map((cp: any) => {
          const prefix = cp.Prefix || "";
          return prefix.replace(resolverPrefix, "").replace("/", "");
        })
        .filter((hash: string) => hash.length > 0);

      if (buildHashes.length === 0) {
        throw new Error(
          `No valid resolver build hashes found in S3. Cannot skip resolver build.`,
        );
      }

      // Use the most recent build hash (last in alphabetical order since they're timestamps)
      resolversBuildHash = buildHashes.sort().pop();
      logger.success(
        `Using existing resolver build hash: ${resolversBuildHash}`,
      );
    } else {
      // Double-check that the bucket exists before compiling and uploading resolvers
      const bucketExistsBeforeResolvers =
        await s3BucketManager.ensureBucketExists(templateBucketName);
      if (!bucketExistsBeforeResolvers) {
        throw new Error(
          `Template bucket ${templateBucketName} must exist before uploading resolvers`,
        );
      }

      const backendPath = path.join(__dirname, "../backend");
      const resolverDir = path.join(backendPath, "resolvers");

      if (!existsSync(resolverDir)) {
        logger.warning(
          "No resolvers directory found - skipping resolver compilation",
        );
        resolversBuildHash = "none";
      } else {
        logger.success(`Resolver directory found: ${resolverDir}`);
        // Find all resolver files in the specified directory
        const allFiles = findTypeScriptFiles(resolverDir);
        logger.debug(
          `Found ${allFiles.length} total TypeScript files in ${resolverDir}`,
        );

        // Log all discovered files for debugging
        allFiles.forEach((file, index) => {
          logger.debug(`File ${index + 1}: ${file}`);
        });

        const resolverFiles = allFiles
          .map((file) => path.relative(resolverDir, file)) // Convert to relative paths first
          .filter((file) => {
            const shouldInclude =
              !file.endsWith(".bak") && // Exclude backup files
              path.basename(file) !== "gqlTypes.ts" && // Exclude the main types file
              file.includes(path.sep); // IMPORTANT: Only include files in subdirectories (relative path check)

            if (!shouldInclude) {
              logger.debug(`Excluding file: ${file}`);
            }
            return shouldInclude;
          });

        logger.success(
          `After filtering, found ${resolverFiles.length} resolver files to compile:`,
        );
        resolverFiles.forEach((file, index) => {
          logger.success(`  [${index + 1}] ${file}`);
        });

        if (resolverFiles.length === 0) {
          const errorMsg = `No TypeScript resolver files found in ${resolverDir}. This will cause deployment to fail.`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        } else {
          const constantsDir = path.join(backendPath, "constants");

          const resolverCompiler = new ResolverCompiler({
            logger: logger,
            baseResolverDir: resolverDir,
            s3KeyPrefix: "resolvers",
            stage: options.stage,
            s3BucketName: templateBucketName,
            region: region,
            resolverFiles: resolverFiles,
            sharedFileName: "gqlTypes.ts",
            constantsDir: constantsDir,
            appName: "cardcountingtrainer",
            backendPackageJsonPath: path.join(backendPath, "package.json"),
            gqlTypesPath: path.join(__dirname, "..", "frontend", "src", "types", "gqlTypes.ts"),
          });

          resolversBuildHash = await resolverCompiler.compileAndUploadResolvers();
          logger.success("✓ Resolvers compiled and uploaded successfully");
        }
      }
    }

    // Prepare CloudFormation parameters
    const stackParams: Parameter[] = [
      { ParameterKey: "Stage", ParameterValue: options.stage },
      {
        ParameterKey: "TemplateBucketName",
        ParameterValue: templateBucketName,
      },
      {
        ParameterKey: "LambdaCodeKey",
        ParameterValue: `functions/${options.stage}/postConfirmation.zip`,
      },
    ];

    // ResolversBuildHash is required by the CloudFormation template
    if (!resolversBuildHash) {
      throw new Error(
        "ResolversBuildHash is required but was not computed. Resolver compilation may have failed.",
      );
    }
    stackParams.push({
      ParameterKey: "ResolversBuildHash",
      ParameterValue: resolversBuildHash,
    });

    // SchemaHash is required for schema versioning
    if (!schemaHash) {
      throw new Error(
        "SchemaHash is required but was not computed. Schema upload may have failed.",
      );
    }
    stackParams.push({
      ParameterKey: "SchemaHash",
      ParameterValue: schemaHash,
    });

    if (options.debugMode) {
      logger.debug(
        `Computed CloudFormation parameters: ${JSON.stringify(
          stackParams,
          null,
          2,
        )}`,
      );
    }

    // Validate required parameters to fail fast with a clear message if anything is missing
    const requiredKeys = ["Stage", "TemplateBucketName"];

    const missing = requiredKeys.filter(
      (k) =>
        !stackParams.some((p) => p.ParameterKey === k && p.ParameterValue),
    );

    if (missing.length > 0) {
      throw new Error(
        `Missing required CloudFormation parameters: ${missing.join(", ")}. Computed parameters: ${JSON.stringify(
          stackParams,
        )}`,
      );
    }

    // Clean up any orphaned LogGroups before deployment
    await cleanupLogGroups({
      appName: "cardcountingtrainer",
      stage: options.stage,
      region: region,
    });

    stopSpinner();

    const capabilities: Capability[] = [
      Capability.CAPABILITY_IAM,
      Capability.CAPABILITY_NAMED_IAM,
    ];

    // Deploy CloudFormation stack
    if (stackExists) {
      // Check if stack is in a failed state that can't be updated
      const failedStates = [
        "CREATE_FAILED",
        "ROLLBACK_COMPLETE",
        "ROLLBACK_FAILED",
        "DELETE_FAILED",
      ];

      if (stackStatus && failedStates.includes(stackStatus)) {
        logger.error(`Stack ${stackName} is in state ${stackStatus}`);
        logger.error("Cannot update a stack in a failed state.");
        logger.error("\nTo fix this, delete the failed stack and try again:");
        logger.error("  yarn delete-stack:wait");
        logger.error("  yarn deploy");
        throw new Error(`Stack is in failed state: ${stackStatus}. Please delete the stack first.`);
      }

      logger.info(`Updating existing stack: ${stackName}`);
      try {
        await cfn.send(
          new UpdateStackCommand({
            StackName: stackName,
            TemplateURL: templateUrl,
            Parameters: stackParams,
            Capabilities: capabilities,
            RoleARN: roleArn,
          }),
        );

        logger.info("⏳ Waiting for stack update to complete...");
        await waitForStackCompletion(cfn, stackName, "UPDATE");
      } catch (error: any) {
        if (error.message?.includes("No updates are to be performed")) {
          logger.info("Stack is already up to date - no changes needed");
        } else {
          logger.error(`Failed to update stack: ${error.name || 'Error'}`);
          logger.error(`Error message: ${error.message}`);
          if (error.Code) logger.error(`Error code: ${error.Code}`);
          if (error.$metadata) logger.error(`Metadata: ${JSON.stringify(error.$metadata)}`);
          throw error;
        }
      }
    } else {
      logger.info(`Creating new stack: ${stackName}`);
      const createCommand: any = {
        StackName: stackName,
        TemplateURL: templateUrl,
        Parameters: stackParams,
        Capabilities: capabilities,
        RoleARN: roleArn,
      };

      // Add DisableRollback if option is set (default: false)
      if (options.disableRollback) {
        createCommand.DisableRollback = true;
        logger.info(
          "DisableRollback is enabled - stack will not rollback on failure",
        );
      }

      await cfn.send(new CreateStackCommand(createCommand));

      logger.info("⏳ Waiting for stack creation to complete...");
      await waitForStackCompletion(cfn, stackName, "CREATE");
    }

    logger.success(`✓ Stack deployed successfully`);

    // Save deployment outputs
    try {
      logger.info("💾 Saving deployment outputs...");
      const outputsManager = new OutputsManager();
      await outputsManager.saveStackOutputs(
        StackType.CardCountingTrainer,
        options.stage,
        region,
      );
      logger.success("✓ Deployment outputs saved successfully");
    } catch (error: any) {
      logger.error(`Failed to save outputs: ${error.message}`);
      // don't throw - this is non-critical
    }

    // Update CloudFront and DNS for custom domain (second phase)
    if (
      certificateArn &&
      options.domainName &&
      options.hostedZoneId &&
      options.stage === "prod"
    ) {
      try {
        logger.info(`🌐 Configuring custom domain for CloudFront...`);

        // Get CloudFront distribution ID and domain from stack outputs
        const stackOutputs = await cfn.send(
          new DescribeStacksCommand({ StackName: stackName }),
        );
        const cloudFrontDomain = stackOutputs.Stacks?.[0]?.Outputs?.find(
          (output) => output.OutputKey === "CloudFrontDomainName",
        )?.OutputValue;
        const cloudFrontDistributionId =
          stackOutputs.Stacks?.[0]?.Outputs?.find(
            (output) => output.OutputKey === "CloudFrontDistributionId",
          )?.OutputValue;

        if (cloudFrontDomain && cloudFrontDistributionId) {
          logger.info(`📡 CloudFront domain: ${cloudFrontDomain}`);
          logger.info(`🆔 Distribution ID: ${cloudFrontDistributionId}`);

          // Update CloudFront distribution with certificate and custom domains
          await updateCloudFrontWithDomain(
            cloudFrontDistributionId,
            certificateArn,
            options.domainName,
          );

          // Update DNS stack with CloudFront domain to create Route53 records
          await deployDNSStack(
            options.domainName,
            options.hostedZoneId,
            options.stage,
            cloudFrontDomain,
          );

          logger.success(`✓ Custom domain configuration complete!`);
          logger.info(`🌍 Your site will be accessible at:`);
          logger.info(`   - https://${options.domainName}`);
          logger.info(`   - https://www.${options.domainName}`);
          logger.info(
            `   - https://${cloudFrontDomain} (CloudFront default domain)`,
          );
          logger.info(
            `⏳ Note: CloudFront distribution update may take 15-20 minutes to propagate globally`,
          );
        } else {
          logger.warning(
            `Could not find CloudFront outputs. Domain configuration incomplete.`,
          );
        }
      } catch (error: any) {
        logger.error(`Failed to configure custom domain: ${error.message}`);
        logger.error(
          `Deployment failed during domain configuration. Please fix the issue and redeploy.`,
        );
        throw error;
      }
    }

    // Build frontend if it wasn't built yet and stack is now healthy
    const frontendOutPath = path.join(__dirname, "../frontend/out");
    const frontendPath = path.join(__dirname, "../frontend");

    // Check if frontend needs to be built (out directory doesn't exist)
    if (
      !require("fs").existsSync(frontendOutPath) &&
      !options.skipFrontendBuild
    ) {
      try {
        // Verify stack is now healthy (has required outputs)
        const postDeployStackData = await cfn.send(
          new DescribeStacksCommand({ StackName: stackName }),
        );
        const hasApiUrl = postDeployStackData.Stacks?.[0]?.Outputs?.some(
          (output) => output.OutputKey === "ApiUrl",
        );
        const hasCognito = postDeployStackData.Stacks?.[0]?.Outputs?.some(
          (output) => output.OutputKey === "UserPoolId",
        );

        if (hasApiUrl && hasCognito) {
          logger.info("🏗️  Building frontend application (post-deployment)...");
          logger.info("   Stack is now healthy with API and Cognito outputs");

          // Generate GraphQL schema and types first
          logger.info("📝 Generating GraphQL schema and types...");
          execSync("yarn build-gql", {
            cwd: frontendPath,
            stdio: options.debugMode ? "inherit" : "pipe",
            encoding: "utf8",
          });

          // Build frontend
          execSync("yarn build", {
            cwd: frontendPath,
            stdio: options.debugMode ? "inherit" : "pipe",
            encoding: "utf8",
          });
          logger.success("✓ Frontend built successfully");
        } else {
          logger.warning(
            "Stack deployed but missing API/Cognito outputs. Skipping frontend build.",
          );
        }
      } catch (buildError: any) {
        logger.error(`Failed to build frontend: ${buildError.message}`);
        logger.warning("Continuing without frontend build...");
      }
    }

    // Upload frontend to S3 if it was built
    try {
      // Check if the out directory exists
      if (require("fs").existsSync(frontendOutPath)) {
        logger.info("📤 Uploading frontend to S3...");

        // Get bucket name from stack outputs
        const stackOutputs = await cfn.send(
          new DescribeStacksCommand({ StackName: stackName }),
        );
        const bucketName = stackOutputs.Stacks?.[0]?.Outputs?.find(
          (output) => output.OutputKey === "WebsiteBucket",
        )?.OutputValue;

        if (bucketName) {
          logger.debug(`Uploading to bucket: ${bucketName}`);

          // Use custom AWS CLI path if available (for local-aws setup)
          const awsCliPath = process.env.AWS_CLI_PATH || "aws";
          const noVerifyFlag =
            process.env.AWS_NO_VERIFY_SSL === "true" ? "--no-verify-ssl" : "";

          // Use AWS CLI sync for efficient upload
          const syncCommand = `${awsCliPath} s3 sync ${frontendOutPath} s3://${bucketName}/ --delete ${noVerifyFlag}`;
          execSync(syncCommand, {
            stdio: options.debugMode ? "inherit" : "pipe",
            encoding: "utf8",
            env: {
              ...process.env,
              AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
              AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
              AWS_REGION: process.env.AWS_REGION || region,
            },
          });

          logger.success("✓ Frontend uploaded to S3");

          // Invalidate CloudFront cache
          const distributionId = stackOutputs.Stacks?.[0]?.Outputs?.find(
            (output) => output.OutputKey === "CloudFrontDistributionId",
          )?.OutputValue;

          if (distributionId) {
            logger.info("🔄 Invalidating CloudFront cache...");
            const cfClient = new CloudFrontClient({ region: "us-east-1" });

            await cfClient.send(
              new CreateInvalidationCommand({
                DistributionId: distributionId,
                InvalidationBatch: {
                  CallerReference: Date.now().toString(),
                  Paths: {
                    Quantity: 1,
                    Items: ["/*"],
                  },
                },
              }),
            );
            logger.success("✓ CloudFront cache invalidation created");
          }
        } else {
          logger.warning(
            "Could not find WebsiteBucket output. Skipping frontend upload.",
          );
        }
      } else {
        logger.info(
          "⏭️  Skipping frontend upload (out directory not found). Run frontend build with 'output: export' to generate static files.",
        );
      }
    } catch (uploadError: any) {
      logger.error(`Failed to upload frontend: ${uploadError.message}`);
      // Don't throw - continue with deployment
    }

    // Print CloudFront URL
    try {
      const finalStackData = await cfn.send(
        new DescribeStacksCommand({ StackName: stackName }),
      );
      const cfDomainOutput = finalStackData.Stacks?.[0]?.Outputs?.find(
        (output) => output.OutputKey === "CloudFrontDomainName",
      );
      if (cfDomainOutput?.OutputValue) {
        logger.success("");
        logger.success("🌐 Your application is deployed at:");
        logger.success(`   https://${cfDomainOutput.OutputValue}`);
        logger.success("");
      }
    } catch (error) {
      // Ignore error - this is just informational
    }

    // Create Cognito admin user if requested
    if (!options.skipUserCreation) {
      try {
        const adminEmail = options.adminEmail || process.env.ADMIN_EMAIL;
        if (!adminEmail) {
          logger.info(
            "No admin email provided (options.adminEmail or ADMIN_EMAIL). Skipping Cognito admin creation.",
          );
        } else {
          logger.info(`👤 Creating Cognito admin user for CCT: ${adminEmail}`);
          const userManager = new UserSetupManager(region, "cardcountingtrainer");
          await userManager.createAdminUser({
            stage: options.stage,
            adminEmail,
            region,
            stackType: "cardcountingtrainer",
          });
          logger.success("✓ Cognito admin user created for CCT");
        }
      } catch (userError: any) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        logger.error(`CCT Cognito admin creation failed: ${errorMessage || 'No error message'}`);

        // Log AWS SDK specific error properties
        if (userError && typeof userError === 'object') {
          if (userError.name) logger.debug(`Error name: ${userError.name}`);
          if (userError.code) logger.debug(`Error code: ${userError.code}`);
          if (userError.$metadata) logger.debug(`AWS Metadata: ${JSON.stringify(userError.$metadata)}`);
          if (userError.message) logger.debug(`Error message: ${userError.message}`);
          if (userError.stack) logger.debug(`Error stack: ${userError.stack}`);

          // Log full error object
          logger.debug(`Full error: ${JSON.stringify(userError, Object.getOwnPropertyNames(userError), 2)}`);
        }
        // don't throw to avoid failing the entire deploy; surface error to logs
      }
    }

    logger.success("🎉 Card Counting Trainer deployment completed successfully!");
  } catch (error: any) {
    logger.error(`Deployment failed: ${error.message}`);
    throw error;
  }
}

// Main entry point
if (require.main === module) {
  const { Command } = require("commander");
  const inquirer = require("inquirer");
  const program = new Command();

  program
    .name("deploy")
    .description("Deploy Card Counting Trainer infrastructure")
    .option("-s, --stage <stage>", "Deployment stage (dev/prod)")
    .option("-a, --action <action>", "Deployment action (update/replace/remove)")
    .option("-r, --region <region>", "AWS region", "ap-southeast-2")
    .option("--skip-frontend-build", "Skip frontend build")
    .option("--skip-resolvers-build", "Skip resolvers compilation")
    .option("--skip-user-creation", "Skip admin user creation")
    .option("--admin-email <email>", "Admin user email")
    .option("--domain-name <domain>", "Custom domain (prod only)")
    .option("--hosted-zone-id <id>", "Route53 hosted zone ID (prod only)")
    .option("--disable-rollback", "Disable CloudFormation rollback on failure")
    .option("--debug-mode", "Enable debug logging")
    .option("--non-interactive", "Skip interactive prompts", false)
    .parse(process.argv);

  const opts = program.opts();

  (async () => {
    try {
      let stage = opts.stage;
      let action = opts.action;
      let adminEmail = opts.adminEmail;
      let skipUserCreation = opts.skipUserCreation;
      let disableRollback = opts.disableRollback;

      // Interactive prompts if not in non-interactive mode
      if (!opts.nonInteractive) {
        console.log("\n🎯 Card Counting Trainer Deployment\n");

        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "stage",
            message: "Select deployment stage:",
            choices: ["dev", "prod"],
            default: "dev",
            when: () => !stage,
          },
          {
            type: "list",
            name: "action",
            message: "Select deployment action:",
            choices: [
              {
                name: "Update - Deploy changes to existing stack",
                value: "update",
              },
              {
                name: "Replace - Delete and recreate stack (for major changes)",
                value: "replace",
              },
              { name: "Remove - Delete stack completely", value: "remove" },
            ],
            default: "update",
            when: () => !action,
          },
          {
            type: "input",
            name: "adminEmail",
            message: "Admin email (leave blank to skip user creation):",
            default: "vesnathan+bb@gmail.com",
            when: (ans: any) => ans.action !== "remove" && !adminEmail && !skipUserCreation,
          },
          {
            type: "confirm",
            name: "skipUserCreation",
            message: "Skip Cognito user creation? (Use if admin user already exists)",
            default: false,
            when: (ans: any) => ans.action !== "remove" && !opts.skipUserCreation && !ans.adminEmail,
          },
          {
            type: "confirm",
            name: "disableRollback",
            message: "Disable CloudFormation rollback on failure? (Useful for debugging)",
            default: false,
            when: (ans: any) => ans.action === "replace" && !opts.disableRollback,
          },
        ]);

        if (answers.stage) stage = answers.stage;
        if (answers.action) action = answers.action as DeploymentAction;
        if (answers.adminEmail) adminEmail = answers.adminEmail;
        if (answers.skipUserCreation) skipUserCreation = true;
        if (answers.disableRollback) disableRollback = true;
      }

      // Default stage to dev if still not set
      if (!stage) stage = "dev";
      if (!action) action = DeploymentAction.UPDATE;

      // Handle remove action
      if (action === DeploymentAction.REMOVE) {
        logger.info("🗑️  Removing Card Counting Trainer stack...");
        const cfn = new CloudFormationClient({ region: opts.region });
        const stackName = getStackName(StackType.CardCountingTrainer, stage);

        // First, empty all S3 buckets associated with this stack
        try {
          logger.info("Emptying S3 buckets...");
          const stackData = await cfn.send(
            new DescribeStacksCommand({ StackName: stackName }),
          );
          const outputs = stackData.Stacks?.[0]?.Outputs || [];
          const s3 = new S3({ region: opts.region });

          // Get bucket names from stack outputs
          const websiteBucket = outputs.find((o) => o.OutputKey === "WebsiteBucket")?.OutputValue;

          // Get CCTBucket from S3 nested stack outputs
          const s3StackName = `${stackName}-S3Stack`;
          try {
            const s3StackData = await cfn.send(
              new DescribeStacksCommand({ StackName: s3StackName }),
            );
            const s3Outputs = s3StackData.Stacks?.[0]?.Outputs || [];
            const cctBucket = s3Outputs.find((o) => o.OutputKey === "CCTBucketName")?.OutputValue;

            if (cctBucket) {
              logger.info(`  Emptying bucket: ${cctBucket}`);
              await emptyBucket(s3, cctBucket);
            }
          } catch (error: any) {
            logger.warning(`Could not access S3 nested stack: ${error.message}`);
          }

          // Empty website bucket
          if (websiteBucket) {
            logger.info(`  Emptying bucket: ${websiteBucket}`);
            await emptyBucket(s3, websiteBucket);
          }

          // Empty templates bucket
          const templatesBucket = getTemplateBucketName(stage);
          logger.info(`  Emptying bucket: ${templatesBucket}`);
          await emptyBucket(s3, templatesBucket);
        } catch (error: any) {
          if (!error.message?.includes("does not exist")) {
            logger.warning(`Could not empty buckets: ${error.message}`);
          }
        }

        // Delete the stack with retry logic for failed resources
        await forceDeleteStack(cfn, stackName);
        logger.success(`✓ Stack ${stackName} removed successfully`);

        // Clean up orphaned resources after stack removal
        logger.info("🧹 Cleaning up orphaned resources...");
        const cleanupAfterRemove = new OrphanCleanup({
          region: opts.region,
          appName: "cardcountingtrainer",
          stage,
          dryRun: false,
        });
        await cleanupAfterRemove.cleanupAll();

        return;
      }

      // Handle replace action
      if (action === DeploymentAction.REPLACE) {
        logger.info("🔄 Replacing Card Counting Trainer stack (delete + recreate)...");
        const cfn = new CloudFormationClient({ region: opts.region });
        const stackName = getStackName(StackType.CardCountingTrainer, stage);

        try {
          // Check if stack exists
          await cfn.send(new DescribeStacksCommand({ StackName: stackName }));

          // Stack exists - empty buckets and delete it
          logger.info("Deleting existing stack...");

          // Empty S3 buckets first
          try {
            const stackData = await cfn.send(
              new DescribeStacksCommand({ StackName: stackName }),
            );
            const outputs = stackData.Stacks?.[0]?.Outputs || [];
            const s3 = new S3({ region: opts.region });

            // Get bucket names from stack outputs
            const websiteBucket = outputs.find((o) => o.OutputKey === "WebsiteBucket")?.OutputValue;

            // Get CCTBucket from S3 nested stack outputs
            const s3StackName = `${stackName}-S3Stack`;
            try {
              const s3StackData = await cfn.send(
                new DescribeStacksCommand({ StackName: s3StackName }),
              );
              const s3Outputs = s3StackData.Stacks?.[0]?.Outputs || [];
              const cctBucket = s3Outputs.find((o) => o.OutputKey === "CCTBucketName")?.OutputValue;

              if (cctBucket) {
                logger.info(`  Emptying bucket: ${cctBucket}`);
                await emptyBucket(s3, cctBucket);
              }
            } catch (error: any) {
              logger.warning(`Could not access S3 nested stack: ${error.message}`);
            }

            // Empty website bucket
            if (websiteBucket) {
              logger.info(`  Emptying bucket: ${websiteBucket}`);
              await emptyBucket(s3, websiteBucket);
            }

            // Empty templates bucket
            const templatesBucket = getTemplateBucketName(stage);
            logger.info(`  Emptying bucket: ${templatesBucket}`);
            await emptyBucket(s3, templatesBucket);
          } catch (error: any) {
            logger.warning(`Could not empty buckets: ${error.message}`);
          }

          // Use force delete to handle problematic resources
          await forceDeleteStack(cfn, stackName);
          logger.success("✓ Existing stack deleted");
        } catch (error: any) {
          // Check for various ways AWS SDK indicates stack doesn't exist
          const isStackNotFound =
            error.name === "ValidationError" ||
            error.Code === "ValidationError" ||
            error.$metadata?.httpStatusCode === 400 ||
            error.message?.includes("does not exist");

          if (isStackNotFound) {
            logger.info("Stack does not exist, will create new one");
          } else {
            logger.error(`Unexpected error during replace: ${error.name || error.Code}`);
            logger.error(`Message: ${error.message}`);
            throw error;
          }
        }

        // Clean up orphaned resources after stack deletion
        logger.info("🧹 Cleaning up orphaned resources...");
        const cleanup = new OrphanCleanup({
          region: opts.region,
          appName: "cardcountingtrainer",
          stage,
          dryRun: false,
        });
        await cleanup.cleanupAll();

        // Continue to deployment below
        logger.info("Creating new stack...");
      }

      // Proceed with deployment (for update or replace actions)
      await deployCardCountingTrainer({
        stage,
        region: opts.region,
        skipFrontendBuild: opts.skipFrontendBuild,
        skipResolversBuild: opts.skipResolversBuild,
        skipUserCreation: skipUserCreation,
        adminEmail: adminEmail,
        domainName: opts.domainName,
        hostedZoneId: opts.hostedZoneId,
        disableRollback: disableRollback,
        debugMode: opts.debugMode,
      });
    } catch (error: any) {
      logger.error(`Deployment failed: ${error.name || error.Code || 'Error'}`);
      logger.error(`Message: ${error.message}`);
      if (error.Code) logger.error(`Code: ${error.Code}`);
      if (opts.debugMode && error.stack) {
        logger.error("Stack trace:");
        logger.error(error.stack);
      }
      process.exit(1);
    }
  })();
}
