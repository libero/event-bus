// Abstract Message Queue - types and interfaces

export type EventType = string;

export class Payload {}

export class Event {
    readonly eventType: EventType;
    readonly id: string; // Generated when the event is emitted
    readonly created: Date;
    // version:  has been removed - so we can remain weakly typed
    // context: has also been removed - if you need information about the origin
    //          source of the event then put it in the payload.

    constructor(readonly payload: Payload) {}
}

export interface EventPublisher {
    // Promise<boolean> should this become void | exception? we only need to know if something went wrong
    publish(event: Event): Promise<boolean>;
}

export interface EventSubscriber {
    // handler: returns whether or not we should ack the message
    subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): void;
}

// This isn't generic enough
export interface EventConfig {
    url: string;
}
