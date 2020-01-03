import { Option, None, Some } from 'funfix';
import { Event, EventBus, EventType, EventPublisher, EventSubscriber } from '../event-bus';
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
export default class RabbitEventBus extends EventBus implements EventPublisher, EventSubscriber, ConnectionOwner {
    private _connector: Option<AMQPConnector> = None;
    private connection: ConnectionObserver;
    private url = '';
    private queue: InternalMessageQueue;
    private _subscriptions: Array<Subscription> = [];

    public constructor(
        connectionOpts: RabbitEventBusConnectionOptions,
        eventToHandle: EventType[],
        serviceName: string,
    ) {
        super(eventToHandle, serviceName);
        this.url = connectionOpts.url;
        this.queue = new InternalMessageQueue(this);
        this.connection = new ConnectionObserver(this);
        this.connect();
    }

    public get connector(): Option<AMQPConnector> {
        return this._connector;
    }

    public get subscriptions(): Array<Subscription> {
        return this._subscriptions;
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
                this.eventsToHandle,
                this.subscriptions,
                this.serviceName,
            ),
        );
    }

    // This method will not resolve until the event has been successfully published so that
    // the user never has to know about the internal queue
    public publish(msg: Event): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (this.connection.isConnected) {
                const published: boolean = await this.connector.get().publish(msg);

                if (!published) {
                    const qEvent: QueuedEvent = { event: msg, resolve, reject };
                    this.queue.push(qEvent);
                } else {
                    resolve();
                }
            } else {
                const qEvent: QueuedEvent = { event: msg, resolve, reject };
                this.queue.push(qEvent);
            }
        });
    }

    public async subscribe(eventType: string, handler: (event: Event) => Promise<boolean>): Promise<number> {
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
