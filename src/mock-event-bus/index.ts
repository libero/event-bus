import { EventBus, Event, EventType } from '../event-bus';
export type AnyEvent = Event<object>;
export type AnyHandler = (ev: AnyEvent) => Promise<boolean>;

/**
 * MockEventBus is defined here for use during testing across services that use
 * the event-bus. Examples are: audit and continuum-auth.
 */

export class MockEventBus implements EventBus {
    private queues: Map<string, AnyHandler> = new Map();
    private eventsToHandle: EventType[];
    private serviceName: string;

    public async register(eventsToHandle: EventType[], serviceName: string): Promise<this> {
        this.eventsToHandle = eventsToHandle;
        this.serviceName = serviceName;
        return this;
    }

    public async publish<T extends object>(event: Event<T>): Promise<boolean> {
        const fn = this.queues.get(`${event.eventType}`);
        if (fn) {
            if (this.eventsToHandle.includes(event.eventType)) {
                return fn(event);
            }
        }
        return Promise.resolve(false);
    }

    public async subscribe<T extends object>(
        eventType: string,
        handler: (event: Event<T>) => Promise<boolean>,
    ): Promise<void> {
        if (!this.serviceName) {
            Promise.reject(`Service name not set!`);
        }
        this.queues.set(`${eventType}`, handler);
    }

    public async destroy(): Promise<void> {
        return Promise.resolve();
    }
}
