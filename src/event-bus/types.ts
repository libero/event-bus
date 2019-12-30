// Abstract Message Queue - types and interfaces

/**
 * TODO: Once agreed, add these to DefinitelyTyped so they can be shared.
 */

export type EventType = string;

export interface Event<T extends object> {
    readonly eventType: EventType;
    readonly id: string; // Generated when the event is emitted
    readonly created: Date;
    readonly payload: T; // The actual data the event is carrying.
    // version:  has been removed - so we can remain weakly typed
    // context: has also been removed - if you need information about the origin
    //          source of the event then put it in the payload.
}

export interface EventPublisher {
    // Promise<boolean> should this become void | exception? we only need to know if something went wrong
    publish<T extends object>(event: Event<T>): Promise<boolean>;
}

export interface EventSubscriber {
    // handler: returns whether or not we should ack the message
    subscribe<T extends object>(eventType: string, handler: (event: Event<T>) => Promise<boolean>): void;
}

// This isn't generic enough
export interface EventConfig {
    url: string;
}
