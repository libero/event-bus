import { Event } from './event';

describe('Event class', () => {
    const create = (T, type, payload): Event => new T(type, payload);

    it('initialises members', () => {
        const x = create(Event, 'test', 'some-payload');

        expect(x.id).toHaveLength(41);
        expect(x.created instanceof Date).toBeTruthy();
        expect(x.created.toISOString()).toHaveLength(24);
        expect(x.eventType).toBe('test');
        expect(x.payload).toBe('some-payload');
    });

    it('has correct members', () => {
        const keys = Object.keys(create(Event, 'test', 'payload'));
        expect(keys).toHaveLength(4);
        expect(keys).toContain('id');
        expect(keys).toContain('created');
        expect(keys).toContain('eventType');
        expect(keys).toContain('payload');
    });
});
