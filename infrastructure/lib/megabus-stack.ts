import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

import { Construct } from 'constructs'

export abstract class MegabusStack extends cdk.Stack {
    
    readonly vpc: ec2.IVpc

    readonly remoteAccessSg: ec2.ISecurityGroup

    constructor(scope: Construct, id: string, environmentName: string, props?: cdk.StackProps) {
        super(scope, id, props)
        this.vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcName: `megabus-infrastructure-pipeline/${environmentName}/megabus-infrastructure/vpc` })

        this.remoteAccessSg = ec2.SecurityGroup.fromLookupByName(this, 'remote-access-sg', 'remote-access', this.vpc)
    }
}