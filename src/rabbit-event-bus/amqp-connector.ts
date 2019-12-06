import { Sender, Channel } from 'rs-channel-node';
import { Option } from 'funfix';
import { Connection, Message } from 'amqplib';
import * as amqplib from 'amqplib';
import { InfraLogger as logger } from '../logger';
import { Event } from '../event-bus';
import { Subscription, StateChange, Message as EventBusMessage } from './types';
import { EventUtils } from './event-utils';

export default class AMQPConnector {
    private externalConnector: {
        send: Sender<StateChange>;
    };
    private serviceName = 'unknown-service';
    private subscriptions: Array<Subscription<object>>;
    private connection: Connection;

    public constructor(
        url: string,
        [sender]: Channel<StateChange>,
        eventDefs: string[],
        subscriptions: Array<Subscription<unknown & object>>,
        serviceName: string,
    ) {
        this.externalConnector = { send: sender };
        this.subscriptions = subscriptions;
        this.serviceName = serviceName;

        // Set up the connections to the AMQP server
        this.connect(url)
            .then(async connection => {
                this.connection = connection;
                // Setup the exchanges

                const rabbitChannel = await this.connection.createChannel();
                await Promise.all(
                    eventDefs.map(async (eventType: string) =>
                        rabbitChannel.assertExchange(EventUtils.eventTypeToExchange(eventType), 'fanout'),
                    ),
                )
                    .catch(() => logger.fatal("can't create exchanges"))
                    .then(() => {
                        this.connected();
                    });

                // Create subscribers here
                this.subscriptions.forEach(async subscription => {
                    // subscribe
                    await this.subscribe(subscription.eventType, subscription.handler);
                });
            })
            .catch(() => {
                // notify the manager object that the connection has failed
                // logger.debug('connectionFailed, retrying');
                this.disconnected();
            });
    }

    private async connect(rabbitUrl: string): Promise<Connection> {
        try {
            const connection = await amqplib.connect(rabbitUrl);
            connection.on('error', () => this.disconnected());
            connection.on('end', () => this.disconnected());
            connection.on('close', () => this.disconnected());

            return connection;
        } catch (e) {
            throw new Error('Connection failed');
        }
    }

    public async subscribe<P extends object>(
        eventType: string,
        handler: (ev: Event<P>) => Promise<boolean>,
    ): Promise<void> {
        // For the event identifier:
        //  - Declare a subscriber queue
        //  - bind that queue to event exchange
        // Runs the handler function on any event that matches that type
        return Option.of(this.connection)
            .map(async (conn: Connection) => {
                const rabbitChannel = await conn.createChannel();
                rabbitChannel.on('error', () => this.disconnected());

                return await rabbitChannel
                    .assertQueue(EventUtils.eventTypeToQueue(eventType, this.serviceName))
                    .then(async () => {
                        await rabbitChannel.bindQueue(
                            EventUtils.eventTypeToQueue(eventType, this.serviceName),
                            EventUtils.eventTypeToExchange(eventType),
                            '',
                        );
                        logger.trace('subscribe');

                        await rabbitChannel.consume(
                            EventUtils.eventTypeToQueue(eventType, this.serviceName),
                            async (msg: Message) => {
                                try {
                                    const message: EventBusMessage<Event<P>> = JSON.parse(msg.content.toString());

                                    handler(message.event).then(isOk => {
                                        if (isOk) {
                                            // Ack
                                            rabbitChannel.ack(msg);
                                        } else {
                                            // Nack
                                            logger.warn('eventHandlerFailure');
                                            rabbitChannel.nack(msg, false, true);
                                        }
                                    });
                                } catch (e) {
                                    rabbitChannel.nack(msg, false, false);
                                    logger.warn("Can't parse JSON");
                                }
                            },
                        );
                    })
                    .catch(() => {
                        logger.fatal("can't create subscriber queues");
                    });
            })
            .getOrElseL(() => {
                // Do we want to handle reconnects &/or retries here?
                setTimeout(() => this.subscribe(eventType, handler), 1000);
                logger.warn("No connection, can't subscribe, trying again soon!");
            });
    }

    public async publish<P extends object>(event: Event<P>): Promise<boolean> {
        // publish the message
        const whereTo = EventUtils.eventTypeToExchange(event.eventType);
        return Option.of(this.connection)
            .map(async connection => {
                try {
                    const rabbitChannel = await connection.createChannel();
                    // Channels only really error because of connection issues
                    rabbitChannel.on('error', () => this.disconnected());

                    await rabbitChannel.publish(
                        whereTo,
                        '',
                        Buffer.from(JSON.stringify(EventUtils.eventToMessage(event))),
                    );

                    rabbitChannel.close();
                    return true;
                } catch (e) {
                    logger.error("couldn't publish message", e);
                    return false;
                }
            })
            .getOrElse(false);
    }

    private disconnected(): void {
        this.externalConnector.send({ newState: 'NOT_CONNECTED' });
    }

    private connected(): void {
        this.externalConnector.send({ newState: 'CONNECTED' });
    }
}
