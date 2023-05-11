import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import path from "node:path";
import { SvelteApp } from "@vardario/cdk-svelte-app";
import { fileURLToPath } from "node:url";

export class FrontendStack extends cdk.Stack {
  public svelteApp: SvelteApp;
  public readonly appUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    this.svelteApp = new SvelteApp(this, "FrontendSvelteApp", {
      svelteAppPath: path.resolve(__dirname, "../../svelte-app"),
    });

    this.appUrl = new cdk.CfnOutput(this, "FrontendAppUrl", {
      value: this.svelteApp.appUrl,
    });
  }
}
