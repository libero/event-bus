// Abstract Message Queue - types and interfaces

export interface Event<T extends object> {
    eventType: string;
    // Should this be readonly? How would we set this? Constructor, builder? Currently the publisher sets this externally, we should probably set this internally as a uuid
    id: string; // Generated when the event is emitted
    created: Date;
    payload: T; // The actual data
    //Should version & context be removed from our own implimentation as we're not using them?
    version?: number; // Version of the payload
    context?: unknown; // context about the event itself, including the actor
    // that triggered the transmission of the event;
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
}
// This isn't generic enough
export interface EventConfig {
    url: string;
}
