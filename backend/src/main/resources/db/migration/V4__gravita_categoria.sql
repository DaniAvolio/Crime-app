-- =========================================================================
-- Gravità della categoria: 1 = bassa (degrado, quiete), 2 = media (patrimonio),
-- 3 = alta (contro la persona). Guida il colore dei marker e il filtro sulla mappa.
-- =========================================================================
ALTER TABLE categoria
    ADD COLUMN gravita INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_categoria_gravita CHECK (gravita BETWEEN 1 AND 3);

-- =========================================================================
-- Categorie predefinite (solo comportamenti osservabili). Se l'admin ne ha già
-- creata una con lo stesso nome, se ne aggiorna solo la gravità.
-- =========================================================================
INSERT INTO categoria (nome, descrizione, icona, durata_validita_ore, gravita) VALUES
    -- Gravità 3: contro la persona
    ('Aggressione',               'Violenza fisica contro una o più persone',              'hand-fist',          6,  3),
    ('Rissa',                     'Scontro fisico tra più persone',                        'swords',             4,  3),
    ('Rapina',                    'Furto con violenza o minaccia',                         'shield-alert',       6,  3),
    ('Scippo / borseggio',        'Sottrazione di borse, portafogli o telefoni',           'wallet',             6,  3),
    ('Molestie',                  'Molestie verbali o fisiche in luogo pubblico',          'megaphone-off',      6,  3),
    ('Minaccia con arma',         'Persona che mostra o usa un''arma',                     'skull',              4,  3),
    ('Incendio',                  'Fuoco o fumo in atto',                                  'flame',              4,  3),
    -- Gravità 2: patrimonio
    ('Furto',                     'Sottrazione di beni senza violenza',                    'package',            24, 2),
    ('Furto in abitazione',       'Intrusione o furto in un''abitazione o negozio',        'house',              24, 2),
    ('Furto di veicolo',          'Furto o effrazione di auto e moto',                     'car',                24, 2),
    ('Furto di bicicletta',       'Furto di biciclette o monopattini',                     'bike',               24, 2),
    ('Vandalismo',                'Danneggiamento di beni pubblici o privati',             'hammer',             24, 2),
    ('Spaccio',                   'Compravendita di sostanze in strada',                   'pill',               12, 2),
    ('Truffa',                    'Tentativi di raggiro, falsi addetti, truffe porta a porta', 'venetian-mask',  24, 2),
    ('Comportamento sospetto',    'Movimenti o attività anomale nella zona',               'eye',                6,  2),
    -- Gravità 1: degrado urbano e quiete
    ('Disturbo della quiete',     'Rumori molesti, musica ad alto volume',                 'volume-2',           6,  1),
    ('Schiamazzi / alcol molesto','Gruppi rumorosi, consumo molesto di alcol',             'wine',               6,  1),
    ('Rifiuti abbandonati',       'Abbandono di rifiuti o ingombranti',                    'trash-2',            72, 1),
    ('Graffiti',                  'Scritte o imbrattamenti',                               'spray-can',          72, 1),
    ('Illuminazione guasta',      'Lampioni spenti o zone al buio',                        'lightbulb',          72, 1),
    ('Parcheggio abusivo',        'Sosta vietata, passi carrai o posti disabili occupati', 'circle-parking-off', 12, 1),
    ('Animali vaganti',           'Animali randagi o incustoditi',                         'dog',                12, 1)
ON CONFLICT (nome) DO UPDATE SET gravita = EXCLUDED.gravita;
