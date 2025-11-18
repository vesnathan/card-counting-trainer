import fs from "fs";
import path from "path";
import { execCommandAsPromise } from "../src/lib/utils/execCommandAsPromise";

// eslint-disable-next-line sonarjs/cognitive-complexity
const buildGql = async () => {
  // Merge package-local schema files into the combined schema used for codegen
  // Use custom merge script that consolidates 'extend type' declarations for AppSync compatibility
  const mergeSchemaScript = path.resolve(
    "../backend/scripts/merge-schema-for-appsync.ts",
  );
  try {
    await execCommandAsPromise(
      `npx ts-node ${mergeSchemaScript}`,
      { captureStdOut: false },
    );
  } catch (err) {
    console.error("Schema merge failed:", err);
    throw err;
  }

  const schemaPath = path.resolve("../backend/combined_schema.graphql");
  const amplifyTypesCmd = `npx amplify codegen types --schema ${schemaPath} --debug`;

  const forceFallback = process.env.FORCE_GQL_CODEGEN === "true";

  let generated = false;
  try {
    if (forceFallback) {
      // Skip amplify attempt and force graphql-codegen fallback
      // eslint-disable-next-line no-console
      console.info(
        "FORCE_GQL_CODEGEN=true — skipping Amplify and forcing graphql-codegen fallback",
      );
      throw new Error("Forced fallback");
    }
    // Try Amplify codegen first. Capture stdout so CI output is cleaner.
    await execCommandAsPromise(amplifyTypesCmd, { captureStdOut: true });
    generated = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("amplify codegen types failed:", err);

    // If environment requests automatic setup, run interactive `amplify codegen add`.
    if (process.env.AMPLIFY_CODEGEN_ADD_AUTO === "true") {
      try {
        // eslint-disable-next-line no-console
        console.info(
          "Running 'amplify codegen add' because AMPLIFY_CODEGEN_ADD_AUTO=true",
        );
        await execCommandAsPromise("npx amplify codegen add");

        // Retry codegen
        await execCommandAsPromise(amplifyTypesCmd, { captureStdOut: true });
        generated = true;
      } catch (addErr) {
        // eslint-disable-next-line no-console
        console.warn("'amplify codegen add' failed:", addErr);
      }
    } else {
      // eslint-disable-next-line no-console
      console.info(
        "amplify codegen not configured; falling back to graphql-codegen",
      );
    }
  }

  if (!generated) {
    // Non-amplify fallback using graphql-codegen (non-interactive)
    try {
      const outDir = path.resolve(__dirname, "../src/types");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const tmpConfigPath = path.resolve(__dirname, "../codegen.temp.yml");
      const yaml = `schema: "${schemaPath}"\ngenerates:\n  ./src/types/gqlTypes.ts:\n    plugins:\n      - typescript\n      - typescript-operations\n    config: {}\n`;
      fs.writeFileSync(tmpConfigPath, yaml, "utf8");

      // eslint-disable-next-line no-console
      console.info(
        "Running graphql-codegen fallback to generate src/types/gqlTypes.ts",
      );
      await execCommandAsPromise(
        `yarn graphql-codegen --config ${tmpConfigPath}`,
      );
      try {
        fs.unlinkSync(tmpConfigPath);
      } catch {
        /* ignore */
      }
    } catch (fallbackErr) {
      // eslint-disable-next-line no-console
      console.warn("graphql-codegen fallback failed:", fallbackErr);
    }
  }
};

buildGql();
