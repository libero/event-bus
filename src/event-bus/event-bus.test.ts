import { EventBus } from './event-bus';

describe('Event Bus class', () => {
    it('EventBus is abstract', () => {
        const create = (T): EventBus => new T(['test'], 'test');

        const x = create(EventBus);
        expect(x.eventsToHandle).toStrictEqual(['test']);
        expect(x.serviceName).toStrictEqual('test');
        expect(() => x.destroy()).toThrow('x.destroy is not a function');
    });

    it('EventBus can be extended', () => {
        class EB extends EventBus {
            called = false;
            destroy(): Promise<void> {
                this.called = true;
                return Promise.resolve();
            }
        }
        const x = new EB(['test'], 'test');
        expect(x.eventsToHandle).toStrictEqual(['test']);
        expect(x.serviceName).toStrictEqual('test');
        expect(x.destroy()).resolves.toBe(undefined);
        expect(x.called).toBe(true);
    });
});
