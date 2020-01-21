import { Sender, Channel } from 'rs-channel-node';
import { Option, None } from 'funfix';
import { Connection, Message } from 'amqplib';
import * as amqplib from 'amqplib';
import { InfraLogger as logger } from '../logger';
import { Event, EventType } from '../event-bus';
import { Subscription, StateChange, Message as EventBusMessage } from './types';
import { EventUtils } from './event-utils';

export default class AMQPConnector {
    private externalConnector: {
        send: Sender<StateChange>;
    };
    private serviceName = 'unknown-service';
    private connection: Connection;
    private destroyed = false;
    private subscriptions: EventType[] = [];

    public constructor([sender]: Channel<StateChange>, serviceName: string) {
        this.externalConnector = { send: sender };
        this.serviceName = serviceName;
    }

    public async setup(url: string, eventDefs: string[], subscriptions: Array<Subscription>): Promise<void> {
        // Set up the connections to the AMQP server
        return this.connect(url)
            .then(async connection => {
                this.connection = connection;
                console.log('has connection')
                await this.setupExchanges(eventDefs, subscriptions);
            })
            .catch(() => {
                // notify the manager object that the connection has failed
                // logger.debug('connectionFailed, retrying');
                this.disconnected();
            });
    }

    public async destroy(): Promise<void> {
        this.destroyed = true;

        if (this.connection) {
            return this.connection.close();
        }
    }

    public async subscribe(eventType: EventType, handler: (ev: Event) => Promise<boolean>): Promise<void> {
        // For the event identifier:
        //  - Declare a subscriber queue
        //  - bind that queue to event exchange
        // Runs the handler function on any event that matches that type
        const channelOption = await this.createChannel();

        console.log('has connection: ', !!this.connection);

        if (!channelOption.isEmpty()) {
            const rabbitChannel = channelOption.get();
            rabbitChannel.on('error', () => this.disconnected());
            return rabbitChannel
                .assertQueue(EventUtils.makeConsumerQueueName(eventType, this.serviceName))
                .then(async () => {
                    const qName = EventUtils.makeConsumerQueueName(eventType, this.serviceName);
                    const exName = EventUtils.makeEventExchangeName(eventType);

                    await rabbitChannel.bindQueue(qName, exName, '');
                    logger.trace('subscribe');
                    this.subscriptions.push(eventType);

                    await rabbitChannel.consume(qName, async (msg: Message) => {
                        return this.decoratedHandler(rabbitChannel, handler, msg);
                    });
                })
                .catch(() => {
                    logger.fatal(`Can't create subscriber queues for: ${this.serviceName} using event: ${eventType}`);
                });
        } else {
            logger.warn("No CONTAINER, can't subscribe, trying again soon!");
            // Do we want to handle reconnects &/or retries here?
            return new Promise(resolve => setTimeout(async () => {
                    await this.subscribe(eventType, handler);
                    resolve();
                }, 1000),
            );
        }
    }

    public async publish(event: Event): Promise<boolean> {
        // publish the message
        const whereTo = EventUtils.makeEventExchangeName(event.eventType);
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

    public get subscribedEvents(): EventType[] {
        return this.subscriptions;
    }

    private async createChannel(): Promise<Option<amqplib.Channel>> {
        const conn = Option.of(this.connection);
        if (conn.isEmpty()) {
            return None;
        } else {
            return Option.of(await conn.get().createChannel());
        }
    }

    private decoratedHandler(
        rabbitChannel: amqplib.Channel,
        handler: (ev: Event) => Promise<boolean>,
        msg: Message,
    ): void {
        try {
            const message: EventBusMessage<Event> = JSON.parse(msg.content.toString());

            handler(message.event).then(isOk => {
                if (isOk) {
                    // Ack
                    rabbitChannel.ack(msg);
                } else {
                    // Nack
                    logger.warn('eventHandlerFailure', message.meta, message.event);
                    rabbitChannel.nack(msg, false, true);
                }
            });
        } catch (e) {
            rabbitChannel.nack(msg, false, false);
            logger.warn('Unable to parse message content to JSON', msg.content.toString(), e.toString());
        }
    }

    private async setupExchanges(eventDefs: string[], subscriptions: Array<Subscription>): Promise<void> {
        const rabbitChannel = await this.connection.createChannel();
        this.subscriptions = [];

        await Promise.all(
            eventDefs.map(async (eventType: string) =>
                rabbitChannel.assertExchange(EventUtils.makeEventExchangeName(eventType), 'fanout'),
            ),
        )
            .catch(() => logger.fatal("can't create exchanges"))
            .then(() => {
                this.connected();
            });

        // Create subscribers here
        subscriptions.forEach(async subscription => {
            // subscribe
            await this.subscribe(subscription.eventType, subscription.handler);
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
    private disconnected(): void {
        if (!this.destroyed) {
            this.externalConnector.send({ newState: 'NOT_CONNECTED' });
        }
    }

    private connected(): void {
        this.externalConnector.send({ newState: 'CONNECTED' });
    }
}
