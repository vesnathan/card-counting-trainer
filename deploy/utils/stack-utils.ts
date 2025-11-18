import { StackType } from "../types";

/**
 * Map internal StackType to a short appName used in CloudFormation export names.
 * Keep mappings explicit so future clones can add entries.
 */
export function getAppNameForStackType(stackType: StackType): string {
  switch (stackType) {
    case StackType.AwsExample:
      return "awse";
    case StackType.CWL:
      return "cwl";
    case StackType.WAF:
      return "waf";
    case StackType.TheStoryHub:
      return "thestoryhub";
    case StackType.CardCountingTrainer:
      return "cardcountingtrainer";
    case StackType.LawnOrder:
      return "lawnorder";
    case StackType.AppBuilderStudio:
      return "appbuilderstudio";
    case StackType.Shared:
      return "shared";
    default:
      throw new Error(`Unknown StackType: ${stackType}`);
  }
}
