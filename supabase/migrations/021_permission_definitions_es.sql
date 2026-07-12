-- Data-only update: permission_definitions.name/module/description were seeded in English by
-- migration 012. These are user-facing text -- rendered directly in the Roles tab's Derived
-- Capabilities list and Operational Status toggles, and in the Store list's Capacidades column
-- -- so they follow the same UI-language rule as the rest of the Store module.

update permission_definitions set
  module = 'Suministro Interno',
  name = 'Solicitud de Suministro Interno',
  description = 'Permite a este local crear solicitudes de suministro interno a otro local.'
where key = 'internal_supply_request';

update permission_definitions set
  module = 'Suministro Interno',
  name = 'Envío de Suministro Interno',
  description = 'Permite a este local aceptar, preparar y enviar solicitudes de suministro interno de otros locales.'
where key = 'internal_supply_fulfillment';

update permission_definitions set
  module = 'Inventario',
  name = 'Conteo de Stock',
  description = 'Permite a este local realizar conteos físicos de stock.'
where key = 'stock_count';
