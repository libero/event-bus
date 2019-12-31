import { EventType, Event, EventPublisher, EventSubscriber, EventConfig } from './types';

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
        const expectedEventProperties = {
            eventType: true,
            id: true,
            created: true,
            payload: true,
            version: false,
            context: false,
        };

        class ExpectedToBeAnEvent {
            id = '234';
            created: Date = new Date();
            payload: {} = {};
            eventType = 'type';
        }
        const isValidEvent = createValidationFunction<Event<{}>>(expectedEventProperties);
        const ee = new ExpectedToBeAnEvent();
        expect(() => isValidEvent(ee)).not.toThrow();
        expect(() => ee as Event<{}>).not.toThrow();
    });

    it('interface EventPublisher contains expected members', () => {
        const expectedEventPublisherProperties = {
            publish: true,
        };

        class ExpectedToBeAnEventPublisher {
            publish<T extends object>(event: Event<T>): Promise<boolean> {
                return Promise.resolve(event !== null);
            }
        }
        const isValidEventPublisher = createValidationFunction<EventPublisher>(expectedEventPublisherProperties);
        const ep = new ExpectedToBeAnEventPublisher();
        expect(() => isValidEventPublisher(ep)).not.toThrow();
        expect(() => ep as EventPublisher).not.toThrow();
    });

    it('interface EventSubscriber contains expected members', () => {
        const expectedEventSubscriberProperties = {
            subscribe: true,
        };

        class ExpectedToBeAnEventSubscriber {
            subscribe<T extends object>(eventType: string, handler: (event: Event<T>) => Promise<boolean>): void {
                Promise.resolve(eventType !== '' && handler !== null);
            }
        }
        const isValidEventSubscriber = createValidationFunction<EventSubscriber>(expectedEventSubscriberProperties);
        const es = new ExpectedToBeAnEventSubscriber();
        expect(() => isValidEventSubscriber(es)).not.toThrow();
        expect(() => es as EventSubscriber).not.toThrow();
    });

    it('interface EventConfig contains expected members', () => {
        const expectedEventConfigProperties = {
            url: true,
        };

        class ExpectedToBeAnEventConfig {
            url = 'here';
        }
        const isValidEventConfig = createValidationFunction<EventConfig>(expectedEventConfigProperties);
        const ep = new ExpectedToBeAnEventConfig();
        expect(() => isValidEventConfig(ep)).not.toThrow();
        expect(() => ep as EventConfig).not.toThrow();
    });
});
