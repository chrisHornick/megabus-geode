import * as cdk from 'aws-cdk-lib'

import {Capture, Match, Template} from 'aws-cdk-lib/assertions'

import { DistributedCacheStack } from '../lib/distributed-cache-stack'

import { describe, test, expect, beforeAll} from '@jest/globals'

function findRef(template: cdk.assertions.Template, type: string, props: any): String {
    return Object.keys(template.findResources(type, Match.objectLike({
        Properties: props
    })))[0]
}

const ecsClusterProperties = {
    ClusterName: 'testenv-teststack-geode',
}

describe('The distributed-cache template', () => {
    var template: Template
    var clusterRef: String
    var targetGroups: {
        [key: string]: {
            [key: string]: any
        }
    }
    beforeAll(() => {
        const props: any = {
            id: 'teststack',
            environmentName: 'testenv',
            stackProps: { env: { region: 'us-east-1', account: 'unittest' } },
            profile: {
                locator: {
                    cpu: 1024,
                    memory: 1024,
                    instances: 3,
                }
            }
        }
        const app = new cdk.App()
        const stack = new DistributedCacheStack(app, props)
        template = Template.fromStack(stack)
        clusterRef = findRef(template, 'AWS::ECS::Cluster', ecsClusterProperties)
        targetGroups = template.findResources('AWS::ElasticLoadBalancingV2::TargetGroup')
    })

    describe('Shared', () => {
        test('it creates an ECS Cluster', () => {
            template.hasResourceProperties('AWS::ECS::Cluster', ecsClusterProperties)
        })
    })

    describe('pulse', () => {
        const taskDefinitionProperties = {
            ContainerDefinitions: Match.arrayEquals([
                Match.objectLike({
                    Name: 'pulse',
                }),
            ]),
        }

        var targetGroupRefCapture: Capture
        var taskDefinitionRef: String
        var albRefCapture: Capture
        beforeAll(() => {
            taskDefinitionRef = findRef(template, 'AWS::ECS::TaskDefinition', taskDefinitionProperties)
            targetGroupRefCapture = new Capture()
            albRefCapture = new Capture()
        })

        test('it creates a task definition', () => {
            template.hasResourceProperties('AWS::ECS::TaskDefinition', taskDefinitionProperties)
        })

        test('it creates an ECS service', () => {
            template.hasResourceProperties('AWS::ECS::Service', {
                Cluster: Match.objectEquals({
                    Ref: clusterRef,
                }),
                TaskDefinition: Match.objectEquals({
                    Ref: taskDefinitionRef,
                }),
                NetworkConfiguration: Match.objectLike({
                    AwsvpcConfiguration: Match.objectLike({
                        AssignPublicIp: 'DISABLED'
                    }),
                }),
                LoadBalancers: Match.arrayEquals([
                    Match.objectLike({
                        ContainerName: 'pulse',
                        TargetGroupArn: Match.objectEquals({
                            Ref: targetGroupRefCapture,
                        }),
                    }),
                ]),
            })
        })

        test('it creates a LB target group for the service', () => {
            expect(Object.keys(targetGroups)).toContain(targetGroupRefCapture.asString())
        })

        test('it creates a listener that forwards to the target group', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
                DefaultActions: Match.arrayEquals([
                    Match.objectLike({
                        TargetGroupArn: Match.objectEquals({
                            Ref: targetGroupRefCapture.asString(),
                        }),
                    }),
                ]),
                LoadBalancerArn: Match.objectEquals({
                    Ref: albRefCapture,
                }),
                Protocol: 'HTTP',
            })
        })

        test('it creates a private A record to the ALB', () => {
            template.hasResourceProperties('AWS::Route53::RecordSet', {
                Name: 'pulse.services.testenv.megabus.internal.',
                Type: 'A',
            })
        })
    })

    describe('locator', () => {
        const taskDefinitionProperties = {
            ContainerDefinitions: Match.arrayEquals([
                Match.objectLike({
                    Name: 'locator',
                }),
            ]),
        }

        var taskDefinitionRef: String
        beforeAll(() => {
            taskDefinitionRef = findRef(template, 'AWS::ECS::TaskDefinition', taskDefinitionProperties)
        })

        test('it creates a task definition', () => {
            template.hasResourceProperties('AWS::ECS::TaskDefinition', {
                ...taskDefinitionProperties,
                Cpu: '1024',
                Memory: '1024',
            })
        })

        test('it creates an ECS service', () => {
            template.hasResourceProperties('AWS::ECS::Service', {
                Cluster: Match.objectEquals({
                    Ref: clusterRef,
                }),
                TaskDefinition: Match.objectEquals({
                    Ref: taskDefinitionRef,
                }),
                DesiredCount: 3,
            })
        })
    })    
})
