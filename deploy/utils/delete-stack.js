const {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
  waitUntilStackDeleteComplete,
} = require("@aws-sdk/client-cloudformation");

const cfn = new CloudFormationClient({ region: "ap-southeast-2" });
const stackName = process.argv[2] || "thestoryhub-dev";
const shouldWait = process.argv.includes("--wait");

async function deleteStack() {
  try {
    // Check if stack exists
    try {
      await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
    } catch (error) {
      if (error.name === "ValidationError") {
        console.log(
          `✅ Stack ${stackName} does not exist (already deleted or never created)`,
        );
        process.exit(0);
      }
      throw error;
    }

    console.log(`🗑️  Deleting stack: ${stackName}...`);
    await cfn.send(new DeleteStackCommand({ StackName: stackName }));
    console.log("✅ Stack deletion initiated successfully!");

    if (shouldWait) {
      console.log("⏳ Waiting for stack deletion to complete...");
      await waitUntilStackDeleteComplete(
        { client: cfn, maxWaitTime: 600 }, // 10 minutes max
        { StackName: stackName },
      );
      console.log("✅ Stack deleted successfully!");
    } else {
      console.log("⏳ Stack is being deleted (this may take 5-10 minutes)");
      console.log("\nTo wait for deletion to complete, run:");
      console.log(`  node delete-stack.js ${stackName} --wait`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

deleteStack();
