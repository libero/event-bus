import { EventBus, Event } from '../event-bus';
import { Option, None, Some } from 'funfix';

export type AnyEvent = Event<object>;
export type AnyHandler = (ev: AnyEvent) => Promise<boolean>;

// TODO: Re-look at all of this file. Not sure where this came from, looks commented differently.
// Can this be moved into testing

/**
 * Mocks out the EventBus for use in tests.
 *
 * @export
 * @class MockEventBus
 * @implements {EventBus}
 */

// Should be InProcessEventBus
export class MockEventBus implements EventBus {
    private queues: Option<Map<string, AnyHandler>> = None;

    // This lint suppression wouldn't be needed if these params were passed into constructor
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async init(_defs: string[], _serviceName: string): Promise<this> {
        this.queues = Some(new Map());
        return this;
    }

    /**
     * Allows the MockEventBus to publish any event of type Event<T>
     *
     * @template T - The payload for the event
     * @param {T} event - Of type Event<T>, where T is the payload
     * @returns {Promise<boolean>}
     * @memberof MockEventBus
     */
    public async publish<T extends object>(event: Event<T>): Promise<boolean> {
        return (
            this.queues
                // Why are we flatMapping this.queues?
                .flatMap(queues => Option.of(queues.get(`${event.eventType}`)))
                .map(fn => {
                    return fn(event);
                })
                .getOrElse(false)
        );
    }

    /**
     * Allows the MockEventBus to subscribe any event of type Event<T>
     *
     * @template T - The payload for the event
     * @param {string} eventType
     * @param {(event: T) => Promise<boolean>} handler  - Function of type (event: Event<T>) => Promise<boolean> where T is the payload
     * @memberof MockEventBus
     */
    public async subscribe<T extends object>(
        eventType: string,
        handler: (event: Event<T>) => Promise<boolean>,
    ): Promise<void> {
        this.queues.get().set(`${eventType}`, handler);
    }
}
