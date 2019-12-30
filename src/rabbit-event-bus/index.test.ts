import RabbitEventBus from '.';
import { Channel, channel } from 'rs-channel-node';
import { StateChange, ConnectedState } from './types';
import AMQPConnector from './amqp-connector';
import waitForExpect from 'wait-for-expect';

jest.mock('../logger');
jest.mock('./amqp-connector');

describe('AMQP Connection Manager', () => {
    describe('destroy', () => {
        it('calls connector destroy method', async () => {
            const destroyMock = jest.fn();
            (AMQPConnector as jest.Mock).mockImplementation(() => ({ destroy: destroyMock }));
            const manager = await new RabbitEventBus({ url: '' }, [], '');

            await manager.destroy();

            expect(destroyMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('behaviour in a good connection state', () => {
        it('forwards messages to a connector', async () => {
            const publishMock = jest.fn(async () => true);
            (AMQPConnector as jest.Mock).mockImplementation((__, [send]: Channel<StateChange>) => {
                send({
                    newState: 'CONNECTED',
                });
                return {
                    publish: publishMock,
                    subscribe: jest.fn(),
                };
            });
            const manager = await new RabbitEventBus({ url: '' }, [], '');
            await manager.publish({
                eventType: 'test',
                id: 'something',
                created: new Date(),
                payload: {},
            });

            expect(publishMock).toBeCalled();
        });

        it("passes on subscribes to the connector immediately, while it's ready", async () => {
            const subscribeMock = jest.fn();
            const [readyNotify, readyWait] = channel<{}>();
            (AMQPConnector as jest.Mock).mockImplementation((__, [send]: Channel<StateChange>) => {
                send({
                    newState: 'CONNECTED',
                });

                readyNotify({});
                return {
                    publish: jest.fn(),
                    subscribe: subscribeMock,
                };
            });

            const manager = await new RabbitEventBus({ url: '' }, [], '');

            await manager.subscribe('test', jest.fn());

            await readyWait();
            expect(subscribeMock).toBeCalled();
        });

        it("it resolves publishes once they've actually been published", async done => {
            const publishMock = jest.fn();

            // This channel is used to simulate startup delay in the connector
            const [readyNotify, readyWait] = channel<{}>();

            (AMQPConnector as jest.Mock).mockImplementation((___, [send]: Channel<StateChange>, __, subscriptions) => {
                send({
                    newState: 'CONNECTED',
                });
                readyWait().then(() => {
                    send({
                        newState: 'NOT_CONNECTED',
                    });
                });
                return {
                    subscriptions,
                    publish: publishMock,
                    subscribe: jest.fn(),
                };
            });

            const manager = await new RabbitEventBus({ url: '' }, [], '');

            Promise.all([
                manager.publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                }),
                manager.publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                }),
                manager.publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                }),
            ]);

            expect(publishMock).toBeCalledTimes(0);

            // simulate some startup delay in the connector
            setTimeout(() => {
                readyNotify({});
                // Expect the connector to be created with subscriptions
                expect(publishMock).toBeCalledTimes(3);
                done();
            }, 50);
        });

        it('passes on subscribes that are registered after the connector is ready', async done => {
            const subscribeMock = jest.fn();
            const connectMock = jest.fn();

            // This channel is used to simulate startup delay in the connector
            const [readyNotify, readyWait] = channel<{}>();

            (AMQPConnector as jest.Mock).mockImplementation((__, [send]: Channel<StateChange>, _2, subscriptions) => {
                send({
                    newState: 'CONNECTED',
                });
                readyWait().then(() => {
                    send({
                        newState: 'NOT_CONNECTED',
                    });
                });
                return {
                    subscriptions,
                    connect: connectMock,
                    publish: jest.fn(),
                    subscribe: subscribeMock,
                };
            });

            const manager = await new RabbitEventBus({ url: '' }, [], '');

            await manager.subscribe('test', jest.fn());
            await manager.subscribe('test', jest.fn());
            await manager.subscribe('test', jest.fn());

            expect(manager.subscriptions.length).toEqual(3);
            expect(subscribeMock).toBeCalledTimes(3);

            // simulate some startup delay in the connector
            setTimeout(() => {
                readyNotify({});
                // Expect the connector to be created with subscriptions
                expect(manager.subscriptions).toHaveLength(3);
                expect(manager.connector.isEmpty()).toBeFalsy();
                done();
            }, 50);
        });
    });

    describe('degraded state', () => {
        it('publish promises are not resolved after a failed connection', async done => {
            const subscribeMock = jest.fn();
            const connectMock = jest.fn();

            (AMQPConnector as jest.Mock).mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                (_0, [send, _1]: Channel<StateChange>, _2, subscriptions) => {
                    send({
                        newState: 'NOT_CONNECTED',
                    });

                    return {
                        subscriptions,
                        connect: connectMock,
                        publish: jest.fn(() => false),
                        subscribe: subscribeMock,
                    };
                },
            );

            const manager = await new RabbitEventBus({ url: '' }, [], '');
            const then = jest.fn();

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            setTimeout(() => {
                expect(then).toHaveBeenCalledTimes(0);
                done();
            }, 250);
        });

        it('publish promises are resolved after a successful connection', async done => {
            const subscribeMock = jest.fn();

            (AMQPConnector as jest.Mock).mockImplementation((__, [send]: Channel<StateChange>, _2, subscriptions) => {
                send({
                    newState: 'CONNECTED',
                });

                return {
                    subscriptions,
                    publish: jest.fn(() => true),
                    subscribe: subscribeMock,
                };
            });

            const manager = await new RabbitEventBus({ url: '' }, [], '');
            const then = jest.fn();

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            setTimeout(() => {
                expect(then).toHaveBeenCalledTimes(3);
                done();
            }, 250);
        });

        it('publish promises are published after a failed connection', async () => {
            const subscribeMock = jest.fn();
            const connectMock = jest.fn();
            let returnState: ConnectedState = 'NOT_CONNECTED';
            let returnPublish = false;

            (AMQPConnector as jest.Mock).mockImplementation((__, [send]: Channel<StateChange>, _2, subscriptions) => {
                send({
                    newState: returnState,
                });

                return {
                    subscriptions,
                    connect: connectMock,
                    publish: jest.fn(() => returnPublish),
                    subscribe: subscribeMock,
                };
            });

            const manager = await new RabbitEventBus({ url: '' }, [], '');
            const then = jest.fn();

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            manager
                .publish({
                    eventType: 'test',
                    id: 'something',
                    created: new Date(),
                    payload: {},
                })
                .then(then);

            const checkNothingPublished = (): Promise<NodeJS.Timeout> => {
                return new Promise(resolve =>
                    setTimeout(() => {
                        expect(then).toHaveBeenCalledTimes(0);

                        // 'reconnect' the connection
                        returnPublish = true;
                        returnState = 'CONNECTED';
                        resolve();
                    }, 250),
                );
            };

            // We need to wait for at least 250ms to ensure that nothing has been
            // inadvertently published.
            await checkNothingPublished();

            // This check will succeeded as quickly as possible.
            await waitForExpect(() => {
                expect(then).toHaveBeenCalledTimes(3);
            });
        });
    });

    // Tests that it queues up messages that it can't send and that resends then when it can
    // If a message fails to send it will retry it
});
