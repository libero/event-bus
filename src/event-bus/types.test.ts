import { EventType, EventPublisher, EventSubscriber, EventConfig } from './types';
import { Event } from './event';

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

describe('EventType', () => {
    it('is string', () => {
        const et: EventType = 'this is a string';
        expect(typeof et).toBe('string');
    });
});

describe('EventPublisher', () => {
    it('contains contains only publish', () => {
        const expectedEventPublisherProperties = {
            publish: true,
        };

        class ExpectedToBeAnEventPublisher {
            publish(event: Event): Promise<void> {
                expect(event).toBeTruthy();
                return Promise.resolve();
            }
        }
        const isValidEventPublisher = createValidationFunction<EventPublisher>(expectedEventPublisherProperties);
        const ep = new ExpectedToBeAnEventPublisher();
        expect(() => isValidEventPublisher(ep)).not.toThrow();
        expect(() => ep as EventPublisher).not.toThrow();
    });
});

describe('EventSubscription', () => {
    it('interface EventSubscriber contains expected members', () => {
        const expectedEventSubscriberProperties = {
            subscribe: true,
        };

        class ExpectedToBeAnEventSubscriber {
            subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): void {
                Promise.resolve(eventType !== '' && handler !== null);
            }
        }
        const isValidEventSubscriber = createValidationFunction<EventSubscriber>(expectedEventSubscriberProperties);
        const es = new ExpectedToBeAnEventSubscriber();
        expect(() => isValidEventSubscriber(es)).not.toThrow();
        expect(() => es as EventSubscriber).not.toThrow();
    });
});

describe('EventConfig', () => {
    it('contains only url', () => {
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
