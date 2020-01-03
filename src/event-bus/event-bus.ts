import { EventType } from './types';

export abstract class EventBus {
    // register the following:
    // - eventsToHandle - a list of events you will publish/subscribe to
    // - serviceName - used when subscribing to generate a unique queue for holding
    // incoming messages of the form: `consumer__${eventType}__${serviceName}`
    constructor(readonly eventsToHandle: EventType[], readonly serviceName: string) {}
    abstract destroy(): Promise<void>;
}
