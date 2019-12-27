// Abstract Message Queue - types and interfaces

/**
 * TODO: Once agreed, add these to DefinitelyTyped so they can be shared.
 */

export interface Event<T extends object> {
    readonly eventType: string;
    readonly id: string; // Generated when the event is emitted
    readonly created: Date;
    readonly payload: T; // The actual data the event is carrying.
    // version:  has been removed - so we can remain weakly typed
    readonly source?: unknown; // meta data about the event source / origin.
}

export interface EventPublisher {
    // Promise<boolean> should this become void | exception? we only need to know if something went wrong
    publish<T extends object>(event: Event<T>): Promise<boolean>;
}

export interface EventSubscriber {
    // handler: returns whether or not we should ack the message
    subscribe<T extends object>(eventType: string, handler: (event: Event<T>) => Promise<boolean>): void;
}

// Interface needed to be fulfilled in order to be used as an EventBus
export interface EventBus extends EventPublisher, EventSubscriber {
    // This needs to be documented better / commented better. What are eventDefinitions? how is a serviceName going to be used?
    init(eventDefinitions: string[], serviceName: string): Promise<this>;

    destroy(): Promise<void>;
}
// This isn't generic enough
export interface EventConfig {
    url: string;
}
