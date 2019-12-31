import { EventType, Event } from './types';

const expectedEventProperties = {
    eventType: true,
    id: true,
    created: true,
    payload: true,
    version: false,
    context: false,
};

function createValidationFunction<T>(properties: Record<keyof T, boolean>): Function {
    return function<TActual extends T>(value: TActual): T {
        const result = {} as T;
        const foundKeys: string[] = [];
        for (const property of Object.keys(properties) as Array<keyof T>) {
            if (properties[property]) {
                if (value[property] === undefined) {
                    throw new Error(`undefined property '${property}'`);
                }
                result[property] = value[property];
                foundKeys.push(property.toString());
            } else {
                if (value[property] !== undefined) {
                    throw new Error(`not expecting property '${property}'`);
                }
            }
        }
        const valueKeys = Object.keys(value);
        const difference = valueKeys.filter(x => !foundKeys.includes(x));
        if (difference.length) {
            throw new Error(`extra properties '${JSON.stringify(difference)}'`);
        }
        return result;
    };
}

describe('Event Bus Types', () => {
    it('type EventType is string', () => {
        const et: EventType = 'this is a string';
        expect(typeof et).toBe('string');
    });

    it('interface Event contains expected members', () => {
        class ExpectedToBeAnEvent {
            id = '234';
            created: Date = new Date();
            payload: {} = {};
            eventType = 'type';
        }
        const isValidEvent = createValidationFunction<Event<{}>>(expectedEventProperties);
        const ee = new ExpectedToBeAnEvent();
        expect(() => isValidEvent(ee)).not.toThrow();
    });
});
