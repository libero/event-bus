import { Event, Payload } from './types';
import uuid = require('uuid');

export const eventFactory = (eventType: string, payload: Payload): Event => {
    if (!(payload instanceof Payload)) {
        throw new TypeError('argument payload is not of type Payload!');
    }
    return {
        eventType,
        id: uuid.v4(),
        created: new Date(),
        payload,
    };
};

export const eventAbstractFactory = (typeName: string, payloadClass, p: object): Event => {
    if (payloadClass.name !== p.constructor.name) {
        throw new TypeError(`expected payload of type ${payloadClass.name} got ${p.constructor.name}`);
    }
    const event = eventFactory(typeName, p);
    return event;
};
