/**
 * Utility to delete orphaned CloudWatch LogGroups before deployment
 *
 * This prevents CloudFormation errors when LogGroups were auto-created
 * by Lambda/AppSync during previous failed deployments.
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { logger } from "./logger";

export interface LogGroupCleanupOptions {
  appName: string;
  stage: string;
  region: string;
}

/**
 * Deletes orphaned LogGroups for a given app/stage before deployment
 */
export async function cleanupLogGroups(
  options: LogGroupCleanupOptions,
): Promise<void> {
  const { appName, stage, region } = options;
  const client = new CloudWatchLogsClient({ region });

  try {
    logger.info(`Checking for orphaned LogGroups (${appName}-${stage})...`);

    // Search for both Lambda and AppSync LogGroups
    const prefixes = [
      `/aws/lambda/${appName}-`,
      `/aws/appsync/apis/`,
    ];

    let allLogGroups: string[] = [];

    for (const prefix of prefixes) {
      const response = await client.send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: prefix,
        }),
      );

      if (response.logGroups && response.logGroups.length > 0) {
        // Filter to only include LogGroups for this stack
        const filtered = response.logGroups
          .map((lg) => lg.logGroupName!)
          .filter((name) =>
            prefix.includes("lambda")
              ? name.includes(`${appName}-`)
              : name.includes(stage),
          );
        allLogGroups.push(...filtered);
      }
    }

    if (allLogGroups.length === 0) {
      logger.info("✓ No orphaned LogGroups found");
      return;
    }

    logger.info(`Found ${allLogGroups.length} orphaned LogGroup(s):`);
    allLogGroups.forEach((name) => logger.info(`  - ${name}`));

    logger.info("Deleting orphaned LogGroups...");
    for (const logGroupName of allLogGroups) {
      try {
        await client.send(new DeleteLogGroupCommand({ logGroupName }));
        logger.info(`  ✓ Deleted ${logGroupName}`);
      } catch (err: any) {
        if (err.name === "ResourceNotFoundException") {
          logger.info(`  ⊘ Already deleted: ${logGroupName}`);
        } else {
          // Log but don't fail - orphaned LogGroups shouldn't block deployment
          logger.warning(
            `  ⚠ Failed to delete ${logGroupName}: ${err.message}`,
          );
        }
      }
    }

    logger.success("✓ LogGroup cleanup completed");
  } catch (error: any) {
    // Don't fail deployment if cleanup fails
    logger.warning(`⚠ LogGroup cleanup failed: ${error.message}`);
    logger.warning("  Continuing with deployment...");
  }
}
