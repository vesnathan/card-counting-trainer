import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { StackType } from "./types";

/**
 * Project configuration for deployment
 * This defines project-specific settings like bucket names and dependencies
 */
export interface ProjectConfig {
  // The StackType enum value
  stackType: StackType;

  // Display name for menus
  displayName: string;

  // Template directory name (e.g., "aws-example", "cwl")
  templateDir: string;

  // Package directory name (e.g., "aws-example", "cloudwatchlive")
  packageDir?: string;

  // Dependencies (other StackTypes this project depends on)
  dependsOn: StackType[];

  // Custom bucket naming patterns
  buckets: {
    // Template bucket name pattern (use {stage} placeholder)
    templates?: string;

    // Frontend/user files bucket name pattern (use {stage} placeholder)
    frontend?: string;

    // Additional custom buckets (use {stage} and {region} placeholders)
    additional?: string[];
  };

  // Region override (e.g., WAF is always us-east-1)
  region?: string;

  // Whether this project has a frontend that needs building
  hasFrontend?: boolean;

  // Whether this project has Lambda functions
  hasLambdas?: boolean;

  // Whether this project has AppSync resolvers
  hasResolvers?: boolean;

  // Whether this project requires admin user creation in Cognito
  requiresAdminUser?: boolean;
}

/**
 * Central project configuration
 * Add new projects here when bootstrapping
 */
export const PROJECT_CONFIGS: Record<StackType, ProjectConfig> = {
  [StackType.WAF]: {
    stackType: StackType.WAF,
    displayName: "WAF",
    templateDir: "waf",
    dependsOn: [],
    buckets: {
      templates: "nlmonorepo-waf-templates-{stage}",
      additional: [
        "nlmonorepo-waf-logs-{stage}",
        "nlmonorepo-{stage}-cfn-templates-us-east-1",
      ],
    },
    region: "us-east-1",
    hasFrontend: false,
    hasLambdas: false,
    hasResolvers: false,
  },

  [StackType.Shared]: {
    stackType: StackType.Shared,
    displayName: "Shared Resources",
    templateDir: "shared",
    dependsOn: [StackType.WAF],
    buckets: {
      templates: "nlmonorepo-shared-templates-{stage}",
      additional: [
        "nlmonorepo-shared-{stage}-templates", // Old naming pattern
        "nlmonorepo-{stage}-cfn-templates-{region}",
      ],
    },
    hasFrontend: false,
    hasLambdas: false,
    hasResolvers: false,
  },

  [StackType.CWL]: {
    stackType: StackType.CWL,
    displayName: "CloudWatchLive (CWL)",
    templateDir: "cwl",
    packageDir: "cloudwatchlive",
    dependsOn: [StackType.WAF, StackType.Shared],
    buckets: {
      templates: "nlmonorepo-cwl-templates-{stage}",
      frontend: "nlmonorepo-cwl-frontend-{stage}",
      additional: ["nlmonorepo-{stage}-cfn-templates-{region}"],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: true,
    requiresAdminUser: true,
  },
  [StackType.AwsExample]: {
    stackType: StackType.AwsExample,
    displayName: "AWS Example",
    templateDir: "aws-example",
    packageDir: "aws-example",
    dependsOn: [StackType.Shared],
    buckets: {
      templates: "nlmonorepo-awsexample-templates-{stage}",
      frontend: "nlmonorepo-awsexample-frontend-{stage}",
      additional: ["nlmonorepo-{stage}-cfn-templates-{region}"],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: true,
    requiresAdminUser: true,
  },

  [StackType.TheStoryHub]: {
    stackType: StackType.TheStoryHub,
    displayName: "The Story Hub",
    templateDir: "the-story-hub",
    packageDir: "the-story-hub",
    dependsOn: [], // No dependencies - WAF and Shared removed
    buckets: {
      templates: "nlmonorepo-thestoryhub-templates-{stage}",
      frontend: "nlmonorepo-thestoryhub-frontend-{stage}",
      additional: [
        "nlmonorepo-{stage}-cfn-templates-{region}",
        "nlmonorepo-thestoryhub-userfiles-{stage}",
      ],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: true,
  },

  [StackType.CardCountingTrainer]: {
    stackType: StackType.CardCountingTrainer,
    displayName: "Card Counting Trainer",
    templateDir: "card-counting-trainer",
    packageDir: "card-counting-trainer",
    dependsOn: [],
    buckets: {
      templates: "cardcountingtrainer-templates-{stage}",
      frontend: "cardcountingtrainer-userfiles-{stage}",
      additional: ["cardcountingtrainer-{stage}-cfn-templates-{region}"],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: true,
    requiresAdminUser: true,
  },

  [StackType.LawnOrder]: {
    stackType: StackType.LawnOrder,
    displayName: "Lawn Order",
    templateDir: "lawn-order",
    packageDir: "lawn-order",
    dependsOn: [], // No dependencies - standalone project
    buckets: {
      templates: "nlmonorepo-lawnorder-templates-{stage}",
      frontend: "nlmonorepo-lawnorder-frontend-{stage}",
      additional: [
        "nlmonorepo-{stage}-cfn-templates-{region}",
        "nlmonorepo-lawnorder-uploads-{stage}",
      ],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: false,
    requiresAdminUser: false,
  },

  [StackType.AppBuilderStudio]: {
    stackType: StackType.AppBuilderStudio,
    displayName: "App Builder Studio",
    templateDir: "app-builder-studio",
    packageDir: "app-builder-studio",
    dependsOn: [], // No dependencies - standalone project
    buckets: {
      templates: "nlmonorepo-appbuilderstudio-templates-{stage}",
      frontend: "nlmonorepo-appbuilderstudio-frontend-{stage}",
      additional: [
        "nlmonorepo-{stage}-cfn-templates-{region}",
        "nlmonorepo-appbuilderstudio-uploads-{stage}",
      ],
    },
    hasFrontend: true,
    hasLambdas: true,
    hasResolvers: false,
    requiresAdminUser: false,
  },
};

/**
 * Get project configuration by stack type
 */
export function getProjectConfig(stackType: StackType): ProjectConfig {
  return PROJECT_CONFIGS[stackType];
}

/**
 * Get all bucket names for a project
 */
export function getProjectBuckets(
  stackType: StackType,
  stage: string,
  region: string,
): string[] {
  const config = getProjectConfig(stackType);
  const buckets: string[] = [];

  // Add template bucket
  if (config.buckets.templates) {
    buckets.push(
      config.buckets.templates
        .replace("{stage}", stage)
        .replace("{region}", region),
    );
  }

  // Add frontend bucket
  if (config.buckets.frontend) {
    buckets.push(
      config.buckets.frontend
        .replace("{stage}", stage)
        .replace("{region}", region),
    );
  }

  // Add additional buckets
  if (config.buckets.additional) {
    for (const bucket of config.buckets.additional) {
      buckets.push(
        bucket.replace("{stage}", stage).replace("{region}", region),
      );
    }
  }

  // Remove duplicates
  return Array.from(new Set(buckets));
}

/**
 * Get dependencies for a stack type
 */
export function getProjectDependencies(stackType: StackType): StackType[] {
  return getProjectConfig(stackType).dependsOn;
}

/**
 * Get all dependents of a stack type (stacks that depend on this one)
 */
export function getProjectDependents(stackType: StackType): StackType[] {
  const dependents: StackType[] = [];

  for (const [key, config] of Object.entries(PROJECT_CONFIGS)) {
    if (config.dependsOn.includes(stackType)) {
      dependents.push(config.stackType);
    }
  }

  return dependents;
}

/**
 * Auto-discover projects from templates directory
 * This can be used to validate that all templates have corresponding config
 */
export function discoverTemplateProjects(): string[] {
  const templatesDir = join(__dirname, "templates");

  if (!existsSync(templatesDir)) {
    return [];
  }

  const entries = readdirSync(templatesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Validate that all discovered templates have configuration
 */
export function validateProjectConfigs(): {
  valid: boolean;
  missingConfigs: string[];
  extraConfigs: string[];
} {
  const discoveredProjects = discoverTemplateProjects();
  const configuredProjects = Object.values(PROJECT_CONFIGS).map(
    (c) => c.templateDir,
  );

  const missingConfigs = discoveredProjects.filter(
    (p) => !configuredProjects.includes(p),
  );

  const extraConfigs = configuredProjects.filter(
    (p) => !discoveredProjects.includes(p),
  );

  return {
    valid: missingConfigs.length === 0,
    missingConfigs,
    extraConfigs,
  };
}

/**
 * Get the effective region for a stack type
 */
export function getProjectRegion(
  stackType: StackType,
  defaultRegion: string = "ap-southeast-2",
): string {
  const config = getProjectConfig(stackType);
  return config.region || defaultRegion;
}
