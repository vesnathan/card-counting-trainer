import * as fs from "fs-extra";
import * as path from "path";
import * as esbuild from "esbuild";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  LambdaClient,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";
import archiver from "archiver";
import { logger } from "./logger";

export interface LambdaCompilerOptions {
  logger: typeof logger;
  baseLambdaDir: string;
  outputDir: string;
  s3BucketName?: string;
  s3KeyPrefix?: string;
  stage?: string;
  region?: string;
  debugMode?: boolean;
  appName?: string;
}

interface LambdaFunction {
  sourceFile: string;
  outputFile: string;
  zipFile: string;
  functionName: string;
}

export class LambdaCompiler {
  private logger: typeof logger;
  private baseLambdaDir: string;
  private outputDir: string;
  private s3BucketName?: string;
  private s3KeyPrefix: string;
  private stage: string;
  private s3Client?: S3Client;
  private lambdaClient?: LambdaClient;
  private region?: string;
  private debugMode: boolean;
  private appName: string;

  constructor(options: LambdaCompilerOptions) {
    this.logger = options.logger;
    this.baseLambdaDir = options.baseLambdaDir;
    this.outputDir = options.outputDir;
    this.s3BucketName = options.s3BucketName;
    this.s3KeyPrefix = options.s3KeyPrefix || "functions";
    this.stage = options.stage || "dev";
    this.region = options.region;
    this.debugMode = options.debugMode || false;
    this.appName = options.appName || "cardcountingtrainer";

    if (this.s3BucketName && options.region) {
      this.s3Client = new S3Client({ region: options.region });
      this.lambdaClient = new LambdaClient({ region: options.region });
    }
  }

  async compileLambdaFunctions(): Promise<void> {
    this.logger.info("Building Lambda functions...");

    // Discover all Lambda function files
    const lambdaFunctions = await this.discoverLambdaFunctions();

    if (lambdaFunctions.length === 0) {
      this.logger.warning("No Lambda functions found to compile");
      return;
    }

    // Ensure output directory exists
    await fs.ensureDir(this.outputDir);

    // Compile each Lambda function
    const uploadedFunctions: string[] = [];
    const failedFunctions: { name: string; error: string }[] = [];

    for (const lambdaFunc of lambdaFunctions) {
      try {
        const compiledCode = await this.compileLambdaFunction(lambdaFunc);

        // Create ZIP file
        await this.createZipFile(lambdaFunc);

        // Upload to S3 if configured
        if (this.s3Client && this.s3BucketName) {
          const s3Key = path.posix.join(
            this.s3KeyPrefix,
            this.stage,
            `${lambdaFunc.functionName}.zip`,
          );

          await this.uploadZipToS3(s3Key, lambdaFunc.zipFile);
          uploadedFunctions.push(s3Key);

          if (this.debugMode) {
            this.logger.debug(
              `✓ Uploaded ${lambdaFunc.functionName} to S3: s3://${this.s3BucketName}/${s3Key}`,
            );
          }

          // Force Lambda function to update from S3
          await this.updateLambdaFunctionCode(
            lambdaFunc.functionName,
            this.s3BucketName,
            s3Key,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to compile ${lambdaFunc.functionName}: ${error.message}`,
        );
        failedFunctions.push({
          name: lambdaFunc.functionName,
          error: error.message,
        });
      }
    }

    if (failedFunctions.length > 0) {
      throw new Error(
        `Failed to compile ${failedFunctions.length} Lambda function(s)`,
      );
    }

    this.logger.success(
      `✓ All Lambda functions compiled successfully (${lambdaFunctions.length} functions)`,
    );

    if (uploadedFunctions.length > 0) {
      this.logger.success(
        `✓ Uploaded ${uploadedFunctions.length} Lambda function(s) to S3`,
      );
    }
  }

  private async discoverLambdaFunctions(): Promise<LambdaFunction[]> {
    const functions: LambdaFunction[] = [];

    if (!(await fs.pathExists(this.baseLambdaDir))) {
      this.logger.warning(`Lambda directory not found: ${this.baseLambdaDir}`);
      return functions;
    }

    const files = await fs.readdir(this.baseLambdaDir);

    for (const file of files) {
      if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
        const functionName = path.basename(file, ".ts");
        functions.push({
          sourceFile: path.join(this.baseLambdaDir, file),
          outputFile: path.join(this.outputDir, `${functionName}.js`),
          zipFile: path.join(this.outputDir, `${functionName}.zip`),
          functionName,
        });
      }
    }

    return functions;
  }

  private async compileLambdaFunction(
    lambdaFunc: LambdaFunction,
  ): Promise<string> {
    if (this.debugMode) {
      this.logger.debug(
        `Compiling ${lambdaFunc.sourceFile} -> ${lambdaFunc.outputFile}`,
      );
    }

    try {
      // Use esbuild to bundle the Lambda function with its dependencies
      const result = await esbuild.build({
        entryPoints: [lambdaFunc.sourceFile],
        bundle: true,
        platform: "node",
        target: "node18",
        format: "cjs",
        outfile: lambdaFunc.outputFile,
        external: ["@aws-sdk/*"], // AWS SDK is provided by Lambda runtime
        write: false, // We'll write manually to add the header
        sourcemap: false,
        minify: true, // Minify to reduce size
        keepNames: false,
      });

      // Get the compiled code
      let jsCode = result.outputFiles[0].text;

      // Add auto-generated warning header
      const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * This file is automatically generated from:
 * ${path.relative(process.cwd(), lambdaFunc.sourceFile)}
 * 
 * To make changes, edit the source TypeScript file and run the build.
 * 
 * Generated: ${new Date().toISOString()}
 */

${jsCode}`;

      // Write compiled JavaScript with header
      await fs.writeFile(lambdaFunc.outputFile, output, "utf-8");

      if (this.debugMode) {
        this.logger.debug(`✓ Compiled ${lambdaFunc.functionName}`);
      }

      // Return the code for S3 upload
      return output;
    } catch (error: any) {
      throw new Error(
        `Failed to compile ${lambdaFunc.functionName}: ${error.message}`,
      );
    }
  }

  private async createZipFile(lambdaFunc: LambdaFunction): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(lambdaFunc.zipFile);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        if (this.debugMode) {
          this.logger.debug(
            `Created ZIP file: ${lambdaFunc.zipFile} (${archive.pointer()} bytes)`,
          );
        }
        resolve();
      });

      archive.on("error", (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // Add the compiled JS file as index.js
      archive.file(lambdaFunc.outputFile, { name: "index.js" });

      archive.finalize();
    });
  }

  private async uploadZipToS3(
    s3Key: string,
    zipFilePath: string,
  ): Promise<void> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error("S3 client not configured for upload");
    }

    const zipContent = await fs.readFile(zipFilePath);

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: s3Key,
      Body: zipContent,
      ContentType: "application/zip",
    });

    await this.s3Client.send(command);
  }

  private async uploadToS3(s3Key: string, content: string): Promise<void> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error("S3 client not configured for upload");
    }

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: s3Key,
      Body: content,
      ContentType: "application/javascript",
    });

    await this.s3Client.send(command);
  }

  async clean(): Promise<void> {
    if (await fs.pathExists(this.outputDir)) {
      this.logger.info(`Cleaning Lambda output directory: ${this.outputDir}`);
      await fs.remove(this.outputDir);
    }
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }

  /**
   * Force update Lambda function code from S3
   * This is necessary because CloudFormation doesn't update Lambda code when only S3 file content changes
   */
  private async updateLambdaFunctionCode(
    functionName: string,
    s3Bucket: string,
    s3Key: string,
  ): Promise<void> {
    if (!this.lambdaClient) {
      return;
    }

    const kebabCaseName = this.toKebabCase(functionName);
    const fullFunctionName = `${this.appName}-${kebabCaseName}-${this.stage}`;

    try {
      const command = new UpdateFunctionCodeCommand({
        FunctionName: fullFunctionName,
        S3Bucket: s3Bucket,
        S3Key: s3Key,
      });

      await this.lambdaClient.send(command);

      if (this.debugMode) {
        this.logger.debug(
          `✓ Force updated Lambda function: ${fullFunctionName}`,
        );
      }
    } catch (error: any) {
      // Lambda might not exist yet (first deployment), so don't fail
      if (error.name === "ResourceNotFoundException") {
        if (this.debugMode) {
          this.logger.debug(
            `Lambda function ${fullFunctionName} does not exist yet (will be created by CloudFormation)`,
          );
        }
      } else {
        this.logger.warning(
          `Could not force update Lambda ${fullFunctionName}: ${error.message}`,
        );
      }
    }
  }
}

export async function compileLambdaFunctions(
  options: LambdaCompilerOptions,
): Promise<void> {
  const compiler = new LambdaCompiler(options);
  await compiler.compileLambdaFunctions();
}
