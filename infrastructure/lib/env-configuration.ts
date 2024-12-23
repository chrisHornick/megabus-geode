export interface ApplicationProfile {
    cpu: number
    memory: number
    instances: number
}

export interface ProfileSpecificCacheProps {
    locator: ApplicationProfile
}
export interface ProfileSpecificProps {
    cache: ProfileSpecificCacheProps
}
export const SLIM: ProfileSpecificProps = {
    cache: {
        locator: {
            cpu: 256,
            memory: 2048,
            instances: 3,
        }
    }
}

export const PROD: ProfileSpecificProps = {
    cache: {
        locator: {
            cpu: 1024,
            memory: 2048,
            instances: 3,
        }
    }
}