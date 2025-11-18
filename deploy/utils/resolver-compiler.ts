import { execSync, spawn } from "child_process";
import * as fsPromises from "fs/promises";
import * as fs from "fs-extra"; // Changed to fs-extra for better file system operations
import * as path from "path";
import * as os from "os"; // Added import
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import * as crypto from "crypto";
import { logger, setLogFile, closeLogFile } from "./logger"; // Import logger utilities
import * as esbuild from "esbuild"; // Added import for esbuild

// Assuming these types are defined elsewhere or should be defined
interface ResolverCompilationResult {
  resolverFile: string;
  s3Key: string;
  localPath: string;
}

interface ResolverInfo {
  typescriptPath: string;
  javascriptPath: string;
  s3Key: string;
  // Add other necessary properties if any
}

export interface ResolverCompilerOptions {
  logger: typeof logger;
  baseResolverDir: string;
  s3KeyPrefix: string;
  stage: string;
  s3BucketName: string;
  region: string;
  resolverFiles: string[];
  sharedFileName?: string;
  sharedFileS3Key?: string;
  debugMode?: boolean; // Added debugMode
  constantsDir?: string; // Optional path to constants directory
  appName?: string; // Optional app name for standalone projects
  backendPackageJsonPath?: string; // Optional path to backend package.json for standalone projects
  gqlTypesPath?: string; // Optional path to gqlTypes.ts for standalone projects
}

class ResolverCompiler {
  private logger: typeof logger;
  private baseResolverDir: string;
  private buildDir: string;
  private s3KeyPrefix: string;
  private stage: string;
  private resolverFiles: string[];
  private s3BucketName: string;
  private s3Client: S3Client;
  private region: string;
  private sharedFileName?: string;
  private sharedFileS3Key?: string;
  private debugMode: boolean; // Added debugMode
  private constantsDir?: string; // Optional constants directory
  private appName?: string; // Optional app name for standalone projects
  private backendPackageJsonPath?: string; // Optional path to backend package.json
  private gqlTypesPath?: string; // Optional path to gqlTypes.ts

  private readonly gqlTypesSourceFileName = "gqlTypes.ts";

  constructor(options: ResolverCompilerOptions) {
    this.logger = options.logger;
    this.baseResolverDir = options.baseResolverDir;
    this.s3KeyPrefix = options.s3KeyPrefix;
    this.stage = options.stage;
    this.s3BucketName = options.s3BucketName;
    this.region = options.region;
    this.resolverFiles = options.resolverFiles;
    this.sharedFileName = options.sharedFileName;
    this.sharedFileS3Key = options.sharedFileS3Key;
    this.s3Client = new S3Client({ region: this.region });
    this.debugMode = options.debugMode || false; // Initialize debugMode
    this.constantsDir = options.constantsDir; // Initialize constantsDir
    this.appName = options.appName; // Initialize appName
    this.backendPackageJsonPath = options.backendPackageJsonPath; // Initialize backendPackageJsonPath
    this.gqlTypesPath = options.gqlTypesPath; // Initialize gqlTypesPath

    // buildDir is a temporary directory for the entire compilation process of this instance.
    // It will be created by setupBuildDirectory and cleaned up at start of each deploy.
    // Use .cache directory inside monorepo to keep build artifacts
    // __dirname is /packages/deploy/utils, so go up 3 levels to get to monorepo root
    const monorepoRoot = path.join(__dirname, "..", "..", "..");
    const parts = this.baseResolverDir.split(path.sep);
    const pkgIndex = parts.indexOf("packages");
    const appName =
      this.appName ||
      (pkgIndex >= 0 && pkgIndex + 1 < parts.length
        ? parts[pkgIndex + 1]
        : "unknown");
    // Use consistent resolvers directory (no timestamp) so it gets cleaned each deploy
    this.buildDir = path.join(
      monorepoRoot,
      ".cache",
      "deploy",
      appName,
      "resolvers",
    );
  }

  private getAppName(): string {
    // If appName was explicitly provided, use it
    if (this.appName) {
      return this.appName;
    }
    // this.baseResolverDir is like /workspaces/nl-mono-repo/packages/cloudwatchlive/backend/resolvers
    const parts = this.baseResolverDir.split(path.sep);
    const packagesIndex = parts.indexOf("packages");
    if (packagesIndex !== -1 && packagesIndex + 1 < parts.length) {
      return parts[packagesIndex + 1];
    }
    logger.warning(
      `Could not determine app name from baseResolverDir: ${this.baseResolverDir}, defaulting to 'unknown'`,
    );
    return "unknown";
  }

  private async recursiveCopy(src: string, dest: string): Promise<void> {
    await fsPromises.mkdir(dest, { recursive: true });
    const entries = await fsPromises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.recursiveCopy(srcPath, destPath);
      } else {
        await fsPromises.copyFile(srcPath, destPath);
      }
    }
  }

  // Assume findLocalTypescriptCompiler is defined
  private async findLocalTypescriptCompiler(): Promise<string> {
    // Placeholder implementation
    return "tsc";
  }

  // Assume addHeaderToJs is defined
  private addHeaderToJs(jsContent: string, sourceFilePath: string): string {
    const relativeSourcePath = path.relative(process.cwd(), sourceFilePath);
    const header = `
/**********************************************************************************************************************
 *                                                                                                                    *
 *  DO NOT EDIT THIS FILE.                                                                                            *
 *                                                                                                                    *
 *  This file is automatically generated by the build process.                                                        *
 *                                                                                                                    *
 *  Source file: ${relativeSourcePath}                                                                                *
 *                                                                                                                    *
 **********************************************************************************************************************/
    `;
    return header.trim() + "\n\n" + jsContent;
  }

  // Assume uploadToS3 is defined
  private async uploadToS3(
    s3Key: string,
    content: string,
    contentType: string,
  ): Promise<void> {
    // Placeholder implementation
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: s3Key,
        Body: content,
        ContentType: contentType,
      }),
    );
  }

  private async runTsc(
    cwd: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    const tscPath = await this.findLocalTypescriptCompiler();
    return new Promise((resolve, reject) => {
      const process = spawn(tscPath, args, { cwd, stdio: "pipe" });
      let stdout = "";
      let stderr = "";
      process.stdout.on("data", (data) => (stdout += data.toString()));
      process.stderr.on("data", (data) => (stderr += data.toString()));
      process.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              `tsc exited with code ${code}\\\\nstdout: ${stdout}\\\\nstderr: ${stderr}`,
            ),
          );
        }
      });
      process.on("error", (err) => reject(err));
    });
  }

  private async compileAndUploadSharedFile(): Promise<void> {
    if (!this.sharedFileName || !this.sharedFileS3Key) {
      logger.debug(
        "No shared file specified, skipping shared file compilation.",
      );
      return;
    }
    logger.success(`Compiling shared file: ${this.sharedFileName}`); // Essential log
    const sourceFilePath = path.join(this.baseResolverDir, this.sharedFileName);
    const targetS3Key = path.posix.join(
      this.s3KeyPrefix,
      this.stage,
      this.sharedFileS3Key,
    );

    const tempCompileDir = path.join(
      this.buildDir,
      `__${path.basename(this.sharedFileName, ".ts")}Compilation`,
    );
    await fsPromises
      .rm(tempCompileDir, { recursive: true, force: true })
      .catch(() => {
        /* ignore if not exists */
      });
    await fsPromises.mkdir(tempCompileDir, { recursive: true });

    const tempSourceFilePath = path.join(tempCompileDir, this.sharedFileName);
    await fsPromises.copyFile(sourceFilePath, tempSourceFilePath);

    // Create package.json
    const packageJsonContent = {
      name: `compile-${path.basename(this.sharedFileName, ".ts").toLowerCase()}`, // Ensure valid package name
      version: "1.0.0",
      private: true,
      type: "module",
      dependencies: {
        graphql: "^16.9.0", // Version from root package.json
      },
      devDependencies: {
        typescript: "5.5.4", // Version from root package.json
      },
    };
    const packageJsonPath = path.join(tempCompileDir, "package.json");
    await fsPromises.writeFile(
      packageJsonPath,
      JSON.stringify(packageJsonContent, null, 2),
    );
    logger.debug(
      `Created package.json for ${this.sharedFileName} in ${tempCompileDir}`,
    );

    // Install dependencies
    try {
      logger.debug(
        `Installing dependencies for ${this.sharedFileName} in ${tempCompileDir}...`,
      ); // Essential log
      const yarnInstallOutput = execSync(
        "yarn install --ignore-scripts --no-progress --non-interactive",
        {
          cwd: tempCompileDir,
          stdio: this.debugMode ? "pipe" : "ignore", // Conditional stdio
          encoding: "utf8",
        },
      );
      logger.success(`Yarn install completed for ${this.sharedFileName}.`); // Essential log
      if (yarnInstallOutput)
        logger.debug(
          `Yarn install output for ${this.sharedFileName}:\\n${yarnInstallOutput}`,
        );
    } catch (error: any) {
      logger.error(
        `Yarn install failed for ${this.sharedFileName} in ${tempCompileDir}: ${(error as Error).message}`,
      );
      if (error.stdout)
        logger.error(`Yarn stdout:\n${error.stdout.toString()}`);
      if (error.stderr)
        logger.error(`Yarn stderr:\n${error.stderr.toString()}`);
      await fsPromises.rm(tempCompileDir, { recursive: true, force: true });
      throw error;
    }

    const tsconfigContent = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS", // AppSync requires CommonJS, not ESNext
        moduleResolution: "node",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        declaration: false,
        sourceMap: false,
        outDir: ".", // Output .js file in the same directory (tempCompileDir)
        rootDir: ".",
        resolveJsonModule: true, // Often useful
      },
      files: [this.sharedFileName], // Compile only the specific file
      exclude: ["node_modules"],
    };
    const tsconfigPath = path.join(tempCompileDir, "tsconfig.json");
    await fsPromises.writeFile(
      tsconfigPath,
      JSON.stringify(tsconfigContent, null, 2),
    );
    logger.debug(
      `Created tsconfig.json for ${this.sharedFileName} in ${tempCompileDir}`,
    );

    try {
      logger.debug(
        `Running yarn tsc for ${this.sharedFileName} in ${tempCompileDir}`,
      ); // Essential log
      const tscOutput = execSync(
        "yarn tsc --project tsconfig.json --listEmittedFiles",
        {
          cwd: tempCompileDir,
          stdio: this.debugMode ? "pipe" : "ignore", // Conditional stdio
          encoding: "utf8",
        },
      );
      logger.success(`TSC compilation completed for ${this.sharedFileName}.`); // Essential log
      if (tscOutput)
        logger.debug(`TSC Output for ${this.sharedFileName}:\\n${tscOutput}`);
    } catch (error: any) {
      logger.error(
        `Error compiling ${this.sharedFileName}: ${(error as Error).message}`,
      );
      if (error.stdout) logger.error(`TSC stdout:\n${error.stdout.toString()}`);
      if (error.stderr) logger.error(`TSC stderr:\n${error.stderr.toString()}`);
      // Log contents of tempCompileDir for debugging
      try {
        const dirContents = await fsPromises.readdir(tempCompileDir, {
          withFileTypes: true,
        });
        logger.error(`Contents of ${tempCompileDir} on failure:`);
        dirContents.forEach((entry) =>
          logger.error(`${entry.name}${entry.isDirectory() ? "/" : ""}`),
        );
      } catch (lsError) {
        logger.error(
          `Could not list contents of ${tempCompileDir}: ${(lsError as Error).message}`,
        );
      }
      await fsPromises.rm(tempCompileDir, { recursive: true, force: true });
      throw error;
    }

    const compiledJsFileName = `${path.basename(this.sharedFileName, ".ts")}.js`;
    const compiledJsPath = path.join(tempCompileDir, compiledJsFileName);

    try {
      await fsPromises.access(compiledJsPath, fs.constants.F_OK);
      logger.debug(`Successfully found compiled file: ${compiledJsPath}`);
    } catch (e) {
      logger.error(
        `Compiled file not found at ${compiledJsPath} after tsc run.`,
      );
      logger.error(`Contents of ${tempCompileDir} (if not logged above):`);
      try {
        const dirContents = await fsPromises.readdir(tempCompileDir);
        logger.error(dirContents.join("\\n"));
      } catch (lsError) {
        logger.error(
          `Could not list contents of ${tempCompileDir}: ${(lsError as Error).message}`,
        );
      }
      await fsPromises.rm(tempCompileDir, { recursive: true, force: true });
      throw new Error(
        `Compilation output ${compiledJsFileName} not found in ${tempCompileDir}.`,
      );
    }

    let jsContent = await fsPromises.readFile(compiledJsPath, "utf-8");
    jsContent = this.addHeaderToJs(jsContent, sourceFilePath);

    // Save locally for debugging, but do NOT persist into tracked package folders.
    // Use a repo-local cache directory that is git-ignored: .cache/deploy/<app>/lib
    if (this.sharedFileS3Key) {
      const appName = this.getAppName();
      const monorepoRoot = path.join(__dirname, "..", "..", "..", "..");
      const localSavePathBaseForApp = path.join(
        monorepoRoot,
        ".cache",
        "deploy",
        appName,
        "lib",
      );
      const localSavePath = path.join(
        localSavePathBaseForApp,
        this.sharedFileS3Key,
      );
      await this.saveCompiledFileLocally(localSavePath, jsContent);
    }

    await this.uploadToS3(targetS3Key, jsContent, "application/javascript");
    logger.success(
      `Uploaded ${compiledJsFileName} to S3: s3://${this.s3BucketName}/${targetS3Key}`,
    ); // Essential log

    await fsPromises.rm(tempCompileDir, { recursive: true, force: true });
    logger.debug(`Cleaned up temp compile directory: ${tempCompileDir}`);
  }

  /**
   * Cleans up old resolver deployments from S3, keeping only the most recent ones
   * @param keepCount Number of recent deployments to keep (default: 5)
   */
  private async cleanupOldS3Resolvers(keepCount: number = 5): Promise<void> {
    try {
      logger.debug(
        `Checking for old resolver deployments to clean up in S3...`,
      );

      // List all objects under the resolver prefix for this stage
      const prefix = path.posix.join(this.s3KeyPrefix, this.stage) + "/";

      const listCommand = new ListObjectsV2Command({
        Bucket: this.s3BucketName,
        Prefix: prefix,
        Delimiter: "/",
      });

      const response = await this.s3Client.send(listCommand);

      if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
        logger.debug(`No previous resolver deployments found in S3`);
        return;
      }

      // Extract hash directories
      const hashDirs: { prefix: string; hash: string }[] = [];
      for (const commonPrefix of response.CommonPrefixes) {
        if (commonPrefix.Prefix) {
          const hash = commonPrefix.Prefix.replace(prefix, "").replace("/", "");
          if (hash) {
            hashDirs.push({ prefix: commonPrefix.Prefix, hash });
          }
        }
      }

      // Sort by hash (most recent first based on timestamp of creation)
      // We'll need to check the last modified time of objects to sort properly
      const hashDirsWithTime: {
        prefix: string;
        hash: string;
        lastModified: Date;
      }[] = [];

      for (const hashDir of hashDirs) {
        // Get one object from this hash directory to check its timestamp
        const listObjectsCommand = new ListObjectsV2Command({
          Bucket: this.s3BucketName,
          Prefix: hashDir.prefix,
          MaxKeys: 1,
        });

        const objectsResponse = await this.s3Client.send(listObjectsCommand);
        if (objectsResponse.Contents && objectsResponse.Contents.length > 0) {
          const lastModified =
            objectsResponse.Contents[0].LastModified || new Date(0);
          hashDirsWithTime.push({ ...hashDir, lastModified });
        }
      }

      // Sort by last modified time (newest first)
      hashDirsWithTime.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      // Determine which deployments to delete (keep the most recent keepCount)
      const deploymentsToDelete = hashDirsWithTime.slice(keepCount);

      if (deploymentsToDelete.length === 0) {
        logger.debug(
          `Found ${hashDirsWithTime.length} resolver deployment(s), keeping all (limit: ${keepCount})`,
        );
        return;
      }

      logger.info(
        `Found ${hashDirsWithTime.length} resolver deployments. Keeping ${Math.min(keepCount, hashDirsWithTime.length)}, deleting ${deploymentsToDelete.length} old deployment(s)...`,
      );

      // Delete old deployments
      for (const deployment of deploymentsToDelete) {
        await this.deleteS3Prefix(deployment.prefix);
        logger.success(`✓ Deleted old resolver deployment: ${deployment.hash}`);
      }

      logger.success(
        `Cleaned up ${deploymentsToDelete.length} old resolver deployment(s) from S3`,
      );
    } catch (error: any) {
      logger.warning(
        `Failed to cleanup old S3 resolvers (continuing): ${error.message}`,
      );
    }
  }

  /**
   * Deletes all objects under a given S3 prefix
   */
  private async deleteS3Prefix(prefix: string): Promise<void> {
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.s3BucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3Client.send(listCommand);

      if (response.Contents && response.Contents.length > 0) {
        const objectsToDelete = response.Contents.map((obj) => ({
          Key: obj.Key!,
        }));

        const deleteCommand = new DeleteObjectsCommand({
          Bucket: this.s3BucketName,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true,
          },
        });

        await this.s3Client.send(deleteCommand);
        logger.debug(
          `Deleted ${objectsToDelete.length} objects from ${prefix}`,
        );
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  public async compileAndUploadResolvers(): Promise<string> {
    const appName = this.getAppName();
    const monorepoRoot = path.join(__dirname, "..", "..", "..", "..");

    const stopSpinner = logger.infoWithSpinner(
      "Starting resolver compilation and upload...",
    );
    try {
      await this.setupBuildDirectory();
      await this.compileAndUploadSharedFile();
    } finally {
      stopSpinner();
    }

    const totalFiles = this.resolverFiles.length;
    logger.debug(`Processing ${totalFiles} resolver files...`); // Essential log

    // Save compiled resolver files into a repo-local cache directory (not tracked):
    // .cache/deploy/<app>/resolvers
    const localSavePathBaseForApp = path.join(
      monorepoRoot,
      ".cache",
      "deploy",
      appName,
      "resolvers",
    );

    // Clean up previous deployment cache before compilation
    // This includes both resolvers and shared lib files
    const deploymentCacheBaseForApp = path.join(
      monorepoRoot,
      ".cache",
      "deploy",
      appName,
    );

    try {
      if (fs.existsSync(deploymentCacheBaseForApp)) {
        logger.debug(
          `Cleaning up previous deployment cache (except logs): ${deploymentCacheBaseForApp}`,
        );

        // Remove resolvers and lib directories but keep log files
        const resolversDir = path.join(deploymentCacheBaseForApp, "resolvers");
        const libDir = path.join(deploymentCacheBaseForApp, "lib");

        if (fs.existsSync(resolversDir)) {
          await fsPromises.rm(resolversDir, { recursive: true, force: true });
          logger.debug("Cleaned resolvers directory");
        }
        if (fs.existsSync(libDir)) {
          await fsPromises.rm(libDir, { recursive: true, force: true });
          logger.debug("Cleaned lib directory");
        }

        logger.debug("Previous deployment cache cleaned (logs preserved)");
      }
    } catch (error: any) {
      logger.warning(
        `Failed to clean deployment cache (continuing): ${error.message}`,
      );
    }

    logger.debug(
      `Compiled resolvers will be saved to: ${localSavePathBaseForApp}`,
    );

    const failedResolvers: { file: string; error: string }[] = [];
    const compiledFilesRelative: string[] = [];

    for (let index = 0; index < totalFiles; index++) {
      const resolverFileRelativePath = this.resolverFiles[index];

      if (resolverFileRelativePath === this.sharedFileName) {
        logger.debug(
          `Skipping inlining/recompilation of shared file: ${resolverFileRelativePath} in main loop.`,
        );
        continue;
      }

      logger.debug(
        `[${index + 1}/${totalFiles}] Processing resolver: ${resolverFileRelativePath}...`,
      ); // Essential log

      const resolverAbsolutePath = path.join(
        this.baseResolverDir,
        resolverFileRelativePath,
      );

      try {
        const originalResolverSourceCode = await fsPromises.readFile(
          resolverAbsolutePath,
          "utf-8",
        );

        // Pass the original source code and its absolute path for context
        const compiledJsContent = await this.compileTypeScript(
          originalResolverSourceCode,
          resolverAbsolutePath,
        );

        // Determine local save path and persist compiled file for hashing
        const localSavePath = path.join(
          localSavePathBaseForApp,
          resolverFileRelativePath.replace(".ts", ".js"),
        );
        await this.saveCompiledFileLocally(localSavePath, compiledJsContent);

        // Do NOT upload to the non-hashed S3 path here. We'll compute a build hash
        // and upload the canonical files under the hashed prefix so CloudFormation
        // references stable, versioned assets only.
        compiledFilesRelative.push(
          resolverFileRelativePath.replace(".ts", ".js"),
        );
      } catch (error: any) {
        const errorMsg = `Failed to compile or upload resolver ${resolverFileRelativePath}: ${error.message}`;
        logger.error(errorMsg);
        if (error.stack) {
          logger.debug(`Stack trace: ${error.stack}`);
        }
        failedResolvers.push({
          file: resolverFileRelativePath,
          error: error.message,
        });
      }
    }

    // Compute build hash from compiled files saved locally
    logger.debug("Computing resolver build hash from compiled files...");
    let buildHash = "";
    try {
      // Read all compiled files from localSavePathBaseForApp
      const contents: string[] = [];
      // Sort names to get deterministic ordering
      compiledFilesRelative.sort();
      for (const relPath of compiledFilesRelative) {
        const localFile = path.join(localSavePathBaseForApp, relPath);
        try {
          const buf = await fsPromises.readFile(localFile, "utf-8");
          contents.push(buf);
        } catch (err: any) {
          logger.error(
            `Failed to read compiled file for hashing: ${localFile} - ${err.message}`,
          );
          throw err;
        }
      }
      const hasher = crypto.createHash("sha256");
      for (const c of contents) hasher.update(c);
      buildHash = hasher.digest("hex").slice(0, 16);
      logger.success(`Computed resolvers build hash: ${buildHash}`);
    } catch (err: any) {
      logger.error(`Error computing build hash: ${err.message}`);
      throw err;
    }

    // Upload compiled files again under hashed prefix so CloudFormation references change
    const failedHashedUploads: { file: string; error: string }[] = [];
    for (const relPath of compiledFilesRelative) {
      const s3KeyHashed = path.posix.join(
        this.s3KeyPrefix,
        this.stage,
        buildHash,
        relPath,
      );
      const localPath = path.join(localSavePathBaseForApp, relPath);
      try {
        const content = await fsPromises.readFile(localPath, "utf-8");
        await this.uploadToS3(s3KeyHashed, content, "application/javascript");
        logger.success(
          `✓ Uploaded hashed resolver ${relPath} to s3://${this.s3BucketName}/${s3KeyHashed}`,
        );
      } catch (err: any) {
        logger.error(
          `Failed to upload hashed resolver ${relPath}: ${err.message}`,
        );
        failedHashedUploads.push({ file: relPath, error: err.message });
      }
    }

    // Report summary for primary uploads
    logger.success(`\n📦 Resolver Compilation Summary:`);
    logger.success(
      `   ✓ Successfully compiled: ${compiledFilesRelative.length} resolvers (will be uploaded under hashed prefix)`,
    );

    if (failedResolvers.length > 0) {
      logger.error(
        `   ✗ Failed to upload: ${failedResolvers.length} resolvers`,
      );
      failedResolvers.forEach(({ file, error }) => {
        logger.error(`     - ${file}: ${error}`);
      });
      throw new Error(
        `Failed to upload ${failedResolvers.length} resolver(s). Deployment cannot continue.`,
      );
    }

    if (failedHashedUploads.length > 0) {
      logger.error(
        `Failed to upload ${failedHashedUploads.length} hashed resolvers:`,
      );
      failedHashedUploads.forEach(({ file, error }) => {
        logger.error(`  - ${file}: ${error}`);
      });
      throw new Error(`Failed to upload some hashed resolver files.`);
    }

    logger.success("✓ All resolvers compiled and uploaded successfully.\n");
    logger.info(`Build hash: ${buildHash}`);

    // Clean up old resolver deployments from S3 (keep last 5)
    await this.cleanupOldS3Resolvers(5);

    // await this.cleanupBuildDirectory(); // Cleanup buildDir after all operations

    return buildHash;
  }

  private async saveCompiledFileLocally(
    localPath: string,
    content: string,
  ): Promise<void> {
    try {
      await fsPromises.mkdir(path.dirname(localPath), { recursive: true });
      await fsPromises.writeFile(localPath, content);
      logger.debug(`Saved compiled file to ${localPath}`);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(
          `Failed to save compiled file to ${localPath}: ${error.message}`,
        );
      } else {
        logger.error(
          `Failed to save compiled file to ${localPath}: ${String(error)}`,
        );
      }
      throw error;
    }
  }

  private async setupBuildDirectory(): Promise<void> {
    logger.debug(`Setting up build directory: ${this.buildDir}`);
    await fsPromises.rm(this.buildDir, { recursive: true, force: true });
    await fsPromises.mkdir(this.buildDir, { recursive: true });

    // No need to copy gqlTypes.ts - we'll read it directly from its location when needed

    // Centralize build configuration and dependency installation
    await this.setupBuildConfiguration();

    try {
      logger.debug(
        `Installing dependencies in shared build directory: ${this.buildDir}...`,
      );
      // Removed --frozen-lockfile as we generate the lockfile in this temp environment
      const yarnOutput = execSync(
        "yarn install --ignore-scripts --no-progress --non-interactive",
        {
          cwd: this.buildDir,
          stdio: "pipe", // Always pipe stdio to catch errors
          encoding: "utf8",
        },
      );
      logger.success(`Yarn install completed for shared build directory.`);
      if (yarnOutput) {
        logger.debug(
          `Yarn install output for shared build directory:\n${yarnOutput}`,
        );
      }
    } catch (error: any) {
      logger.error(
        `Yarn install failed in shared build directory ${this.buildDir}: ${error.message}`,
      );
      if (error.stdout)
        logger.error(`Yarn stdout:\n${error.stdout.toString()}`);
      if (error.stderr)
        logger.error(`Yarn stderr:\n${error.stderr.toString()}`);
      throw new Error(
        `Failed to install dependencies in build directory: ${error.message}`,
      );
    }
  }

  private getResolverNameFromPath(relativePath: string): string {
    const filename = path.basename(relativePath, ".ts");
    let fieldName = filename;
    if (filename.includes(".")) {
      fieldName = filename.split(".")[1];
    } else if (filename.includes("_")) {
      fieldName = filename.split("_")[1];
    }
    return fieldName;
  }

  private async setupBuildConfiguration(): Promise<void> {
    // This configures this.buildDir
    // Try to find the source package.json to extract dependencies
    // Since resolvers are now in templates, we need to look for the actual backend package
    // For CWL: templates are in packages/deploy/templates/cwl/resources/AppSync/resolvers
    // Backend is in packages/cloudwatchlive/backend/package.json

    // Extract app name from baseResolverDir to locate the correct backend package
    const appName = this.getAppName();
    const monorepoRoot = path.join(__dirname, "..", "..", "..");
    const sourcePackageJsonPath = this.backendPackageJsonPath || path.join(
      monorepoRoot,
      "packages",
      appName,
      "backend",
      "package.json",
    );

    let sourceDependencies: Record<string, string> = {};
    let sourceDevDependencies: Record<string, string> = {};

    try {
      // fs-extra is imported as fs at the top of the file
      if (fs.existsSync(sourcePackageJsonPath)) {
        const sourcePkg = await fs.readJson(sourcePackageJsonPath); // fs-extra's readJson
        sourceDependencies = sourcePkg.dependencies || {};
        sourceDevDependencies = sourcePkg.devDependencies || {}; // Read devDependencies for types
        logger.debug(
          `Successfully read dependencies from source package.json: ${sourcePackageJsonPath}`,
        );
      } else {
        logger.warning(
          `Source package.json not found at: ${sourcePackageJsonPath}. Will use default dependencies for temp build.`,
        );
      }
    } catch (error: any) {
      logger.warning(
        `Error reading source package.json at ${sourcePackageJsonPath}: ${error.message}. Proceeding with default dependencies.`,
      );
    }

    const packageJsonDependencies: Record<string, string> = {
      // Start with defaults, then override/extend with source dependencies
      "@aws-appsync/utils": "^1.1.1", // Default, might be overridden
      graphql: "^16.9.0", // Default, might be overridden
      zod: "^3.23.0", // Default, might be overridden
    };

    // Add source dependencies, but filter out local workspace packages
    const localPackages = new Set(["shared", "cwlfrontend", "cwlbackend"]); // Add any other local packages here
    if (sourceDependencies) {
      for (const [pkg, version] of Object.entries(sourceDependencies)) {
        if (!localPackages.has(pkg)) {
          packageJsonDependencies[pkg] = version;
        } else {
          logger.debug(
            `Excluding local package from temp build dependencies: ${pkg}`,
          );
        }
      }
    }
    if (sourceDevDependencies) {
      // Also filter devDependencies
      for (const [pkg, version] of Object.entries(sourceDevDependencies)) {
        if (!localPackages.has(pkg) && !packageJsonDependencies[pkg]) {
          // Avoid overwriting if already in deps
          packageJsonDependencies[pkg] = version;
        } else if (localPackages.has(pkg)) {
          logger.debug(
            `Excluding local package from temp build devDependencies: ${pkg}`,
          );
        }
      }
    }

    // Clean up any undefined/null values that might have resulted from the spread if keys existed with no values
    for (const key in packageJsonDependencies) {
      if (
        packageJsonDependencies[key] === undefined ||
        packageJsonDependencies[key] === null
      ) {
        delete packageJsonDependencies[key];
      }
    }

    const packageJson = {
      name: "appsync-resolvers-build",
      version: "1.0.0",
      type: "module",
      private: true,
      dependencies: packageJsonDependencies,
      devDependencies: {
        // These are for the build process in temp env
        typescript: "5.5.4", // Updated: Aligned with root, for compilation
        "@types/node": "^20.12.0", // Added: For Node.js globals like 'process'
      },
    };

    await fsPromises.writeFile(
      path.join(this.buildDir, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    const tsConfig = {
      compilerOptions: {
        target: "es2020",
        module: "commonjs", // AppSync requires CommonJS, not esnext
        moduleResolution: "node",
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true,
        outDir: "./dist",
        rootDir: ".",
        baseUrl: ".",
        paths: {
          gqlTypes: ["./gqlTypes.ts"],
          // Ensure paths here correctly point to files copied into this.buildDir
        },
      },
      files: [],
      include: [],
      exclude: ["node_modules", "dist"],
    };
    await fsPromises.writeFile(
      path.join(this.buildDir, "tsconfig.json"),
      JSON.stringify(tsConfig, null, 2),
    );
    logger.debug("Created package.json and tsconfig.json in build directory");
  }

  private async compileTypeScript(
    originalResolverSourceCode: string,
    resolverAbsolutePath: string,
  ): Promise<string> {
    const resolverFileName = path.basename(resolverAbsolutePath);
    logger.debug(
      `Starting compilation for: ${resolverFileName} (from ${resolverAbsolutePath}) using shared build directory: ${this.buildDir}`,
    );

    let codeToCompile = originalResolverSourceCode;

    // Check for 'gqlTypes' import and inline enum definitions
    // AppSync doesn't support ES6 imports, so we must inline the runtime values (enums)
    const gqlTypesImportRegex =
      /import\s+\{([^}]*)\}\s+from\s+(['"])(gqlTypes|[^'"]*\/types\/gqlTypes)\2;?\s*\n?/g;

    let gqlTypesMatch;
    const importedGqlTypes = new Set<string>();
    let gqlTypesInlined = false; // Track if we inlined gqlTypes

    // Find all gqlTypes imports and collect what's being imported
    while (
      (gqlTypesMatch = gqlTypesImportRegex.exec(originalResolverSourceCode)) !==
      null
    ) {
      const importedItems = gqlTypesMatch[1]
        .split(",")
        .map((item: string) => item.trim());
      importedItems.forEach((item: string) => {
        // Remove any type-only imports or aliases
        const cleanItem = item
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          .trim();
        if (cleanItem) importedGqlTypes.add(cleanItem);
      });
    }

    if (importedGqlTypes.size > 0) {
      gqlTypesInlined = true;
      logger.debug(
        `Found gqlTypes imports in ${resolverFileName}: ${Array.from(importedGqlTypes).join(", ")}`,
      );

      // Read gqlTypes.ts from the app's frontend or backend generated types
      const appNameForTypes = this.getAppName();
      const candidatePaths = this.gqlTypesPath
        ? [this.gqlTypesPath]
        : [
            path.resolve(
              __dirname,
              `../../../packages/${appNameForTypes}/frontend/src/types/gqlTypes.ts`,
            ),
            path.resolve(
              __dirname,
              `../../../packages/${appNameForTypes}/backend/src/types/gqlTypes.ts`,
            ),
          ];

      let gqlTypesSourcePath: string | undefined = undefined;
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          gqlTypesSourcePath = p;
          break;
        }
      }

      if (!gqlTypesSourcePath) {
        logger.error(
          `gqlTypes.ts not found for app '${appNameForTypes}'. Checked: ${candidatePaths.join(", ")}`,
        );
        throw new Error(
          `gqlTypes.ts not found for app '${appNameForTypes}'. Please generate GraphQL types for this app before deploying.`,
        );
      }

      // Read gqlTypes and inline ALL type definitions to avoid dependency issues
      // Types that reference other types need all dependencies available
      const gqlTypesContent = await fsPromises.readFile(
        gqlTypesSourcePath,
        "utf-8",
      );

      // Remove all export keywords and any imports from the gqlTypes file
      let inlinedContent = "// Inlined ALL types from gqlTypes.ts\n";
      inlinedContent += gqlTypesContent
        .replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, "") // Remove imports
        .replace(/^export\s+/gm, "") // Remove export keywords
        .trim();

      inlinedContent += "\n";

      logger.debug(
        `Inlined entire gqlTypes file for ${resolverFileName} (${importedGqlTypes.size} items imported)`,
      );

      // Replace all gqlTypes imports with the inlined content
      gqlTypesImportRegex.lastIndex = 0; // Reset regex
      codeToCompile = codeToCompile.replace(
        gqlTypesImportRegex,
        inlinedContent,
      );

      // Make sure we only inline once if there are duplicate imports
      codeToCompile = codeToCompile.replace(
        new RegExp(inlinedContent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        (match, offset, string) => {
          return string.indexOf(match) === offset ? match : "";
        },
      );
    } else {
      logger.debug(
        `No import from 'gqlTypes' found in ${resolverFileName}. Compiling as is.`,
      );
    }

    // Remove @aws-appsync/utils imports - they cause deployment failures
    // Even though AWS docs show imports, AppSync seems to have issues with them
    // We'll remove imports and declare util as global instead
    codeToCompile = codeToCompile.replace(
      /import\s*{\s*[^}]*\s*}\s*from\s*["']@aws-appsync\/utils["'];?\s*/g,
      "",
    );
    codeToCompile = codeToCompile.replace(
      /import\s*.*\s*from\s*["']@aws-appsync\/utils["'];?\s*/g,
      "",
    );

    // Add global declarations for AppSync runtime
    const appsyncGlobals = `// AppSync runtime globals (provided by AppSync, declared for TypeScript)
declare const util: any;
type Context<TArguments = any, TSource = any, TStash = any, TResult = any, TReturns = any> = any;
type AppSyncIdentityCognito = any;
type AppSyncIdentityIAM = any;
type AppSyncIdentityOIDC = any;
type AppSyncIdentityLambda = any;

`;
    codeToCompile = appsyncGlobals + codeToCompile;
    logger.debug(
      `Removed @aws-appsync/utils imports and added global type declarations for ${resolverFileName}`,
    );

    // Check for constants imports and inline them
    // AppSync doesn't support ES6 imports, so we must inline the entire file content
    // Note: Constants are separate from gqlTypes, so we always need to inline them
    {
      const constantsImportRegex =
        /import\s+\{([^}]*)\}\s+from\s+['\"][^'"]*\/constants\/([^'"]*)['\"];?\s*\n?/g;
      let constantsMatch;
      const inlinedConstants = new Set<string>(); // Track which constants we've already inlined

      while (
        (constantsMatch = constantsImportRegex.exec(
          originalResolverSourceCode,
        )) !== null
      ) {
        const constantsFile = constantsMatch[2];
        const fullImportStatement = constantsMatch[0];

        if (inlinedConstants.has(constantsFile)) {
          // Just remove the duplicate import
          codeToCompile = codeToCompile.replace(fullImportStatement, "");
          continue;
        }

        logger.debug(
          `Found constants import in ${resolverFileName}: ${fullImportStatement.trim()}`,
        );

        if (!this.constantsDir) {
          logger.error(
            `Constants directory not provided for ${resolverFileName}. Please specify constantsDir in ResolverCompilerOptions.`,
          );
          throw new Error(
            `constantsDir must be specified in ResolverCompilerOptions to locate constants file: ${constantsFile}`,
          );
        }

        const constantsSourcePath = path.join(
          this.constantsDir,
          `${constantsFile}.ts`,
        );

        if (fs.existsSync(constantsSourcePath)) {
          // Read the constants file and inline its contents
          let constantsContent = await fsPromises.readFile(
            constantsSourcePath,
            "utf-8",
          );

          // Remove any export keywords since we're inlining
          constantsContent = constantsContent.replace(/^export\s+/gm, "");

          // Only remove specific type aliases that conflict with gqlTypes enums
          // Currently only AgeRating is defined as an enum in gqlTypes
          constantsContent = constantsContent.replace(
            /^type\s+AgeRating\s*=\s*.*$/gm,
            "// Type removed (AgeRating enum already in gqlTypes)",
          );

          // Replace the import statement with the inlined content
          codeToCompile = codeToCompile.replace(
            fullImportStatement,
            `// Inlined from ${constantsFile}.ts\n${constantsContent}\n`,
          );

          inlinedConstants.add(constantsFile);
          logger.debug(`Inlined ${constantsFile}.ts into ${resolverFileName}.`);
        } else {
          logger.error(
            `Constants file not found at ${constantsSourcePath} for ${resolverFileName}.`,
          );
          throw new Error(`Constants file not found: ${constantsSourcePath}`);
        }
      }
    }

    const tempResolverPath = path.join(this.buildDir, resolverFileName);
    await fsPromises.writeFile(tempResolverPath, codeToCompile);
    logger.debug(
      `Wrote (potentially modified) ${resolverFileName} to ${tempResolverPath}`,
    );

    // Dependencies are installed once in setupBuildDirectory.

    // Use TypeScript compiler directly instead of esbuild to avoid module helpers
    const outfile = path.join(
      this.buildDir,
      "dist",
      resolverFileName.replace(".ts", ".js"),
    );

    try {
      logger.debug(`Compiling ${resolverFileName} with tsc...`);

      // Ensure dist directory exists
      const distDir = path.join(this.buildDir, "dist");
      await fsPromises.mkdir(distDir, { recursive: true });

      // Run TypeScript compiler
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      // AppSync needs ES6 exports - compile directly to dist folder
      // Added --moduleResolution node to resolve @aws-appsync/utils from node_modules
      // Use --skipDefaultLibCheck to avoid tsconfig.json issues
      await execAsync(
        `npx tsc "${tempResolverPath}" --outDir "${distDir}" --target ES2020 --module ES6 --moduleResolution node --removeComments --skipLibCheck --skipDefaultLibCheck`,
        { cwd: this.buildDir },
      );

      logger.debug(`TypeScript compilation completed for ${resolverFileName}`);

      // Post-process the compiled file
      let content = await fsPromises.readFile(outfile, "utf-8");

      logger.debug(
        `Post-processing compiled resolver for AppSync compatibility...`,
      );

      // AppSync expects ES6 exports (export function request) with imports removed
      // The @aws-appsync/utils imports need to be removed since util is provided as a global

      await fsPromises.writeFile(outfile, content, "utf-8");
      logger.debug(`Transformed to AppSync-compatible format`);
      logger.success(`Compilation completed for ${resolverFileName}.`); // Essential log

      const compiledJsPath = outfile;
      if (!compiledJsPath) {
        logger.error(
          `Output path is undefined after compilation for ${resolverFileName}.`,
        );
        throw new Error(
          `Compilation output path is undefined for ${resolverFileName}`,
        );
      }

      try {
        await fsPromises.access(compiledJsPath, fs.constants.F_OK);
      } catch (e) {
        logger.error(
          `Compiled file not found at ${compiledJsPath} after esbuild.`,
        );
        throw new Error(`Compiled JS file not found for ${resolverFileName}`);
      }

      let jsContentWithHeader = await fsPromises.readFile(
        compiledJsPath,
        "utf-8",
      );
      jsContentWithHeader = this.addHeaderToJs(
        jsContentWithHeader,
        resolverAbsolutePath,
      );

      logger.debug(`Successfully read compiled JS for ${resolverFileName}`);
      return jsContentWithHeader;
    } catch (error: any) {
      logger.error(
        `TypeScript compilation failed for ${resolverAbsolutePath}: ${error.message}`,
      );
      // Always log stdout/stderr to help debug compilation failures
      if (error.stdout) {
        logger.error(`Compilation stdout:\n${error.stdout.toString()}`);
      }
      if (error.stderr) {
        logger.error(`Compilation stderr:\n${error.stderr.toString()}`);
      }
      // Log contents of tempBuildDir for debugging if in debug mode
      if (this.debugMode) {
        try {
          logger.error(
            `Contents of ${this.buildDir} on failure for ${resolverFileName}:`,
          );
          logger.error(
            execSync("ls -R", {
              cwd: this.buildDir,
              encoding: "utf8",
            }).toString(),
          );
        } catch (lsError: any) {
          logger.error(
            `Could not list contents of ${this.buildDir}: ${lsError.message}`,
          );
        }
      }
      throw error;
    } finally {
      try {
        await fsPromises.rm(tempResolverPath, { recursive: true, force: true });
      } catch (cleanupError: any) {
        logger.warning(
          `Failed to clean up temp resolver file ${tempResolverPath}: ${cleanupError.message}`,
        );
      }
    }
  }

  private async findJavaScriptFileByName(
    jsFileName: string,
  ): Promise<string[]> {
    // This method seems to search globally from '.', which might be too broad.
    // It was also causing issues. If needed, its scope and usage should be clarified.
    // For now, relying on esbuild's output path directly.
    logger.warning(
      `findJavaScriptFileByName is called for ${jsFileName}, but its usage is currently under review.`,
    );
    return [];
    /*
    const findCommand = \`find . -name "${jsFileName}"\`;
    const foundFiles = execSync(findCommand, {
        cwd: this.tempBuildDir, // Search within the specific temp build dir
        stdio: 'pipe',
        encoding: 'utf8'
    }).trim().split('\\n').filter(Boolean);
    return foundFiles.map(file => path.join(this.tempBuildDir, file.trim()));
    */
  }

  private async cleanupBuildDirectory(): Promise<void> {
    if (this.debugMode) {
      this.logger.debug(
        `Debug mode: Preserving main build directory: ${this.buildDir}`,
      );
      return;
    }
    try {
      await fsPromises.rm(this.buildDir, { recursive: true, force: true });
    } catch (error: any) {
      this.logger.error(
        `Failed to remove main build directory ${this.buildDir}: ${error.message}`,
      );
    }
  }

  getResolverS3Location(
    bucketName: string,
    stage: string,
    resolverPath: string,
  ): string {
    const jsPath = resolverPath.replace(".ts", ".js");
    const s3Key = `resolvers/${stage}/${jsPath}`;
    return `s3://${bucketName}/${s3Key}`;
  }

  // createSimplifiedSharedFunctions is not directly used by the core compilation logic shown
  // but kept for completeness if it's called elsewhere.
  private async createSimplifiedSharedFunctions(): Promise<void> {
    const sharedFunctionsDir = path.join(this.buildDir, "shared/functions"); // Operates on buildDir
    await fsPromises.mkdir(sharedFunctionsDir, { recursive: true });
    // ... content of simplified functions ...
    // Example:
    const userGroupContent = `
import type { AppSyncIdentityCognito } from "@aws-appsync/utils";
// Adjust path to gqlTypes if it's at root of buildDir
import { ClientType } from "gqlTypes"; 

export const isSuperAdminUserGroup = (identity: AppSyncIdentityCognito): boolean => {
  return (identity.groups || []).includes(ClientType.Admin);
};
`;
    await fsPromises.writeFile(
      path.join(sharedFunctionsDir, "userGroup.ts"),
      userGroupContent,
    );
    this.logger.info("Created simplified shared functions in build directory.");
    // ... other simplified files ...
  }
}

// Export the class if it's a module
export { ResolverCompiler };
