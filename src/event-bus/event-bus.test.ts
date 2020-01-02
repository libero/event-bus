import { EventBus } from './event-bus';

describe('Event Bus class', () => {
    const create = (T): EventBus => new T(['test'], 'test');
    it('is abstract', () => {
        const x = create(EventBus);
        expect(() => x.destroy()).toThrow('x.destroy is not a function');
    });

    it('initialises members', () => {
        const x = create(EventBus);
        expect(x.eventsToHandle).toStrictEqual(['test']);
        expect(x.serviceName).toStrictEqual('test');
    });

    it('has correct members', () => {
        const keys = Object.keys(create(EventBus));
        expect(keys).toHaveLength(2);
        expect(keys).toContain('eventsToHandle');
        expect(keys).toContain('serviceName');
    });

    it('can be extended', () => {
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
