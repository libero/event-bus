import { MockEventBus } from './index';
import { Event, EventType } from '../event-bus';

class TestEvent extends Event {
    static eventName: EventType = 'libero:mock:test';
    constructor(payload: object) {
        super(TestEvent.eventName, payload);
    }
}
const mockHandler = jest.fn(
    (): Promise<boolean> => {
        return Promise.resolve(true);
    },
);

describe('MockEventBus', () => {
    it('can publish to many event types without handlers', () => {
        const mockEventBus = new MockEventBus(['some-event'], 'message-bus-test');
        [...Array(100).keys()].map(key => {
            const e: Event = {
                eventType: 'event' + key.toString(),
                id: '0',
                created: new Date(),
                payload: {},
            };
            mockEventBus.publish(e);
        });
    });

    it('publish does not throw if no handler', async () => {
        const mockEventBus = new MockEventBus([TestEvent.eventName], 'message-bus-test');
        const testEvent = new TestEvent({ x: 'test' });
        expect(mockEventBus.publish(testEvent)).resolves.not.toThrow();
    });

    it('subscribe throws if no service name', async () => {
        const mockEventBus = new MockEventBus([TestEvent.eventName], '');
        const testEvent = new TestEvent({ x: 'test' });
        expect(mockEventBus.subscribe(testEvent.eventType, mockHandler)).rejects.toStrictEqual(
            new Error('Service name not set!'),
        );
    });

    it('subscribe throws if no event name', async () => {
        const mockEventBus = new MockEventBus([''], 'service');
        expect(mockEventBus.subscribe('', mockHandler)).rejects.toStrictEqual(new Error('EventType name not set!'));
    });

    it('subscribe throws if handler set twice', async () => {
        const mockEventBus = new MockEventBus(['test'], 'service');
        expect(mockEventBus.subscribe('test', mockHandler)).resolves.not.toThrow();
        expect(mockEventBus.subscribe('test', mockHandler)).rejects.toStrictEqual(
            new Error(`Handler already set for 'test' set!`),
        );
    });

    it('subscribe throws if event type not registered in constructor', async () => {
        const mockEventBus = new MockEventBus(['test2'], 'service');
        expect(mockEventBus.subscribe('test', mockHandler)).rejects.toStrictEqual(
            new Error('EventBus not constructed to subscribe to that event!'),
        );
    });

    it('can publish and subscribe to the same EventType', async () => {
        const mockEventBus = new MockEventBus([TestEvent.eventName], 'message-bus-test');

        await mockEventBus.subscribe(TestEvent.eventName, mockHandler);
        const testEvent = new TestEvent({ x: 'test' });
        await mockEventBus.publish(testEvent);

        expect(mockHandler).toBeCalled();
        expect(mockHandler.mock.calls).toEqual([[testEvent]]);
    });

    it('can discriminate based on event type', async () => {
        const eventType1 = 'libero:mock:test1';
        const eventType2 = 'libero:mock:test2';

        const event1: Event = {
            eventType: eventType1,
            id: 'some-testing-event1-id',
            created: new Date(),
            payload: { x: 10, y: 20 },
        };

        const event2: Event = {
            eventType: eventType2,
            id: 'some-testing-event2-id',
            created: new Date(),
            payload: { a: 10, b: 20 },
        };

        let handler1 = 0;
        let handler2 = 0;
        let receivedEvent1: object = {};
        let receivedEvent2: object = {};

        const mockHandler1 = async (event: Event): Promise<boolean> => {
            handler1 += 1;
            receivedEvent1 = event;

            return Promise.resolve(true);
        };

        const mockHandler2 = async (event: Event): Promise<boolean> => {
            handler2 += 1;
            receivedEvent2 = event;
            return Promise.resolve(true);
        };

        const mockEventBus = new MockEventBus([eventType1, eventType2], 'message-bus-test');

        mockEventBus.subscribe(eventType1, mockHandler1);
        mockEventBus.subscribe(eventType2, mockHandler2);

        mockEventBus.publish(event2);

        expect(handler1).toBe(0);
        expect(handler2).toBe(1);
        expect(receivedEvent1).toEqual({});
        expect(receivedEvent2).toEqual(event2);

        receivedEvent1 = {};
        receivedEvent2 = {};
        mockEventBus.publish(event1);

        expect(handler1).toBe(1);
        expect(handler2).toBe(1);
        expect(receivedEvent1).toEqual(event1);
        expect(receivedEvent2).toEqual({});
    });
});
