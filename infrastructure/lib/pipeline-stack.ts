import { Fn, pipelines, Stack, StackProps } from "aws-cdk-lib"
import { Construct } from "constructs"
import { DistributedCacheStage } from "./sapphire-environment"
import { SLIM, PROD } from "./env-configuration"
import { CodePipelineSource } from "aws-cdk-lib/pipelines"

const DEV_PROPERTIES = {
    env: {
        account: '612587359370',
        region: 'us-east-1'
    },
    environmentName: 'dev',
    profile: SLIM,
    technicalSupportNotificationEmail: '04018fcd.coachnorthamerica.onmicrosoft.com@uk.teams.ms',
    publicVisibilityTag: "Team"
}

const QA_PROPERTIES = {
    env: {
        account: '788013384398',
        region: 'us-east-1'
    },
    environmentName: 'qa',
    profile: SLIM,
    technicalSupportNotificationEmail: 'da77c11f.coachnorthamerica.onmicrosoft.com@uk.teams.ms',
    publicVisibilityTag: "Team"
}

const PROD_PROPERTIES = {
    env: {
        account: '047684648251',
        region: 'us-east-1'
    },
    environmentName: 'prod',
    profile: PROD,
    technicalSupportNotificationEmail: '5edd7136.coachnorthamerica.onmicrosoft.com@uk.teams.ms',
    publicVisibilityTag: "Public"
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)
        const connection = CodePipelineSource.connection('coach-usa/megabus-geode', 'main', {
            connectionArn: Fn.importValue('coachusa-bitbucket-codestar-arn')
        })
        const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
            crossAccountKeys: true,
            pipelineName: 'megabus-geode',
            synth: new pipelines.ShellStep('Synth', {
                input: connection,
            commands: [
                'ls',
                'cd infrastructure',
                'npm ci',
                'npm run build',
                'npm run test',
                'npx cdk synth'
            ],
            primaryOutputDirectory: 'infrastructure/cdk.out'
            })
        })
  
        pipeline.addStage(new DistributedCacheStage(this, DEV_PROPERTIES), {
        })
        pipeline.addStage(new DistributedCacheStage(this, QA_PROPERTIES), {
            pre: [
                new pipelines.ManualApprovalStep('deploy-to-qa', { comment: 'Deploy to qa?' }),
            ]
        })
        pipeline.addStage(new DistributedCacheStage(this, PROD_PROPERTIES), {
            pre: [
                new pipelines.ManualApprovalStep('deploy-to-prod', { comment: 'Deploy to prod?' }),
            ]
        })
    }
}