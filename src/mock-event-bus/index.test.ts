import { MockEventBus } from '.';
import { Event, eventFactory } from '../event-bus';

interface TestEventPayload1 {
    x: number;
    y: number;
}

interface TestEventPayload2 {
    a: number;
    b: number;
}

type MockEventType1 = Event<TestEventPayload1>;
type MockEventType2 = Event<TestEventPayload2>;

describe('mock message queue', () => {
    // describe('object lifetime', () => {
    //     it('can do the full flow', async () => {
    //         const x = 2;
    //     });
    // });

    describe('you can publish and subscribe', () => {
        it('can do the full flow', async () => {
            const eventType = 'libero:mock:test';

            const mockHandler = jest.fn(async () => true);
            const mockEventBus = await new MockEventBus([eventType], 'message-bus-test');

            mockEventBus.subscribe<MockEventType1>(eventType, mockHandler);

            const event = eventFactory<TestEventPayload1>(eventType, { x: 10, y: 20 });

            mockEventBus.publish<TestEventPayload1>(event);

            expect(mockHandler).toBeCalled();
            expect(mockHandler.mock.calls).toEqual([[event]]);
        });

        it('can discriminate based on event type', async () => {
            const eventType1 = 'libero:mock:test1';
            const eventType2 = 'libero:mock:test2';

            const event1: MockEventType1 = {
                eventType: eventType1,
                id: 'some-testing-event1-id',
                created: new Date(),
                payload: { x: 10, y: 20 },
            };

            const event2: MockEventType2 = {
                eventType: eventType2,
                id: 'some-testing-event2-id',
                created: new Date(),
                payload: { a: 10, b: 20 },
            };

            let handler1 = 0;
            let handler2 = 0;
            let receivedEvent1: object = {};
            let receivedEvent2: object = {};

            const mockHandler1 = async (event: Event<TestEventPayload1>): Promise<boolean> => {
                handler1 += 1;
                receivedEvent1 = event;

                return Promise.resolve(true);
            };

            const mockHandler2 = async (event: Event<TestEventPayload2>): Promise<boolean> => {
                handler2 += 1;
                receivedEvent2 = event;
                return Promise.resolve(true);
            };

            const mockEventBus = new MockEventBus([eventType1, eventType2], 'message-bus-test');

            mockEventBus.subscribe<TestEventPayload1>(eventType1, mockHandler1);
            mockEventBus.subscribe<TestEventPayload2>(eventType2, mockHandler2);

            mockEventBus.publish<TestEventPayload2>(event2);

            expect(handler1).toBe(0);
            expect(handler2).toBe(1);
            expect(receivedEvent1).toEqual({});
            expect(receivedEvent2).toEqual(event2);

            receivedEvent1 = {};
            receivedEvent2 = {};
            mockEventBus.publish<TestEventPayload1>(event1);

            expect(handler1).toBe(1);
            expect(handler2).toBe(1);
            expect(receivedEvent1).toEqual(event1);
            expect(receivedEvent2).toEqual({});
        });
    });
});
