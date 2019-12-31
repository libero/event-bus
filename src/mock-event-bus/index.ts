import { EventBus, Event, EventPublisher, EventSubscriber } from '../event-bus';
export type AnyEvent = Event;
export type AnyHandler = (ev: AnyEvent) => Promise<boolean>;

/**
 * MockEventBus is defined here for use during testing across services that use
 * the event-bus. Examples are: audit and continuum-auth.
 */

export class MockEventBus extends EventBus implements EventPublisher, EventSubscriber {
    private queues: Map<string, AnyHandler> = new Map();

    public async publish(event: Event): Promise<boolean> {
        const fn = this.queues.get(`${event.eventType}`);
        if (fn) {
            if (this.eventsToHandle.includes(event.eventType)) {
                return fn(event);
            }
        }
        return Promise.resolve(false);
    }

    public async subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): Promise<void> {
        if (!this.serviceName) {
            Promise.reject(`Service name not set!`);
        }
        this.queues.set(`${eventType}`, handler);
    }

    destroy(): Promise<void> {
        return Promise.resolve();
    }
}
