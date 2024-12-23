import * as cdk from 'aws-cdk-lib'
import * as cloudmap from 'aws-cdk-lib/aws-servicediscovery'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

import * as path from "path"
import * as route53 from "aws-cdk-lib/aws-route53"

import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { MegabusStack } from './megabus-stack'
import { ProfileSpecificCacheProps } from './env-configuration'

export class DistributedCacheStack extends MegabusStack {

    public clientSecurityGroup : ec2.ISecurityGroup

    public geodeLocators : string

    constructor(scope: Construct, props: DistributedCacheProps) {
        super(scope, props.id, props.environmentName, props.stackProps)

        // const cluster = new ecs.Cluster(this, "geode-cluster", {
        //     vpc: this.vpc,
        //     clusterName: `${props.environmentName}-${props.id}-geode`,
        //     containerInsights: true
        // })

        // const namespace = new cloudmap.PrivateDnsNamespace(this,
        //     `${props.id}.services.${props.environmentName}.megabus.internal`,
        //     {
        //         name: `${props.id}.services.${props.environmentName}.megabus.internal`,
        //         vpc: this.vpc
        //     }
        // )

        // const locatorServiceName = "locator"
        // const locatorDomainName = `${locatorServiceName}.${namespace.namespaceName}`

        // const locatorService = this.locator(namespace, props, cluster, locatorServiceName, locatorDomainName)

        // this.clientSecurityGroup = new ec2.SecurityGroup(this, `${props.id}-client-sg`, {
        //     vpc: this.vpc,
        //     securityGroupName: `${props.id}-client`,
        //     description: 'Grants access to the distributed cache'
        // })
        // const pulse = this.pulse(props.id, props.environmentName, cluster, locatorDomainName, locatorService)
        
        // this.configureSecurityGroups(locatorService, pulse)

        // this.geodeLocators = `${locatorDomainName}[10334]`
    }

    private locator(namespace: cdk.aws_servicediscovery.PrivateDnsNamespace, props: DistributedCacheProps, 
            cluster: cdk.aws_ecs.Cluster, locatorServiceName: string, locatorDomainName: string) {

        const locatorSecurityGroup = new ec2.SecurityGroup(this, `${props.id}-locator-sg`, {
            vpc: this.vpc,
            description: 'Controls access to the Apache Geode locator nodes',
            allowAllOutbound: true
        })

        const locatorMemoryLimit = props.profile.locator.memory
        const locatorCpu = props.profile.locator.cpu
        const locatorTaskDefinition = new ecs.FargateTaskDefinition(this, 'geode-locator-task-definition', {
            cpu: locatorCpu,
            memoryLimitMiB: locatorMemoryLimit,
        })
        locatorTaskDefinition.addContainer('locator', {
            containerName: 'locator',
            cpu: locatorCpu,
            memoryLimitMiB: locatorMemoryLimit,
            image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../geode/locator")),
            environment: {
                LOCATOR: locatorDomainName
            },
            logging: new ecs.AwsLogDriver({ streamPrefix: `${props.id}-geode-locator` }),
            portMappings: [{ containerPort: 7070 }],
            healthCheck: {
                command: ['CMD-SHELL', 'gfsh status locator --host=127.0.0.1 | grep "is currently online"'],
                startPeriod: cdk.Duration.seconds(120),                
                interval: cdk.Duration.seconds(30),
                timeout:  cdk.Duration.seconds(30),
                retries: 5,
            }
        })
        locatorTaskDefinition.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)

        const locatorService = new ecs.FargateService(this, `${props.id}-geode-locator`, {
            cluster: cluster,
            serviceName: 'locator',
            taskDefinition: locatorTaskDefinition,
            desiredCount: props.profile.locator.instances,
            cloudMapOptions: {
                cloudMapNamespace: namespace,
                name: locatorServiceName,
                dnsRecordType: cloudmap.DnsRecordType.A
            },
            securityGroups: [locatorSecurityGroup]
        })
        return locatorService
    }    

    private pulse(id: string, environmentName: string, cluster: cdk.aws_ecs.Cluster, locatorDomainName: string, locatorService: cdk.aws_ecs.FargateService) {
        const privateZone = route53.PrivateHostedZone.fromLookup(this, `${id}-services-zone`, {
            vpcId: this.vpc.vpcId,
            privateZone: true,
            domainName: `services.${environmentName}.megabus.internal`,
        })
        const pulseSecurityGroup = new ec2.SecurityGroup(this, `${id}-pulse-sg`, {
            vpc: this.vpc,
            description: 'Controls access to the Apache Geode server nodes',
            allowAllOutbound: true
        })

        const pulse = new ecsPatterns.ApplicationLoadBalancedFargateService(this, `${id}-pulse`, {
            cluster,
            desiredCount: 1,
            publicLoadBalancer: false,

            taskImageOptions: {
                image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../geode/pulse")),
                environment: {
                    LOCATOR: locatorDomainName
                },
                logDriver: new ecs.AwsLogDriver({
                    streamPrefix: `${id}-geode-pulse`
                }),
                containerPort: 8080,
                containerName: 'pulse',
            },
            securityGroups: [
                this.clientSecurityGroup
            ],
            domainZone: privateZone,
            domainName: `pulse.${privateZone.zoneName}`
        })
        pulse.taskDefinition.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)
        const albLogsBucket = Bucket.fromBucketName(this, 'geode-pulse-alb-logs', `megabus-alb-logs-${environmentName.toLowerCase()}`)

        pulse.loadBalancer.logAccessLogs(albLogsBucket, 'geode-pulse')
        cdk.Tags.of(pulse.loadBalancer).add("Visibility", "Private")
        pulse.node.addDependency(locatorService)
        pulse.targetGroup.configureHealthCheck({
            healthyHttpCodes: '200-399',
        })
        return pulse
    }    

    private configureSecurityGroups(locatorService: cdk.aws_ecs.FargateService, pulse: cdk.aws_ecs_patterns.ApplicationLoadBalancedFargateService) {
        locatorService.connections.allowFrom(locatorService, ec2.Port.allTraffic())
        locatorService.connections.allowFrom(this.clientSecurityGroup, ec2.Port.allTraffic())
        locatorService.connections.allowFrom(this.remoteAccessSg, ec2.Port.allTraffic())

        this.clientSecurityGroup.connections.allowFrom(locatorService, ec2.Port.allTraffic())
        this.clientSecurityGroup.connections.allowFrom(this.clientSecurityGroup, ec2.Port.allTraffic())

        pulse.loadBalancer.connections.allowFrom(this.remoteAccessSg, ec2.Port.tcp(80))
    }
}

export interface DistributedCacheProps {
    id: string
    
    environmentName: string
    
    stackProps?: cdk.StackProps

    profile: ProfileSpecificCacheProps
}
