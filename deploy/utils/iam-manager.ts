import { IAM } from "@aws-sdk/client-iam";
import { StackType, getStackName } from "../types";
import { logger } from "./logger";

export class IamManager {
  private iam: IAM;
  private currentUserArn: string | undefined;

  constructor(region: string = process.env.AWS_REGION || "ap-southeast-2") {
    this.iam = new IAM({ region });
  }

  private async getCurrentUserArn(): Promise<string> {
    if (this.currentUserArn) {
      return this.currentUserArn;
    }

    try {
      logger.debug("Getting current IAM user...");
      const response = await this.iam.getUser();
      if (!response.User?.Arn) {
        throw new Error("Failed to get current user ARN");
      }
      this.currentUserArn = response.User.Arn;
      logger.debug(`Current user ARN: ${this.currentUserArn}`);
      return this.currentUserArn;
    } catch (error: any) {
      logger.error(`Failed to get current user: ${error?.message}`);
      throw error;
    }
  }

  async setupRole(
    stackType: StackType,
    stage: string,
    templateBucketName?: string,
  ): Promise<string> {
    const roleName = `${getStackName(stackType, stage)}-role`;

    try {
      logger.debug(`Getting current user ARN for role ${roleName}...`);
      const currentUserArn = await this.getCurrentUserArn();

      // Check if role exists
      logger.debug(`Checking if role ${roleName} exists...`);
      try {
        const role = await this.iam.getRole({ RoleName: roleName });
        logger.debug(`Role ${roleName} already exists`);
        if (!role.Role?.Arn) {
          throw new Error(`Role ${roleName} exists but has no ARN`);
        }
        return role.Role.Arn;
      } catch (roleError: any) {
        // Both NoSuchEntity and "role cannot be found" indicate the role doesn't exist
        // Check multiple error properties to handle different AWS SDK error formats
        const isRoleNotFound =
          roleError.name === "NoSuchEntity" ||
          roleError.Code === "NoSuchEntity" ||
          roleError.message?.includes("NoSuchEntity") ||
          roleError.message?.includes("cannot be found") ||
          roleError.$metadata?.httpStatusCode === 404;

        if (!isRoleNotFound) {
          logger.error(`Unexpected error checking role: ${roleError?.name || roleError?.Code} - ${roleError?.message}`);
          throw roleError;
        }
        logger.debug(`Role ${roleName} does not exist, creating...`);
      }

      // Create role with assume role policy
      logger.info(`Creating role: ${roleName}`);
      const createRoleResponse = await this.iam.createRole({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "cloudformation.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
            {
              Effect: "Allow",
              Principal: {
                AWS: currentUserArn,
              },
              Action: "sts:AssumeRole",
            },
          ],
        }),
        Tags: [
          {
            Key: "Purpose",
            Value: "CloudFormation Stack Management",
          },
        ],
      });

      if (!createRoleResponse.Role?.Arn) {
        throw new Error(`Failed to create role ${roleName} - no ARN returned`);
      }

      // Attach policy
      logger.info(`Attaching policy to role ${roleName}...`);
      const policyDocument = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "*",
            Resource: "*",
          },
        ],
      };

      await this.iam.putRolePolicy({
        RoleName: roleName,
        PolicyName: `${roleName}-policy`,
        PolicyDocument: JSON.stringify(policyDocument),
      });

      logger.success(`Created role ${roleName} with policy`);

      if (templateBucketName) {
        const bucketName = templateBucketName;

        const s3PolicyDocument = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${bucketName}/*`,
            },
          ],
        };

        const s3PolicyName = `${roleName}-s3-read-policy`;

        try {
          await this.iam.putRolePolicy({
            RoleName: roleName,
            PolicyName: s3PolicyName,
            PolicyDocument: JSON.stringify(s3PolicyDocument),
          });
          logger.info(`Attached S3 read inline policy to role ${roleName}`);
        } catch (error: any) {
          logger.error(
            `Error attaching S3 read inline policy to role: ${error.message}`,
          );
          throw error;
        }
      }

      // Wait for IAM role and policies to propagate
      logger.debug(
        "Waiting 10 seconds for IAM role and policies to propagate...",
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      return createRoleResponse.Role.Arn;
    } catch (error: any) {
      logger.error(`Failed to setup role ${roleName}: ${error?.message}`);
      throw error;
    }
  }
}
