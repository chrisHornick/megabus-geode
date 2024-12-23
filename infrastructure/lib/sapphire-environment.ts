import { StackProps, Stage } from "aws-cdk-lib"
import { Construct } from "constructs"
import { DistributedCacheStack } from "./distributed-cache-stack"
import { ProfileSpecificProps } from "./env-configuration"

export interface SapphireProps extends StackProps {
    environmentName: string,
    profile: ProfileSpecificProps,
    technicalSupportNotificationEmail: string,
    publicVisibilityTag: string
}

export class DistributedCacheStage extends Stage {
    constructor(scope: Construct, props: SapphireProps) {
        super(scope, props.environmentName, props)

        new DistributedCacheStack(this, {
            id: 'sapphire-cache-v2', 
            environmentName: props.environmentName, 
            stackProps: props,
            profile: props.profile.cache,
        })
    }
}