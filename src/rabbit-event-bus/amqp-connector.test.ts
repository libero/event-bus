import { connect, Connection } from 'amqplib';
import * as flushPromises from 'flush-promises';
import AMQPConnector from './amqp-connector';
import { StateChange } from './types';
import { channel } from 'rs-channel-node';
import { InfraLogger as logger } from '../logger';
import { EventUtils } from './event-utils';
import { Event } from '../event-bus/index';

jest.mock('amqplib');
jest.mock('../logger');

beforeEach(() => jest.resetAllMocks());

describe('AMQP connector', () => {
    const url = 'http://example.com';
    const makeConnection = (mockChannel?): Connection =>
        (({
            createChannel: mockChannel ? (): void => mockChannel : jest.fn(),
            on: jest.fn(),
            close: jest.fn(),
        } as unknown) as Connection);

    const makeChannel = (options: { [key: string]: Function } = {}): Record<string, jest.Mock> => ({
        assertQueue: jest.fn(),
        assertExchange: jest.fn(),
        bindQueue: jest.fn(),
        consume: jest.fn(),
        publish: jest.fn(),
        on: jest.fn(),
        ack: jest.fn(),
        nack: jest.fn(),
        close: jest.fn(),
        ...options,
    });

    describe('constructor', () => {
        it('should create a channel and set connected state', async () => {
            const mockConnection = makeConnection();
            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);

            const sender = jest.fn();
            const receiver = async (): Promise<StateChange> => ({} as StateChange);
            const connector = new AMQPConnector(url, [sender, receiver], 'service');
            await connector.setup([], []);

            await flushPromises();
            expect(connect).toHaveBeenCalledTimes(1);
            expect(connect).toHaveBeenCalledWith('http://example.com');
            expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
            expect(sender).toHaveBeenCalledTimes(1);
            expect(sender).toHaveBeenCalledWith({ newState: 'CONNECTED' });
        });

        it('should set to not connected state on connection error', async () => {
            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => Promise.reject());
            const sender = jest.fn();
            const receiver = async (): Promise<StateChange> => ({} as StateChange);

            const connector = new AMQPConnector(url, [sender, receiver], 'service');
            await connector.setup([], []);

            await flushPromises();
            expect(sender).toHaveBeenCalledTimes(1);
            expect(sender).toHaveBeenCalledWith({ newState: 'NOT_CONNECTED' });
        });

        it('should assert the right exchanges', async () => {
            const mockChannel = makeChannel({ assertExchange: jest.fn() });
            const mockConnection = makeConnection(mockChannel);

            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            connector.setup(['test:event'], []);

            await flushPromises();
            expect(mockChannel.assertExchange).toHaveBeenCalledTimes(1);
            expect(mockChannel.assertExchange).toHaveBeenCalledWith('event__test:event', 'fanout');
        });

        it('should subscribe to the right queue', async () => {
            const mockChannel = makeChannel({ assertQueue: jest.fn().mockImplementation(() => Promise.resolve()) });
            const mockConnection = makeConnection(mockChannel);
            const eventType = 'test:event';

            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            connector.setup([], [{ eventType, handler: jest.fn() }]);

            await flushPromises();
            expect(mockChannel.assertQueue).toHaveBeenCalledTimes(1);
            expect(mockChannel.assertQueue).toHaveBeenCalledWith('consumer__test:event__service');
            expect(mockChannel.bindQueue).toHaveBeenCalledTimes(1);
            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'consumer__test:event__service',
                'event__test:event',
                '',
            );
            expect(mockChannel.consume).toHaveBeenCalledTimes(1);
            expect(mockChannel.consume.mock.calls[0][0]).toBe('consumer__test:event__service');
            expect(connector.subscribedEvents).toHaveLength(1);
            expect(connector.subscribedEvents[0]).toBe('test:event');
        });
    });

    describe('destroy', () => {
        it('should close the connection and not reconnect', async () => {
            const mockConnection = makeConnection();
            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);

            const sender = jest.fn();
            const receiver = async (): Promise<StateChange> => ({} as StateChange);
            const connector = new AMQPConnector(url, [sender, receiver], 'service');
            await connector.setup([], []);

            await flushPromises();
            connector.destroy();
            await flushPromises();

            expect(mockConnection.close).toHaveBeenCalledTimes(1);
            expect(sender).toHaveBeenCalledTimes(1);
            expect(sender.mock.calls[0][0]).toStrictEqual({ newState: 'CONNECTED' });
        });
    });

    describe('publish', () => {
        it('should publish to the right exchanges', async () => {
            const mockChannel = makeChannel();
            const mockConnection = makeConnection(mockChannel);
            const event = {
                eventType: 'test:event',
                id: 'id',
                created: new Date(),
                payload: { data: 'payload' },
            };
            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            connector.setup(['test:event'], []);
            // we need to wait for connection to be stored before we can publish
            await flushPromises();
            await connector.publish(event as Event);
            await flushPromises();
            expect(mockChannel.publish).toHaveBeenCalledTimes(1);
            expect(mockChannel.publish.mock.calls[0][0]).toBe('event__test:event');
            expect(mockChannel.publish.mock.calls[0][1]).toBe('');
            expect(mockChannel.publish.mock.calls[0][2]).toEqual(
                Buffer.from(
                    JSON.stringify({
                        event,
                        meta: {
                            attempts: 0,
                            retries: 10,
                            failures: 0, // increments each failure
                        },
                    }),
                ),
            );
        });
    });

    describe('subscribe', () => {
        it('should subscribe to the right queue', async () => {
            const mockChannel = makeChannel({ assertQueue: jest.fn().mockImplementation(() => Promise.resolve()) });
            const mockConnection = makeConnection(mockChannel);

            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            await connector.setup([], []);

            await flushPromises();
            await connector.subscribe('test:event', jest.fn());

            expect(mockChannel.assertQueue).toHaveBeenCalledTimes(1);
            expect(mockChannel.assertQueue).toHaveBeenCalledWith('consumer__test:event__service');
            expect(mockChannel.bindQueue).toHaveBeenCalledTimes(1);
            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'consumer__test:event__service',
                'event__test:event',
                '',
            );
            expect(mockChannel.consume).toHaveBeenCalledTimes(1);
            expect(mockChannel.consume.mock.calls[0][0]).toBe('consumer__test:event__service');
        });

        it('it should call the subscription handler and acknowledge', async () => {
            const mockChannel = makeChannel({
                assertQueue: jest.fn().mockImplementation(() => Promise.resolve()),
                consume: (___, callback) => {
                    callback({
                        content: { toString: (): string => '{ "event": "foo" }' },
                    });
                },
            });
            const mockConnection = makeConnection(mockChannel);

            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            await connector.setup([], []);
            const handler = jest.fn().mockImplementation(async () => Promise.resolve(true));

            await flushPromises();
            await connector.subscribe('test:event', handler);

            await flushPromises();
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('foo');
            expect(mockChannel.ack).toHaveBeenCalledTimes(1);
            expect(mockChannel.ack.mock.calls[0][0].content.toString()).toBe('{ "event": "foo" }');
        });

        it('it should call the subscription handler and unacknowledged if not ok', async () => {
            const testEvent = {
                id: '12345',
                eventType: 'test:event',
                payload: { event: 'foo' },
                created: new Date('2019-12-30T12:30:00'),
            };

            const messageString = JSON.stringify(EventUtils.eventToMessage(testEvent));

            const mockChannel = makeChannel({
                assertQueue: jest.fn().mockImplementation(() => Promise.resolve()),
                consume: (___, callback) => {
                    callback({
                        content: {
                            toString: (): string => messageString,
                        },
                    });
                },
            });
            const mockConnection = makeConnection(mockChannel);

            (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
            const connector = new AMQPConnector(url, channel(), 'service');
            await connector.setup([], []);
            const handler = jest.fn().mockImplementation(async () => Promise.resolve());

            await flushPromises();
            await connector.subscribe('test:event', handler);

            await flushPromises();
            expect(handler).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith(
                'eventHandlerFailure',
                { attempts: 0, failures: 0, retries: 10 },
                {
                    created: '2019-12-30T12:30:00.000Z',
                    eventType: 'test:event',
                    id: '12345',
                    payload: { event: 'foo' },
                },
            );
            expect(mockChannel.nack).toHaveBeenCalledTimes(1);
            const unacknowledgedMessage = mockChannel.nack.mock.calls[0][0].content.toString();
            expect(unacknowledgedMessage).toBe(messageString);

            expect(mockChannel.nack.mock.calls[0][1]).toBe(false);
            expect(mockChannel.nack.mock.calls[0][2]).toBe(true);
        });
    });

    it('it should not acknowledge message with invalid event', async () => {
        const mockChannel = makeChannel({
            assertQueue: jest.fn().mockImplementation(() => Promise.resolve()),
            consume: (___, callback) => {
                callback({
                    content: { toString: (): string => 'not json' },
                });
            },
        });
        const mockConnection = makeConnection(mockChannel);

        (connect as jest.Mock).mockImplementation(async (): Promise<Connection> => mockConnection);
        const connector = new AMQPConnector(url, channel(), 'service');
        await connector.setup([], []);
        const handler = jest.fn().mockImplementation(async () => Promise.resolve());

        await flushPromises();
        await connector.subscribe('test:event', handler);

        await flushPromises();
        expect(handler).toHaveBeenCalledTimes(0);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'Unable to parse message content to JSON',
            'not json',
            'SyntaxError: Unexpected token o in JSON at position 1',
        );
        expect(mockChannel.nack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack.mock.calls[0][0].content.toString()).toBe('not json');
        expect(mockChannel.nack.mock.calls[0][1]).toBe(false);
        expect(mockChannel.nack.mock.calls[0][2]).toBe(false);
    });
});
