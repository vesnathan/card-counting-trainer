import {
  CloudFormationClient,
  DescribeStacksCommand,
  DeleteStackCommand,
  Stack,
  Output,
  StackStatus,
} from "@aws-sdk/client-cloudformation";
import {
  S3Client,
  ListObjectsV2Command, // Will be replaced by ListObjectVersionsCommand for emptying
  DeleteObjectsCommand,
  ObjectIdentifier,
  HeadBucketCommand,
  DeleteBucketCommand,
  ListObjectVersionsCommand, // Added for versioning
  ObjectVersion, // Added for versioning
  DeleteMarkerEntry, // Added for versioning
} from "@aws-sdk/client-s3";
import { IAMClient } from "@aws-sdk/client-iam";
import { logger } from "./logger";
import { StackType, getStackName } from "../types";
import { getProjectBuckets } from "../project-config";

export class ForceDeleteManager {
  private cfnClient: CloudFormationClient;
  public s3Client: S3Client;
  private iamClient: IAMClient;
  private region: string;

  constructor(region: string, _deploymentStage?: string) {
    this.region = region;
    this.cfnClient = new CloudFormationClient({ region: this.region });
    this.s3Client = new S3Client({ region: this.region });
    this.iamClient = new IAMClient({ region: this.region });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async emptyStackS3Buckets(
    stackIdentifier: string,
    stackType: StackType,
    stage: string,
  ): Promise<void> {
    logger.info(
      `Attempting to empty S3 buckets related to stack identifier ${stackIdentifier} (type: ${stackType}) in stage ${stage}...`,
    );
    let bucketsToEmpty: string[] = [];
    const fullStackName = getStackName(stackType, stage);

    try {
      const stack = await this.getStack(fullStackName);
      if (stack && stack.Outputs) {
        const s3OutputKeys = [
          "WAFLogsBucketName",
          "FrontendBucketName",
          "TemplatesBucketName",
          // AWS Example specific outputs
          "AWSEBucketName",
          "WebsiteBucket",
          // The Story Hub specific outputs
          "TSHBucketName",
        ];

        stack.Outputs.forEach((output: Output) => {
          if (
            output.OutputKey &&
            s3OutputKeys.includes(output.OutputKey) &&
            output.OutputValue
          ) {
            logger.info(
              `Found S3 bucket ${output.OutputValue} from stack outputs for ${fullStackName}.`,
            );
            if (!bucketsToEmpty.includes(output.OutputValue)) {
              bucketsToEmpty.push(output.OutputValue);
            }
          }
        });
      }
    } catch (error) {
      logger.warning(
        `Could not get stack outputs for ${fullStackName} to find S3 buckets (stack might not exist): ${(error as Error).message}`,
      );
    }

    logger.info(
      `Checking for S3 buckets by naming convention for type ${stackType} and stage ${stage}...`,
    );

    // Use dynamic project configuration to get all buckets for this stack type
    const conventionalBuckets = getProjectBuckets(
      stackType,
      stage,
      this.region,
    );

    conventionalBuckets.forEach((bucketName) => {
      if (bucketName && !bucketsToEmpty.includes(bucketName)) {
        bucketsToEmpty.push(bucketName);
      }
    });

    bucketsToEmpty = [...new Set(bucketsToEmpty.filter((b) => b))];

    if (bucketsToEmpty.length === 0) {
      logger.info(
        `No S3 buckets identified for cleanup for stack type ${stackType}, stage ${stage}, identifier ${stackIdentifier}.`,
      );
    } else {
      logger.info(
        `Identified buckets for potential cleanup: ${bucketsToEmpty.join(", ")}`,
      );
    }

    for (const bucketName of bucketsToEmpty) {
      await this.emptyS3Bucket(bucketName);
    }
    logger.info(
      `S3 bucket cleanup attempt phase completed for stack type ${stackType}, stage ${stage}, identifier ${stackIdentifier}.`,
    );
  }

  private async emptyS3Bucket(bucketName: string): Promise<void> {
    if (!bucketName) {
      logger.warning("Attempted to empty a bucket with no name. Skipping.");
      return;
    }
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      logger.info(
        `Attempting to empty S3 bucket ${bucketName} (versioning aware)...`,
      );
    } catch (error: any) {
      if (
        error.name === "NoSuchBucket" ||
        error.name === "NotFound" ||
        (error.$metadata && error.$metadata.httpStatusCode === 404)
      ) {
        logger.info(
          `S3 bucket ${bucketName} does not exist, skipping emptying.`,
        );
        return;
      }
      logger.warning(
        `Error checking S3 bucket ${bucketName}: ${error.message}. It might be inaccessible or another issue occurred. Skipping emptying.`,
      );
      return;
    }

    try {
      let KeyMarker: string | undefined;
      let VersionIdMarker: string | undefined;
      let isTruncated = false;
      do {
        const listVersionsResponse = await this.s3Client.send(
          new ListObjectVersionsCommand({
            Bucket: bucketName,
            KeyMarker,
            VersionIdMarker,
          }),
        );

        const objectsToDelete: ObjectIdentifier[] = [];
        if (listVersionsResponse.Versions) {
          listVersionsResponse.Versions.forEach((version: ObjectVersion) => {
            if (version.Key && version.VersionId) {
              objectsToDelete.push({
                Key: version.Key,
                VersionId: version.VersionId,
              });
            }
          });
        }
        if (listVersionsResponse.DeleteMarkers) {
          listVersionsResponse.DeleteMarkers.forEach(
            (marker: DeleteMarkerEntry) => {
              if (marker.Key && marker.VersionId) {
                objectsToDelete.push({
                  Key: marker.Key,
                  VersionId: marker.VersionId,
                });
              }
            },
          );
        }

        if (objectsToDelete.length > 0) {
          await this.s3Client.send(
            new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: { Objects: objectsToDelete },
            }),
          );
          logger.info(
            `Deleted ${objectsToDelete.length} object versions/delete markers from ${bucketName}.`,
          );
        } else {
          logger.info(
            `No object versions or delete markers found in ${bucketName} in this batch.`,
          );
        }
        KeyMarker = listVersionsResponse.NextKeyMarker;
        VersionIdMarker = listVersionsResponse.NextVersionIdMarker;
        isTruncated = listVersionsResponse.IsTruncated || false;
      } while (isTruncated);
      logger.info(
        `Successfully emptied S3 bucket ${bucketName} (all versions and delete markers).`,
      );
    } catch (error) {
      logger.error(
        `Failed to empty S3 bucket ${bucketName} (versioning aware): ${(error as Error).message}`,
      );
      // Do not re-throw, allow attempt to delete bucket anyway, which will fail if not empty
    }
  }

  // New private method to delete an S3 bucket
  private async deleteS3Bucket(bucketName: string): Promise<void> {
    if (!bucketName) {
      logger.warning("Attempted to delete a bucket with no name. Skipping.");
      return;
    }
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check if bucket exists before attempting to delete
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        logger.info(
          `Bucket ${bucketName} exists. Attempting to delete (attempt ${attempt}/${maxAttempts})...`,
        );
        await this.s3Client.send(
          new DeleteBucketCommand({ Bucket: bucketName }),
        );
        logger.info(`Successfully deleted S3 bucket ${bucketName}.`);
        return;
      } catch (error: any) {
        // If bucket not found, consider it deleted
        if (
          error.name === "NoSuchBucket" ||
          error.name === "NotFound" ||
          (error.$metadata && error.$metadata.httpStatusCode === 404)
        ) {
          logger.info(
            `S3 bucket ${bucketName} does not exist, skipping deletion.`,
          );
          return;
        }

        const msg = error.message || String(error);
        logger.warning(
          `Attempt ${attempt} failed to delete bucket ${bucketName}: ${msg}`,
        );

        // If this was the last attempt, log an error and return; otherwise try to empty again and retry
        if (attempt === maxAttempts) {
          logger.error(
            `Failed to delete S3 bucket ${bucketName} after ${maxAttempts} attempts: ${msg}`,
          );
          return; // best-effort
        }

        // Try to empty the bucket again (both versioned and non-versioned) then retry after a short delay
        try {
          logger.info(
            `Re-attempting to empty bucket ${bucketName} before retrying deletion (attempt ${attempt})...`,
          );
          await this.emptyS3Bucket(bucketName);
          // Non-versioned fallback: list objects and delete them
          try {
            const objs = await this.s3Client.send(
              new ListObjectsV2Command({ Bucket: bucketName }),
            );
            if (objs.Contents && objs.Contents.length > 0) {
              const ids = objs.Contents.map((o) => ({ Key: o.Key! }));
              await this.s3Client.send(
                new DeleteObjectsCommand({
                  Bucket: bucketName,
                  Delete: { Objects: ids },
                }),
              );
              logger.info(
                `Deleted ${ids.length} non-versioned objects from ${bucketName} as fallback.`,
              );
            }
          } catch (nonverr: any) {
            logger.debug(
              `Non-versioned fallback delete failed for ${bucketName}: ${nonverr.message || String(nonverr)}`,
            );
          }
        } catch (emptyErr: any) {
          logger.warning(
            `Failed to empty bucket ${bucketName} during delete retry: ${emptyErr.message || String(emptyErr)}`,
          );
        }

        // Backoff before retrying
        await this.sleep(2000 * attempt);
      }
    }
  }

  // New public method to delete conventionally named buckets
  public async deleteConventionalBuckets(
    baseIdentifier: string, // baseIdentifier might be like 'cwl', 'waf', 'cardcountingtrainer'
    stackType: StackType,
    stage: string,
  ): Promise<void> {
    logger.info(
      `Attempting to delete conventionally named S3 buckets for identifier ${baseIdentifier}, type ${stackType}, stage ${stage}...`,
    );

    // Use dynamic project configuration to get all buckets for this stack type
    const uniqueBucketsToDelete = getProjectBuckets(
      stackType,
      stage,
      this.region,
    );

    if (uniqueBucketsToDelete.length === 0) {
      logger.info(
        `No conventionally named S3 buckets identified for deletion for identifier ${baseIdentifier}, type ${stackType}, stage ${stage}.`,
      );
      return;
    }

    logger.info(
      `Identified conventional buckets for deletion attempt: ${uniqueBucketsToDelete.join(", ")}`,
    );

    for (const bucketName of uniqueBucketsToDelete) {
      logger.info(`Processing deletion for conventional bucket: ${bucketName}`);
      // First, ensure the bucket is empty
      await this.emptyS3Bucket(bucketName);
      // Then, attempt to delete the bucket itself
      await this.deleteS3Bucket(bucketName);
    }

    logger.info(
      `Conventional S3 bucket deletion attempt phase completed for identifier ${baseIdentifier}, type ${stackType}, stage ${stage}.`,
    );
  }

  public async forceDeleteStack(
    stackIdentifier: string,
    stackType: StackType,
    stage: string,
    skipS3Cleanup: boolean = false,
  ): Promise<void> {
    const stackName = getStackName(stackType, stage);
    logger.info(
      `Starting force delete for stack: ${stackName} (type: ${stackType}) in region: ${this.region}`,
    );

    if (!skipS3Cleanup) {
      await this.emptyStackS3Buckets(stackIdentifier, stackType, stage);
    } else {
      logger.info(`Skipping S3 bucket cleanup for ${stackName} as requested.`);
    }

    try {
      const stack = await this.getStack(stackName);

      if (!stack) {
        logger.info(
          `Stack ${stackName} does not exist or is not accessible. Skipping deletion.`,
        );
        return;
      }

      logger.info(
        `Stack ${stackName} exists with status ${stack.StackStatus || "UNKNOWN"}. Proceeding with deletion attempt.`,
      );

      // Check if stack is already in a delete state
      if (stack.StackStatus === "DELETE_IN_PROGRESS") {
        logger.info(
          `Stack ${stackName} is already being deleted. Waiting for completion...`,
        );
        await this.waitForStackDeletion(stackName);
        return;
      }

      if (stack.StackStatus === "DELETE_COMPLETE") {
        logger.info(`Stack ${stackName} is already deleted.`);
        return;
      }

      // If stack is in failed state, try to continue deletion
      if (stack.StackStatus === "DELETE_FAILED") {
        logger.info(
          `Stack ${stackName} is in DELETE_FAILED state. Attempting to continue deletion...`,
        );
      } else {
        logger.info(`Initiating deletion of stack ${stackName}...`);
      }

      try {
        const deleteCommand = new DeleteStackCommand({ StackName: stackName });
        logger.debug(
          `CloudFormation DeleteStack command: ${JSON.stringify(deleteCommand.input)}`,
        );

        const deleteResponse = await this.cfnClient.send(deleteCommand);
        logger.debug(
          `CloudFormation DeleteStack response metadata: ${JSON.stringify(deleteResponse.$metadata)}`,
        );
        logger.info(`Delete command sent successfully for stack ${stackName}`);
      } catch (deleteError: any) {
        logger.error(`Error sending delete command for stack ${stackName}:`);
        logger.error(`  Error name: ${deleteError.name}`);
        logger.error(`  Error message: ${deleteError.message}`);
        logger.error(`  Error code: ${deleteError.code || "N/A"}`);
        logger.error(
          `  HTTP status: ${deleteError.$metadata?.httpStatusCode || "N/A"}`,
        );
        logger.error(
          `  Request ID: ${deleteError.$metadata?.requestId || "N/A"}`,
        );

        // Check if it's a "no updates" error (stack already being deleted)
        if (
          deleteError.message &&
          deleteError.message.includes("No updates are to be performed")
        ) {
          logger.info(
            `Stack ${stackName} is already in the process of being deleted.`,
          );
        } else {
          throw deleteError;
        }
      }

      logger.info(
        `DeleteStack command issued for ${stackName}. Waiting for deletion...`,
      );
      await this.waitForStackDeletion(stackName);
      logger.info(`Successfully deleted stack ${stackName}`);

      // After stack deletion, also delete the conventionally named buckets
      logger.info(`Deleting conventionally named buckets for ${stackName}...`);
      await this.deleteConventionalBuckets(stackIdentifier, stackType, stage);
    } catch (error: any) {
      logger.error(`Failed to delete stack ${stackName}:`);
      logger.error(`  Error name: ${error.name}`);
      logger.error(`  Error message: ${error.message}`);
      logger.error(`  Error code: ${error.code || "N/A"}`);
      logger.error(
        `  HTTP status: ${error.$metadata?.httpStatusCode || "N/A"}`,
      );
      logger.error(`  Request ID: ${error.$metadata?.requestId || "N/A"}`);

      // Provide specific guidance based on error type
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        logger.error(
          `This appears to be a permissions issue. Please check your AWS credentials and IAM policies.`,
        );
      } else if (error.name === "ValidationError") {
        logger.error(
          `This appears to be a validation error. The stack name or parameters may be invalid.`,
        );
      } else if (error.message && error.message.includes("DELETE_FAILED")) {
        logger.error(
          `Stack deletion failed. You may need to manually clean up resources before retrying.`,
        );
      }

      throw error;
    }
  }

  private async getStack(stackName: string): Promise<Stack | null> {
    try {
      const command = new DescribeStacksCommand({ StackName: stackName });
      const response = await this.cfnClient.send(command);
      return response.Stacks?.[0] || null;
    } catch (error: unknown) {
      const err = error as Error;
      if (
        err.name === "ValidationError" &&
        err.message.includes("does not exist")
      ) {
        // Stack doesn't exist - this is expected during deletion, so don't log as error
        return null;
      }
      // Only log unexpected errors
      logger.warning(
        `Unexpected error checking stack ${stackName}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Get the status of a stack
   */
  public async getStackStatus(stackName: string): Promise<string | null> {
    try {
      const stack = await this.getStack(stackName);
      return stack?.StackStatus || null;
    } catch (error: any) {
      // If stack doesn't exist, return null
      if (
        error.name === "ValidationError" ||
        (error.message &&
          error.message.toLowerCase().includes("does not exist"))
      ) {
        return null;
      }
      throw error;
    }
  }

  public async waitForStackDeletion(stackName: string): Promise<void> {
    const maxAttempts = 60;
    const delay = 30000;

    logger.info(
      `Waiting for stack ${stackName} deletion in region ${this.region} (max ${(maxAttempts * delay) / 1000 / 60} minutes)`,
    );

    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      try {
        const stack = await this.getStack(stackName);
        if (!stack) {
          logger.info(
            `Stack ${stackName} successfully deleted (verified by getStack).`,
          );
          return;
        }
        const status = stack.StackStatus;
        if (status === StackStatus.DELETE_FAILED) {
          const reason = stack.StackStatusReason || "No reason provided";
          logger.error(
            `Stack ${stackName} deletion failed. Status: ${status}. Reason: ${reason}`,
          );
          logger.error(
            `You may need to manually resolve resource dependencies or permissions issues and retry deletion.`,
          );

          throw new Error(
            `Stack ${stackName} deletion failed. Status: ${status}. Reason: ${reason}`,
          );
        }
        if (status === StackStatus.DELETE_COMPLETE) {
          logger.info(
            `Stack ${stackName} successfully deleted. Status: ${status}`,
          );
          return;
        }
        logger.info(
          `Waiting for stack ${stackName} to delete... Current status: ${status || "UNKNOWN"} (Attempt ${i + 1}/${maxAttempts})`,
        );
      } catch (error: any) {
        // If it's a getStack error and the stack doesn't exist, that's success
        if (
          error.name === "ValidationError" &&
          error.message &&
          error.message.toLowerCase().includes("does not exist")
        ) {
          logger.info(
            `Stack ${stackName} successfully deleted (confirmed by ValidationError).`,
          );
          return;
        }

        logger.error(
          `Error while waiting for stack ${stackName} deletion (attempt ${i + 1}/${maxAttempts}):`,
        );
        logger.error(`  Error name: ${error.name}`);
        logger.error(`  Error message: ${error.message}`);
        logger.error(`  Error code: ${error.code || "N/A"}`);

        // For other errors, re-throw immediately
        throw error;
      }
    }
    throw new Error(
      `Stack ${stackName} deletion timed out after ${(maxAttempts * delay) / 1000 / 60} minutes.`,
    );
  }
}
