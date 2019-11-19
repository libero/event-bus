import { Option, None, Some } from 'funfix';
import { Event, EventBus } from '../event-bus';
import { Subscription } from './types';
import AMQPConnector from './amqp-connector';
import { InternalMessageQueue, QueuedEvent } from './internal-queue';
import { debounce } from 'lodash';
import { ConnectionObserver, ConnectionOwner } from './connection-observer';

export interface RabbitEventBusConnectionOptions {
    url: string;
}

/**
 * RabbitEventBus - SRP: To implement the generic EventBus for RabbitMQ
 * uses: AMQPConnector, InternalMessageQueue, ConnectionObserver
 *
 * @export
 * @class RabbitEventBus
 * @implements {EventBus}
 */
export default class RabbitEventBus implements EventBus, ConnectionOwner {
    private connector: Option<AMQPConnector> = None;
    private connection: ConnectionObserver;
    private eventDefinitions: string[];
    private serviceName = 'unknown-service';
    private url = '';
    private queue: InternalMessageQueue;
    private subscriptions: Array<Subscription<unknown & object>> = [];

    public constructor(connectionOpts: RabbitEventBusConnectionOptions) {
        this.url = connectionOpts.url;
    }

    public async init(eventDefinitions: string[], serviceName: string): Promise<this> {
        this.eventDefinitions = eventDefinitions;
        this.serviceName = serviceName;
        this.queue = new InternalMessageQueue(this);
        this.connection = new ConnectionObserver(this);
        this.connect();
        return this;
    }

    public onConnect(): void {
        this.queue.publishQueue();
    }

    public onDisconnect(): void {
        this.connector = None;
    }

    public onStartReconnect(): void {
        const reconnect = debounce(() => this.connect(), 100, { maxWait: 2000 });
        reconnect();
    }

    private connect(): void {
        // logger.debug('attemptingConnection');
        // Should I debounce this?
        this.connector = Some(
            new AMQPConnector(
                this.url,
                this.connection.channel,
                this.eventDefinitions,
                this.subscriptions,
                this.serviceName,
            ),
        );
    }

    // This method will not resolve until the event has been successfully published so that
    // the user never has to know about the internal queue
    public publish<P extends object>(msg: Event<P>): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            if (this.connection.isConnected) {
                // Should we queue messages that fail?
                const published: boolean = await this.connector.get().publish(msg);

                if (!published) {
                    const qEvent: QueuedEvent = { event: msg, resolve, reject };
                    this.queue.push(qEvent);
                } else {
                    resolve(published);
                }
            } else {
                const qEvent: QueuedEvent = { event: msg, resolve, reject };
                this.queue.push(qEvent);
            }
        });
    }

    public async subscribe<P extends object>(
        eventType: string,
        handler: (event: Event<P>) => Promise<boolean>,
    ): Promise<number> {
        this.connector.map(connector => {
            connector.subscribe(eventType, handler);
        });

        // Add the subscription to the next connector's list of subscriptions
        return this.subscriptions.push({
            eventType,
            handler,
        });
    }
}
