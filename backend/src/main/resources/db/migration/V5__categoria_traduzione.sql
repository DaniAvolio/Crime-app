-- =========================================================================
-- Traduzioni delle categorie. Nome e descrizione in `categoria` restano in
-- italiano (lingua base e fallback); ogni lingua aggiuntiva ha una riga qui,
-- così aggiungere una lingua non richiede modifiche di schema.
-- =========================================================================
CREATE TABLE categoria_traduzione (
    categoria_id  BIGINT       NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
    lingua        VARCHAR(10)  NOT NULL,
    nome          VARCHAR(100) NOT NULL,
    descrizione   VARCHAR(500),
    PRIMARY KEY (categoria_id, lingua),
    CONSTRAINT uk_categoria_traduzione_nome UNIQUE (lingua, nome)
);

-- =========================================================================
-- Traduzioni inglesi delle categorie predefinite (V4). Le categorie create o
-- rinominate dall'admin vengono ignorate: il JOIN sul nome italiano non le trova.
-- =========================================================================
INSERT INTO categoria_traduzione (categoria_id, lingua, nome, descrizione)
SELECT c.id, 'en', t.nome, t.descrizione
FROM categoria c
JOIN (VALUES
    ('Aggressione',               'Assault',                       'Physical violence against one or more people'),
    ('Rissa',                     'Brawl',                         'Physical fight between several people'),
    ('Rapina',                    'Robbery',                       'Theft with violence or threats'),
    ('Scippo / borseggio',        'Bag snatching / pickpocketing', 'Snatching of bags, wallets or phones'),
    ('Molestie',                  'Harassment',                    'Verbal or physical harassment in a public place'),
    ('Minaccia con arma',         'Armed threat',                  'Person showing or using a weapon'),
    ('Incendio',                  'Fire',                          'Ongoing fire or smoke'),
    ('Furto',                     'Theft',                         'Theft of property without violence'),
    ('Furto in abitazione',       'Burglary',                      'Break-in or theft in a home or shop'),
    ('Furto di veicolo',          'Vehicle theft',                 'Theft of or break-in to cars and motorbikes'),
    ('Furto di bicicletta',       'Bike theft',                    'Theft of bicycles or scooters'),
    ('Vandalismo',                'Vandalism',                     'Damage to public or private property'),
    ('Spaccio',                   'Drug dealing',                  'Street dealing of drugs'),
    ('Truffa',                    'Scam',                          'Fraud attempts, fake workers, door-to-door scams'),
    ('Comportamento sospetto',    'Suspicious activity',           'Unusual movements or activity in the area'),
    ('Disturbo della quiete',     'Noise disturbance',             'Excessive noise, loud music'),
    ('Schiamazzi / alcol molesto','Rowdiness / public drinking',   'Noisy groups, disruptive drinking'),
    ('Rifiuti abbandonati',       'Illegal dumping',               'Dumped waste or bulky items'),
    ('Graffiti',                  'Graffiti',                      'Graffiti or defacement'),
    ('Illuminazione guasta',      'Broken street lighting',        'Street lights out or dark areas'),
    ('Parcheggio abusivo',        'Illegal parking',               'No-parking zones, blocked driveways or disabled spaces taken'),
    ('Animali vaganti',           'Stray animals',                 'Stray or unattended animals')
) AS t(nome_it, nome, descrizione) ON c.nome = t.nome_it
ON CONFLICT DO NOTHING;
