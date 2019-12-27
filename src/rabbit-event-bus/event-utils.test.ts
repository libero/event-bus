import { EventUtils } from './event-utils';
import { Message } from './types';
import { Event } from 'event-bus';

describe('EventUtils', () => {
    describe('eventTypeToExchange', (): void => {
        it('correctly names an event exchange', () => {
            const exampleDefinition = 'SampleEvent';
            expect(EventUtils.makeEventExchangeName(exampleDefinition)).toEqual('event__SampleEvent');
        });
    });
    describe('eventTypeToQueue', () => {
        it('correctly names an event queue', () => {
            const eventType = 'SampleEventType';
            const service = 'SampleService';
            expect(EventUtils.makeConsumerQueueName(eventType, service)).toEqual(
                'consumer__SampleEventType__SampleService',
            );
        });
    });
    describe('eventToMessage', () => {
        it('correctly transforms Event object into a Message object', () => {
            const mockEvent = ({} as unknown) as Event<unknown & object>;
            const message = EventUtils.eventToMessage(mockEvent);
            expect(message).toMatchObject<Message<Event<unknown & object>>>({
                event: mockEvent,
                meta: {
                    attempts: 0,
                    retries: 10,
                    failures: 0,
                },
            });
        });
    });
});
