import { v4 as uuid } from 'uuid';
import { EventType } from './types';

/**
 * Event - Used in this abstract form throughout this library.
 * It is abstract so you cannot create an instance of it - derived Event types
 * and their associated Payload types are the responsibility of the caller.
 */
export abstract class Event {
    readonly id: string;
    readonly created: Date;

    constructor(readonly eventType: EventType, readonly payload: object) {
        this.id = eventType.toString() + '_' + uuid();
        this.created = new Date();
    }
}
