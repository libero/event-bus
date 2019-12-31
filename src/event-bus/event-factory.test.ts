import { eventFactory, eventAbstractFactory } from './event-factory';
import { Event, Payload } from './types';

describe('Event Creation', () => {
    describe('eventFactory', () => {
        it('creates an Event', () => {
            const payload = new Payload();
            const event = eventFactory('type', payload);
            expect(event.id).toHaveLength(36);
            expect(event.eventType).toBe('type');
            expect(event.created instanceof Date).toBe(true);
            expect(event.payload).toBe(payload);
        });

        it('fails to create an Event without a payload of type Payload', () => {
            expect(() => eventFactory('type', {})).toThrow('argument payload is not of type Payload!');
        });
    });

    describe('eventAbstractFactory', () => {
        class Party extends Payload {
            beer: boolean;
            address: string;
        }
        class EventParty extends Event {}

        class GardenParty extends Payload {
            wine: boolean;
        }

        it('creates an Event of correct type', () => {
            const payload = new Party();
            payload.beer = true;
            payload.address = 'my place';

            const event: EventParty = eventAbstractFactory('party', Party, payload);

            expect(event.id).toHaveLength(36);
            expect(event.eventType).toBe('party');
            expect(event.created instanceof Date).toBe(true);
            expect(event.payload).toHaveProperty('beer');
            expect(event.payload['beer']).toBe(true);
            expect(event.payload).toHaveProperty('address');
            expect(event.payload['address']).toBe('my place');
        });

        it('rejects arbitrary payload type', () => {
            const payload = { address: 'my place' };
            const create = (p: object): EventParty => eventAbstractFactory('party', Party, p);

            expect(() => create(payload)).toThrow('expected payload of type Party got Object');
        });

        it('rejects incorrect payload type', () => {
            const payload = new GardenParty();
            payload.wine = true;
            const create = (p: GardenParty): EventParty => eventAbstractFactory('party', Party, p);

            expect(() => create(payload)).toThrow('expected payload of type Party got GardenParty');
        });
    });
});
