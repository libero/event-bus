import { Option, None, Some } from 'funfix';
import { Event, EventBus, EventType } from '../event-bus';
import { Subscription } from './types';
import AMQPConnector from './amqp-connector';
import { InternalMessageQueue, QueuedEvent } from './internal-queue';
import { debounce } from 'lodash';
import { ConnectionObserver, ConnectionOwner } from './connection-observer';

// This is the same as EventConfig ?
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
    private _connector: Option<AMQPConnector> = None;
    private connection: ConnectionObserver;
    private eventToHandle: EventType[];
    private serviceName = 'unknown-service';
    private url = '';
    private queue: InternalMessageQueue;
    private _subscriptions: Array<Subscription<unknown & object>> = [];

    public constructor(connectionOpts: RabbitEventBusConnectionOptions) {
        this.url = connectionOpts.url;
    }

    public get connector(): Option<AMQPConnector> {
        return this._connector;
    }

    public get subscriptions(): Array<Subscription<unknown & object>> {
        return this._subscriptions;
    }

    // Can the params here be moved to the constructor?
    public async register(eventToHandle: EventType[], serviceName: string): Promise<this> {
        this.eventToHandle = eventToHandle;
        this.serviceName = serviceName;
        this.queue = new InternalMessageQueue(this);
        this.connection = new ConnectionObserver(this);
        this.connect();
        return this;
    }

    public async destroy(): Promise<void> {
        if (this.connector) {
            this.connector.get().destroy();
        }
    }

    public onConnect(): void {
        this.queue.publishQueue();
    }

    public onDisconnect(): void {
        this._connector = None;
    }

    public onStartReconnect(): void {
        const reconnect = debounce(() => this.connect(), 100, { maxWait: 2000 });
        reconnect();
    }

    private connect(): void {
        this._connector = Some(
            new AMQPConnector(
                this.url,
                this.connection.channel,
                this.eventToHandle,
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
