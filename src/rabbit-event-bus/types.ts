import { Event } from '../event-bus';

export type ConnectedState = 'CONNECTED' | 'NOT_CONNECTED';

export interface StateChange {
    newState: ConnectedState;
    message?: string; // Make this some type
}

export interface Message<T> {
    event: T;
    meta: {
        attempts: number;
        retries: number;
        failures: number;
    };
}

export interface Subscription {
    eventType: string;
    handler: (ev: Event) => Promise<boolean>;
}
