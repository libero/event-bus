import { Event } from './types';
import uuid = require('uuid');

export const eventFactory = <P extends object>(eventType: string, payload: P): Event<P> => {
    return {
        eventType,
        id: uuid.v4(),
        created: new Date(),
        payload,
    };
};
