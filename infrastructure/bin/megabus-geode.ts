#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { PipelineStack } from '../lib/pipeline-stack'

const app = new cdk.App()
new PipelineStack(app, 'megabus-geode-pipeline', {
  env: {
    account: '669431401787',  //megabus devops
    region: 'us-east-1'
  }
})