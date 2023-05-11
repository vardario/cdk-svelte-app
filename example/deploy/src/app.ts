#!/usr/bin/env node
import 'source-map-support/register.js';
import * as cdk from "aws-cdk-lib";
import { FrontendStack } from "./frontend-stack.js";

const app = new cdk.App();
new FrontendStack(app, "DeployStack", {});
