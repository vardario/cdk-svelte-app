import { Construct } from "constructs";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as path from "path";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3d from "aws-cdk-lib/aws-s3-deployment";
import * as cdk from "aws-cdk-lib";
import fs from "fs";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwInt from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cm from "aws-cdk-lib/aws-certificatemanager";
import * as r53t from "aws-cdk-lib/aws-route53-targets";
import { NpmLayerVersion } from "@apimda/npm-layer-version";
import os from "node:os";

import {
  LAMBDA_ARCHITECTURE,
  LAMBDA_ESBUILD_EXTERNAL_AWS_SDK,
  LAMBDA_ESBUILD_TARGET,
  LAMBDA_RUNTIME,
  hashFolder,
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
  public readonly appUrl: string;
  public readonly cloudFrontUrl: string;

  //   public readonly appUrl: string;
  //   public readonly cloudFrontUrl: string;

  constructor(scope: Construct, id: string, stackProps: SvelteAppProps) {
    super(scope, id);
    this.stackProps = stackProps;

    const svelteKitPath = path.resolve(stackProps.svelteAppPath, ".svelte-kit");
    const svelteOutput = path.resolve(svelteKitPath, "output");

    if (!fs.existsSync(svelteOutput)) {
      throw new Error(
        "Svelte output folder not found, did you forgot to build ?"
      );
    }

    const serverPath = path.resolve(svelteOutput, "server");
    const clientPath = path.resolve(svelteOutput, "client");

    const buildId = `${hashFolder(serverPath)}:${hashFolder(clientPath)}`;

    const staticAssetsBucket = this.createStaticAssetsBucket(
      clientPath,
      (stackProps.domain && stackProps.domain.name) || undefined
    );

    const api = this.createSvelteServer(serverPath);
    const cloudfrontDistribution = this.createCloudFrontDistribution(
      staticAssetsBucket,
      api,
      buildId
    );

    this.cloudFrontUrl = `https://${cloudfrontDistribution.domainName}`;
    this.appUrl =
      (this.stackProps.domain && `https://${this.stackProps.domain.name}`) ||
      this.cloudFrontUrl;
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

    const svelteKitLayer = new NpmLayerVersion(this, "SvelteKitLambdaLayer", {
      layerPath: path.resolve(__dirname, "../layers/svelte-kit-layer"),
      layerVersionProps: {
        compatibleArchitectures: [LAMBDA_ARCHITECTURE],
        compatibleRuntimes: [LAMBDA_RUNTIME],
      },
    });

    const packageJson = JSON.parse(
      fs
        .readFileSync(
          path.resolve(this.stackProps.svelteAppPath, "package.json")
        )
        .toString("utf-8")
    );

    const appDependencies = Object.keys(packageJson.dependencies || {});

    const svelteAppDepsDir = fs.mkdtempSync(
      path.resolve(os.tmpdir(), "svelte-app")
    );

    fs.mkdirSync(path.resolve(svelteAppDepsDir, "node_modules"));

    fs.cpSync(
      path.resolve(this.stackProps.svelteAppPath, "node_modules"),
      path.resolve(svelteAppDepsDir, "node_modules"),
      { recursive: true, dereference: true }
    );

    const appLayer = new lambda.LayerVersion(this, "SvelteKitAppLayer", {
      code: lambda.Code.fromAsset(svelteAppDepsDir),
    });

    const layers = [svelteKitLayer.layerVersion, appLayer];
    const packagedDependencies = [
      ...svelteKitLayer.packagedDependencies,
      ...appDependencies,
    ];

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
        architecture: LAMBDA_ARCHITECTURE,
        timeout: cdk.Duration.seconds(29),
        memorySize: 512,
        entry: path.resolve(__dirname, "svelte-server-handler.js"),
        environment: this.stackProps.svelteServerEnvironment,
        layers,
        bundling: {
          format: lambdaNode.OutputFormat.ESM,
          minify: false,
          target: LAMBDA_ESBUILD_TARGET,
          externalModules: [
            LAMBDA_ESBUILD_EXTERNAL_AWS_SDK,
            "./server/index.js",
            "./server/manifest-full.js",
            ...packagedDependencies,
          ],
          commandHooks: {
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [
                `echo "{\\"type\\": \\"module\\"}" > ${outputDir}/package.json`,
                `cp -r ${serverPath} ${outputDir}/server`,
              ];
            },
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeInstall(inputDir: string, outputDir: string): string[] {
              return [];
            },
          },
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

    return api;
  }

  private createCloudFrontDistribution(
    staticAssetsBucket: s3.Bucket,
    api: apigw.HttpApi,
    buildId: string
  ) {
    const staticOrigin = new cfo.S3Origin(staticAssetsBucket);

    const apiDomain = `${api.apiId}.execute-api.${
      cdk.Stack.of(this).region
    }.amazonaws.com`;

    const svelteServerOrigin = new cfo.HttpOrigin(`${apiDomain}`, {
      protocolPolicy: cf.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const certificate =
      this.stackProps.domain &&
      cm.Certificate.fromCertificateArn(
        this,
        "SvelteAppCertificate",
        this.stackProps.domain.domainCertificateArn
      );

    const domainNames = this.stackProps.domain
      ? [this.stackProps.domain.name, ...(this.stackProps.domain.aliases || [])]
      : undefined;

    const svelteServerCachePolicy = new cf.CachePolicy(
      this,
      "SvelteServerCachePolicy",
      {
        comment: "SvelteKit Server optimized",
        queryStringBehavior: cf.CacheQueryStringBehavior.all(),
        cookieBehavior: cf.CacheCookieBehavior.all(),
        headerBehavior: cf.CacheHeaderBehavior.allowList(
          "Accept-Language",
          ...(this.stackProps.allowedCacheHeaders || [])
        ),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        defaultTtl: cdk.Duration.days(365),
      }
    );

    const cloudfrontDistribution = new cf.Distribution(
      this,
      "SvelteCloudfrontDistribution",
      {
        domainNames,
        certificate,
        priceClass: cf.PriceClass.PRICE_CLASS_100,
        httpVersion: cf.HttpVersion.HTTP2,
        minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultBehavior: {
          origin: svelteServerOrigin,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: svelteServerCachePolicy,
        },
        additionalBehaviors: {
          "/_app/*": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          "/favicon.ico": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          "/favicon.png": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          "/logo192.png": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          "/manifest.json": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          "/robot.txt": {
            origin: staticOrigin,
            cachePolicy: cf.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
        },
      }
    );

    new s3d.BucketDeployment(this, "SvelteInvalidationDeployment", {
      destinationBucket: staticAssetsBucket,
      destinationKeyPrefix: "/",
      sources: [s3d.Source.data("BUILD_ID", buildId)],
      prune: false,
      distribution: cloudfrontDistribution,
      distributionPaths: ["/*"],
    });

    this.stackProps.domain &&
      new r53.ARecord(this, `${this.stackProps.domain.name}_Alias}`, {
        recordName: this.stackProps.domain.name,
        target: r53.RecordTarget.fromAlias(
          new r53t.CloudFrontTarget(cloudfrontDistribution)
        ),
        zone: this.stackProps.domain.hostedZone,
      });

    return cloudfrontDistribution;
  }
}
