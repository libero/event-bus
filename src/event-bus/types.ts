// Abstract Message Queue - types and interfaces
import { Event } from './event';

export type EventType = string;

export interface EventPublisher {
    publish(event: Event): Promise<void>;
}

export interface EventSubscriber {
    // handler: returns whether or not the EventBus implementation should ack the message
    subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): void;
}

// This isn't generic enough
export interface EventConfig {
    url: string;
}
