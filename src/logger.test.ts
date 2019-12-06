import Logger, { InfraLogger, DomainLogger } from './logger';

describe('logger', () => {
    it('Logger has no bindings', () => {
        const loggerBindings = Logger.bindings();
        expect(loggerBindings).toEqual({});
    });
    it('InfraLogger has service set to event-bus and realm set to infra on bindings', () => {
        const loggerBindings = InfraLogger.bindings();
        expect(loggerBindings).toEqual({ service: 'event-bus', realm: 'infra' });
    });
    it('DomainLogger has service set to event-bus and realm set to domain on bindings', () => {
        const loggerBindings = DomainLogger.bindings();
        expect(loggerBindings).toEqual({ service: 'event-bus', realm: 'domain' });
    });
});
