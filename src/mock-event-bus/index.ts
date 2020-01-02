import { EventBus, Event, EventPublisher, EventSubscriber } from '../event-bus';
export type AnyEvent = Event;
export type AnyHandler = (ev: AnyEvent) => Promise<boolean>;

/**
 * MockEventBus is defined here for use during testing across services that use
 * the event-bus. Examples are: audit and continuum-auth.
 */

export class MockEventBus extends EventBus implements EventPublisher, EventSubscriber {
    private queues: Map<string, AnyHandler> = new Map();

    public async publish(event: Event): Promise<void> {
        if (!this.eventsToHandle.includes(event.eventType)) {
            return;
        }
        const fn = this.queues.get(`${event.eventType}`);

        if (fn !== undefined && typeof fn === 'function') {
            fn(event);
        } else {
            throw new Error(`handler for ${event.eventType} is undefined or not a function`);
        }
    }

    public async subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): Promise<void> {
        if (!this.serviceName) {
            throw new Error(`Service name not set!`);
        }
        if (!eventType) {
            throw new Error(`EventType name not set!`);
        }
        const key = `${eventType}`;
        if (this.queues.has(key)) {
            throw new Error(`Handler already set for '${eventType}' set!`);
        }
        this.queues.set(key, handler);
    }

    destroy(): Promise<void> {
        return Promise.resolve();
    }
}
