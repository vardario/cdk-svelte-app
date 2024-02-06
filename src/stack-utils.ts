import * as lambda from 'aws-cdk-lib/aws-lambda';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'path';

export const LAMBDA_RUNTIME = lambda.Runtime.NODEJS_18_X;
export const LAMBDA_ARCHITECTURE = lambda.Architecture.ARM_64;
export const LAMBDA_ESBUILD_TARGET = 'node18';
export const LAMBDA_ESBUILD_EXTERNAL_AWS_SDK = '@aws-sdk/*';

export function hash(filePath: string, algorithm: string = 'md5'): string {
  if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest('hex');
}

function findInDir(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const fileStat = fs.lstatSync(filePath);

    if (fileStat.isDirectory()) {
      findInDir(filePath, fileList);
    } else fileList.push(filePath);
  });

  return fileList;
}
