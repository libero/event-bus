import { Event } from '../event-bus';
import { Message } from './types';

export class EventUtils {
    // Maybe merge this class with AMQPConnector
    public static eventTypeToExchange(eventType: string): string {
        return `event__${eventType}`;
    }

    public static eventTypeToQueue(eventType: string, serviceName: string): string {
        return `consumer__${eventType}__${serviceName}`;
    }

    public static eventToMessage<T extends object>(event: Event<T>): Message<Event<T>> {
        // Wrap the event in some internal transport layer format, in effect transforming the
        // event into a message
        return {
            event,
            meta: {
                attempts: 0, // increments each process
                retries: 10, // total retries
                failures: 0, // increments each failure
            },
        };
    }
}
