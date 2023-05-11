import { Construct } from "constructs";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as path from "path";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3d from "aws-cdk-lib/aws-s3-deployment";
import * as cdk from "aws-cdk-lib";
import fs from "fs";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwInt from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {
  LAMBDA_ESBUILD_EXTERNAL_AWS_SDK,
  LAMBDA_ESBUILD_TARGET,
  LAMBDA_RUNTIME,
} from "./stack-utils.js";
import { fileURLToPath } from "url";

export interface SvelteAppDomain {
  /**
   * Fully qualified domain name under which the NextJS  will be available.
   */
  name: string;

  /**
   * Aliases under which the app is also available.
   * The given certificate has to support the additional aliases as well.
   */
  aliases?: string[];

  /**
   * ARN to a certificate which will be used for the underlying CloudFront distribution.
   *
   * Remarks
   *  1. Certificate has to be deployed in us-east-1
   *  2. Certificate has to be compatible with the given @see domainName .
   */
  domainCertificateArn: string;

  /**
   * Reference to a hosted zone compatible with the given @see domainName .
   */
  hostedZone: r53.IHostedZone;
}

export interface SvelteAppProps {
  svelteAppPath: string;

  /**
   * When defined, a custom domain will be attached to the
   * underlying CloudFront distribution.
   * @see SvelteAppDomain for more details.
   */
  domain?: SvelteAppDomain;

  /**
   * TODO:
   */
  provisionedConcurrentExecutions?: number;

  /**
   * TODO:
   */
  allowedCacheHeaders?: string[];

  /**
   *
   */
  readonly svelteServerEnvironment?: Record<string, string>;
}

export class SvelteApp extends Construct {
  private readonly stackProps: SvelteAppProps;

  //   public readonly appUrl: string;
  //   public readonly cloudFrontUrl: string;

  constructor(scope: Construct, id: string, stackProps: SvelteAppProps) {
    super(scope, id);
    this.stackProps = stackProps;

    const svelteOutput = path.resolve(
      stackProps.svelteAppPath,
      ".svelte-kit/output"
    );

    if (!fs.existsSync(svelteOutput)) {
      throw new Error(
        "Svelte output folder not found, did you forgot to build ?"
      );
    }

    const serverPath = path.resolve(svelteOutput, "server");
    const clientPath = path.resolve(svelteOutput, "client");

    const staticAssetsBucket = this.createStaticAssetsBucket(
      clientPath,
      (stackProps.domain && stackProps.domain.name) || undefined
    );

    this.createSvelteServer(serverPath);
  }

  private createStaticAssetsBucket(clientPath: string, bucketName?: string) {
    const staticAssetsBucket = new s3.Bucket(this, `SvelteAppStaticAssets`, {
      bucketName: bucketName,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new s3d.BucketDeployment(this, "SvelteStaticAssetsDeployment", {
      destinationBucket: staticAssetsBucket,
      sources: [s3d.Source.asset(clientPath)],
      prune: false,
      cacheControl: [
        s3d.CacheControl.fromString("public, max-age=315360000, immutable"),
      ],
    });

    return staticAssetsBucket;
  }

  private createSvelteServer(serverPath: string) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const serverLambda = new lambdaNode.NodejsFunction(
      this,
      "SvelteServerLambda",
      {
        currentVersionOptions: this.stackProps.provisionedConcurrentExecutions
          ? {
              provisionedConcurrentExecutions:
                this.stackProps.provisionedConcurrentExecutions,
            }
          : undefined,
        runtime: LAMBDA_RUNTIME,
        timeout: cdk.Duration.seconds(29),
        memorySize: 512,
        entry: path.resolve(__dirname, "svelte-server-handler.js"),
        environment: this.stackProps.svelteServerEnvironment,
        bundling: {
          minify: false,
          target: LAMBDA_ESBUILD_TARGET,
          externalModules: [
            LAMBDA_ESBUILD_EXTERNAL_AWS_SDK,
            "./server.js",
            "./server/manifest.js",
          ],
        },
      }
    );

    const api = new apigw.HttpApi(this, "SvelteApiGateway");

    const serverLambdaIntegration = new apigwInt.HttpLambdaIntegration(
      "SvelteServerLambdaIntegration",
      serverLambda
    );

    api.addRoutes({
      path: "/{proxy+}",
      methods: [apigw.HttpMethod.GET],
      integration: serverLambdaIntegration,
    });
  }
}
