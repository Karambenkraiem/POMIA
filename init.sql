-- ============================================================
-- SCHEMA POSTGRESQL - APPLICATION POMIA
-- Plateforme des Operations, Maintenance, Information et Analyse
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TYPES ENUMERES
-- ============================================================

CREATE TYPE role_utilisateur AS ENUM (
    'operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'
);

CREATE TYPE tranche_horaire AS ENUM (
    '00h_07h', '07h_14h', '14h_20h', '20h_00h'
);

CREATE TYPE statut_journee AS ENUM (
    'en_cours', 'valide_bloc', 'valide_quart', 'transmis'
);

CREATE TYPE statut_poste AS ENUM (
    'en_cours', 'termine', 'valide'
);

CREATE TYPE type_manouvre AS ENUM (
    'exploitation', 'entretien', 'permutation', 'agc', 'incident'
);

CREATE TYPE nature_puissance AS ENUM (
    'PMC', 'AGC', 'PMS', 'PRESELECT', 'BASE'
);

CREATE TYPE etat_ot AS ENUM (
    'en_cours', 'termine', 'reporte', 'annule'
);

CREATE TYPE discipline_ot AS ENUM (
    'mec', 'elec', 'inst', 'civil', 'autre'
);

CREATE TYPE type_maintenance AS ENUM (
    'curatif', 'systematique', 'preventif'
);

CREATE TYPE zone_materiel AS ENUM (
    'site', 'tg', 'alternateur', 'auxiliaires'
);

CREATE TYPE statut_defaut AS ENUM (
    'ouvert', 'en_cours', 'cloture'
);

-- ============================================================
-- TABLE UTILISATEURS
-- ============================================================

CREATE TABLE utilisateurs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    matricule       VARCHAR(20) UNIQUE NOT NULL,
    role            role_utilisateur NOT NULL,
    mot_de_passe_hash TEXT NOT NULL,
    actif           BOOLEAN DEFAULT TRUE,
    cree_le         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modifie_le      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE JOURNEES (1 par jour calendaire)
-- ============================================================

CREATE TABLE journees (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jour                    DATE NOT NULL UNIQUE,
    statut                  statut_journee DEFAULT 'en_cours',
    consignes_permanentes   TEXT,
    valide_bloc_par         UUID REFERENCES utilisateurs(id),
    valide_bloc_le          TIMESTAMP WITH TIME ZONE,
    valide_quart_par        UUID REFERENCES utilisateurs(id),
    valide_quart_le         TIMESTAMP WITH TIME ZONE,
    transmis_le             TIMESTAMP WITH TIME ZONE,
    cree_le                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE POSTES (4 tranches par journee)
-- ============================================================

CREATE TABLE postes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id      UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    tranche         tranche_horaire NOT NULL,
    debut           TIMESTAMP WITH TIME ZONE NOT NULL,
    fin             TIMESTAMP WITH TIME ZONE NOT NULL,
    chef_quart_id   UUID REFERENCES utilisateurs(id),
    chef_bloc_id    UUID REFERENCES utilisateurs(id),
    operateur1_id   UUID REFERENCES utilisateurs(id),
    operateur2_id   UUID REFERENCES utilisateurs(id),
    statut          statut_poste DEFAULT 'en_cours',
    UNIQUE(journee_id, tranche)
);

-- ============================================================
-- TABLE RELEVES CHEF DE BLOC (toutes les 2h)
-- ============================================================

CREATE TABLE releves_chef_bloc (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id              UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    poste_id                UUID NOT NULL REFERENCES postes(id),
    saisi_par               UUID NOT NULL REFERENCES utilisateurs(id),
    heure_releve            TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Conditions ambiantes
    temp_ambiante_ctim      NUMERIC(6,2),
    pression_atm_afpap      NUMERIC(8,2),
    humidite_rhum           NUMERIC(5,2),
    dp_filtre_totale_tfdp   NUMERIC(7,2),
    dp_admis_comp_csdp      NUMERIC(7,2),
    dp_admission_afpcs      NUMERIC(7,2),
    temp_tunnel_ttib1       NUMERIC(6,2),
    temp_air_atomisation    NUMERIC(6,2),
    vitesse_turbine_rpm     NUMERIC(8,2),
    position_tmgv_deg       NUMERIC(6,3),
    position_igv_deg        NUMERIC(6,3),
    tension_ligne_kv        NUMERIC(7,3),
    -- Circuit refrigeration
    temp_entree_aeroref_wtad    NUMERIC(6,2),
    temp_sortie_aeroref_wtad    NUMERIC(6,2),
    temp_patte_turbine1_wttl1   NUMERIC(6,2),
    temp_patte_turbine2_wttl2   NUMERIC(6,2),
    -- Circuit gaz
    temp_gaz_ftg_tkg        NUMERIC(6,2),
    press_skid_gaz_fpgi     NUMERIC(7,3),
    press_avant_srv_fgup    NUMERIC(7,3),
    press_inter_vanne_fpg2  NUMERIC(7,3),
    debit_massique_fqgm     NUMERIC(8,3),
    signal_reference_fsr    NUMERIC(6,2),
    -- Compresseur axial
    press_refoul_cpd        NUMERIC(7,3),
    temp_entree_comp_ctifr  NUMERIC(6,2),
    temp_sortie_ctd         NUMERIC(6,2),
    debit_massique_comp     NUMERIC(8,3),
    synced                  BOOLEAN DEFAULT FALSE,
    cree_le                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(journee_id, heure_releve)
);

-- ============================================================
-- TABLE RELEVES GENERATEUR
-- ============================================================

CREATE TABLE releves_generateur (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id               UUID NOT NULL REFERENCES releves_chef_bloc(id) ON DELETE CASCADE,
    puissance_active_mw     NUMERIC(7,2),
    puissance_reactive_mvar NUMERIC(7,2),
    frequence_hz            NUMERIC(6,3),
    cos_phi                 NUMERIC(5,3),
    tension_alt_dvx_kv      NUMERIC(7,3),
    tension_svlx_kv         NUMERIC(7,3),
    tension_excitation_v    NUMERIC(8,2),
    courant_excitation_a    NUMERIC(8,2),
    temp_air_froid_a_gca1   NUMERIC(6,2),
    temp_air_froid_b_gca2   NUMERIC(6,2),
    temp_air_chaud_c_gha1   NUMERIC(6,2),
    temp_air_chaud_d_gha2   NUMERIC(6,2),
    temp_stator_e_gst1      NUMERIC(6,2),
    temp_stator_f_gst2      NUMERIC(6,2),
    temp_stator_g_gst3      NUMERIC(6,2),
    temp_stator_h_gst4      NUMERIC(6,2),
    temp_stator_i_gst5      NUMERIC(6,2),
    temp_stator_j_gst6      NUMERIC(6,2),
    temp_stator_k_gst7      NUMERIC(6,2),
    temp_stator_l_gst8      NUMERIC(6,2),
    temp_stator_m_gst9      NUMERIC(6,2),
    temp_air_excitation_gext NUMERIC(6,2)
);

-- ============================================================
-- TABLE RELEVES HUILE DE GRAISSAGE
-- ============================================================

CREATE TABLE releves_huile (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id               UUID NOT NULL REFERENCES releves_chef_bloc(id) ON DELETE CASCADE,
    niveau_bac_huile_mm     NUMERIC(7,2),
    pression_qap3_bar       NUMERIC(6,3),
    pression_palier5_qgp    NUMERIC(6,3),
    temp_collecteur_ltth    NUMERIC(6,2),
    temp_cuve1_ltot1        NUMERIC(6,2),
    temp_cuve2_ltot2        NUMERIC(6,2),
    temp_butee_ltbt1d       NUMERIC(6,2),
    temp_palier1_ltb1d      NUMERIC(6,2),
    temp_palier2_ltb2d      NUMERIC(6,2),
    temp_palier3_ltb3d      NUMERIC(6,2),
    temp_palier4_lttg1d     NUMERIC(6,2),
    temp_palier5_ltg2d      NUMERIC(6,2),
    press_pompe_hp_attelee  NUMERIC(6,3),
    press_pompe_hp_elec     NUMERIC(6,3)
);

-- ============================================================
-- TABLE RELEVES VIBRATIONS
-- ============================================================

CREATE TABLE releves_vibrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id       UUID NOT NULL REFERENCES releves_chef_bloc(id) ON DELETE CASCADE,
    palier1_bb1     NUMERIC(6,3),
    palier1_bb2     NUMERIC(6,3),
    palier2_bb3     NUMERIC(6,3),
    palier2_bb4     NUMERIC(6,3),
    palier3_bb5     NUMERIC(6,3),
    palier4_bb10    NUMERIC(6,3),
    palier4_bb11    NUMERIC(6,3),
    palier1_bb12    NUMERIC(6,3),
    vibration_maxi  NUMERIC(6,3)
);

-- ============================================================
-- TABLE THERMOCOUPLES D'ECHAPPEMENT (24 TC + spread auto)
-- ============================================================

CREATE TABLE releves_echappement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id       UUID NOT NULL REFERENCES releves_chef_bloc(id) ON DELETE CASCADE,
    ttxm_moyenne    NUMERIC(7,2),
    ttxspl_ecart    NUMERIC(7,2),
    ttxsp1          NUMERIC(7,2),
    ttxsp2          NUMERIC(7,2),
    ttxsp3          NUMERIC(7,2),
    ttxd_01         NUMERIC(7,2),
    ttxd_02         NUMERIC(7,2),
    ttxd_03         NUMERIC(7,2),
    ttxd_04         NUMERIC(7,2),
    ttxd_05         NUMERIC(7,2),
    ttxd_06         NUMERIC(7,2),
    ttxd_07         NUMERIC(7,2),
    ttxd_08         NUMERIC(7,2),
    ttxd_09         NUMERIC(7,2),
    ttxd_10         NUMERIC(7,2),
    ttxd_11         NUMERIC(7,2),
    ttxd_12         NUMERIC(7,2),
    ttxd_13         NUMERIC(7,2),
    ttxd_14         NUMERIC(7,2),
    ttxd_15         NUMERIC(7,2),
    ttxd_16         NUMERIC(7,2),
    ttxd_17         NUMERIC(7,2),
    ttxd_18         NUMERIC(7,2),
    ttxd_19         NUMERIC(7,2),
    ttxd_20         NUMERIC(7,2),
    ttxd_21         NUMERIC(7,2),
    ttxd_22         NUMERIC(7,2),
    ttxd_23         NUMERIC(7,2),
    ttxd_24         NUMERIC(7,2),
    spread_calcule  NUMERIC(7,2) GENERATED ALWAYS AS (
        GREATEST(ttxd_01,ttxd_02,ttxd_03,ttxd_04,ttxd_05,ttxd_06,
                 ttxd_07,ttxd_08,ttxd_09,ttxd_10,ttxd_11,ttxd_12,
                 ttxd_13,ttxd_14,ttxd_15,ttxd_16,ttxd_17,ttxd_18,
                 ttxd_19,ttxd_20,ttxd_21,ttxd_22,ttxd_23,ttxd_24)
        - LEAST(ttxd_01,ttxd_02,ttxd_03,ttxd_04,ttxd_05,ttxd_06,
                ttxd_07,ttxd_08,ttxd_09,ttxd_10,ttxd_11,ttxd_12,
                ttxd_13,ttxd_14,ttxd_15,ttxd_16,ttxd_17,ttxd_18,
                ttxd_19,ttxd_20,ttxd_21,ttxd_22,ttxd_23,ttxd_24)
    ) STORED
);

-- ============================================================
-- TABLE TEMPERATURES METAL BLANC ET INTER-ROUES
-- ============================================================

CREATE TABLE releves_metal_blanc (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    releve_id       UUID NOT NULL REFERENCES releves_chef_bloc(id) ON DELETE CASCADE,
    btta1_2         NUMERIC(6,2),
    btta1_5         NUMERIC(6,2),
    btta1_8         NUMERIC(6,2),
    btti1_2         NUMERIC(6,2),
    btti1_5         NUMERIC(6,2),
    btti1_9         NUMERIC(6,2),
    btj1_1          NUMERIC(6,2),
    btj1_2          NUMERIC(6,2),
    btj2_1          NUMERIC(6,2),
    btj2_2          NUMERIC(6,2),
    btj3_1          NUMERIC(6,2),
    btj3_2          NUMERIC(6,2),
    btgj1_1_p4      NUMERIC(6,2),
    btgj1_1_p5      NUMERIC(6,2),
    ttws1fi1        NUMERIC(6,2),
    ttws1fi2        NUMERIC(6,2),
    ttws1_01        NUMERIC(6,2),
    ttws1_02        NUMERIC(6,2),
    ttws2f01        NUMERIC(6,2),
    ttws2f02        NUMERIC(6,2),
    ttws2a01        NUMERIC(6,2),
    ttws2a02        NUMERIC(6,2),
    ttws3f01        NUMERIC(6,2),
    ttws3f02        NUMERIC(6,2),
    ttws3a01        NUMERIC(6,2),
    ttws3a02        NUMERIC(6,2)
);

-- ============================================================
-- TABLE RELEVES OPERATEUR (toutes les 2h)
-- ============================================================

CREATE TABLE releves_operateur (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id                  UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    poste_id                    UUID NOT NULL REFERENCES postes(id),
    saisi_par                   UUID NOT NULL REFERENCES utilisateurs(id),
    heure_releve                TIMESTAMP WITH TIME ZONE NOT NULL,
    choix_pompe                 VARCHAR(10),
    pression_refoul_pompe_bar   NUMERIC(6,3),
    nb_ventilateurs_service     SMALLINT,
    temp_entree_ref_wtad1       NUMERIC(6,2),
    temp_sortie_ref_wtad2       NUMERIC(6,2),
    pression_retour_eau_ref     NUMERIC(6,3),
    pression_sortie_ref_alt     NUMERIC(6,3),
    niveau_reservoir_expansion  NUMERIC(6,2),
    temp_gaz_ftg_tkg            NUMERIC(6,2),
    pression_gaz_fpgi_bar       NUMERIC(6,3),
    dp_filtre_gaz_bar           NUMERIC(6,3),
    pression_entree_skid        NUMERIC(6,3),
    dp_filtre_gasoil_bar        NUMERIC(6,3),
    niveau_huile_reservoir      NUMERIC(6,2),
    choix_filtre_huile          VARCHAR(10),
    choix_refrigerant_huile     VARCHAR(10),
    pression_air_atomisation    NUMERIC(6,3),
    dp_totale_filtre_kpa        NUMERIC(7,3),
    dp_pre_filtre_kpa           NUMERIC(7,3),
    dp_filtre_kpa               NUMERIC(7,3),
    pression_air_comprime_bar   NUMERIC(6,3),
    temp_huile_tp               NUMERIC(6,2),
    temp_enroulement_tp         NUMERIC(6,2),
    niv_conservateur_tp         NUMERIC(6,2),
    choix_ventilateur_tp        VARCHAR(10),
    temp_huile_ts               NUMERIC(6,2),
    temp_enroulement_ts         NUMERIC(6,2),
    niv_conservateur_ts         NUMERIC(6,2),
    pression_circuit_incendie   NUMERIC(6,3),
    niveau_gasoil_ppe_pct       NUMERIC(5,2),
    pompe_jockey                VARCHAR(10),
    compteur_gasoil_ge_l        NUMERIC(10,2),
    compteur_energie_ge_kwh     NUMERIC(12,2),
    stock_gasoil_l              NUMERIC(10,2),
    temp_huile_graissage_ge     NUMERIC(6,2),
    pression_huile_graissage_ge NUMERIC(6,3),
    temp_eau_primaire_ge        NUMERIC(6,2),
    temp_eau_secondaire_ge      NUMERIC(6,2),
    pression_air_demarrage_ge   NUMERIC(6,3),
    nb_heures_marche_ge         NUMERIC(8,2),
    detecteurs_gaz              JSONB DEFAULT '{}',
    energie_active_index_0h     NUMERIC(12,3),
    energie_active_index_24h    NUMERIC(12,3),
    reactif_absorbe_0h          NUMERIC(12,3),
    reactif_absorbe_24h         NUMERIC(12,3),
    reactif_fourni_0h           NUMERIC(12,3),
    reactif_fourni_24h          NUMERIC(12,3),
    conso_aux_ht_tag_0h         NUMERIC(12,3),
    conso_aux_ht_tag_24h        NUMERIC(12,3),
    conso_aux_ht_site_0h        NUMERIC(12,3),
    conso_aux_ht_site_24h       NUMERIC(12,3),
    gasoil_0h_l                 NUMERIC(10,2),
    gasoil_24h_l                NUMERIC(10,2),
    consignes_particulieres     TEXT,
    synced                      BOOLEAN DEFAULT FALSE,
    cree_le                     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(journee_id, heure_releve, saisi_par)
);

-- ============================================================
-- TABLE COMPTEURS JOURNALIERS
-- ============================================================

CREATE TABLE compteurs_journaliers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id                  UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE UNIQUE,
    energie_active_00h          NUMERIC(12,3),
    energie_active_07h          NUMERIC(12,3),
    energie_active_18h          NUMERIC(12,3),
    energie_active_22h          NUMERIC(12,3),
    energie_active_24h          NUMERIC(12,3),
    reactif_fourni_00h          NUMERIC(12,3),
    reactif_fourni_24h          NUMERIC(12,3),
    reactif_absorbe_00h         NUMERIC(12,3),
    reactif_absorbe_24h         NUMERIC(12,3),
    auxiliaires_00h             NUMERIC(12,3),
    auxiliaires_07h             NUMERIC(12,3),
    auxiliaires_18h             NUMERIC(12,3),
    auxiliaires_22h             NUMERIC(12,3),
    auxiliaires_24h             NUMERIC(12,3),
    gaz_00h_nm3                 NUMERIC(14,2),
    gaz_24h_nm3                 NUMERIC(14,2),
    gasoil_00h_l                NUMERIC(10,2),
    gasoil_24h_l                NUMERIC(10,2),
    h_flamme_00h                NUMERIC(8,1),
    h_flamme_24h                NUMERIC(8,1),
    h_pms_00h                   NUMERIC(8,1),
    h_pms_24h                   NUMERIC(8,1),
    h_gaz_00h                   NUMERIC(8,1),
    h_gaz_24h                   NUMERIC(8,1),
    h_gasoil_00h                NUMERIC(8,1),
    h_gasoil_24h                NUMERIC(8,1),
    dem_manuel_00h              INTEGER,
    dem_manuel_24h              INTEGER,
    dem_total_00h               INTEGER,
    dem_total_24h               INTEGER,
    dem_rapide_00h              INTEGER,
    dem_rapide_24h              INTEGER,
    allumage_00h                INTEGER,
    allumage_24h                INTEGER,
    declenchement_00h           INTEGER,
    declenchement_24h           INTEGER,
    energie_jour_mwh            NUMERIC(10,3),
    energie_pointe_mwh          NUMERIC(10,3),
    energie_nuit_mwh            NUMERIC(10,3),
    puissance_max_mw            NUMERIC(7,2),
    heure_puissance_max         VARCHAR(6),
    temp_amb_puissance_max      NUMERIC(5,1),
    nature_puissance_max        nature_puissance,
    conso_aux_couplage          NUMERIC(12,3),
    conso_aux_decouplage        NUMERIC(12,3),
    cree_le                     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE MANOEUVRES D'EXPLOITATION
-- ============================================================

CREATE TABLE manouvres (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id      UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    poste_id        UUID REFERENCES postes(id),
    saisi_par       UUID NOT NULL REFERENCES utilisateurs(id),
    heure_manouvre  TIMESTAMP WITH TIME ZONE NOT NULL,
    description     TEXT NOT NULL,
    type_manouvre   type_manouvre DEFAULT 'exploitation',
    feuille_numero  SMALLINT DEFAULT 1 CHECK (feuille_numero IN (1, 2)),
    cree_le         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE ALARMES
-- ============================================================

CREATE TABLE alarmes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id      UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    poste_id        UUID REFERENCES postes(id),
    tag             VARCHAR(50),
    designation     TEXT NOT NULL,
    heure           TIMESTAMP WITH TIME ZONE,
    origine         VARCHAR(20) DEFAULT 'HMI',
    repetitive      BOOLEAN DEFAULT FALSE,
    cree_le         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE ORDRES DE TRAVAUX
-- ============================================================

CREATE TABLE ordres_travaux (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id          UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    numero_ot           VARCHAR(20),
    kks_equipement      VARCHAR(50),
    description         TEXT NOT NULL,
    date_debut          DATE,
    date_fin            DATE,
    etat                etat_ot DEFAULT 'en_cours',
    discipline          discipline_ot,
    type_maintenance    type_maintenance NOT NULL,
    cree_le             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE DEMANDES DE SERVICE
-- ============================================================

CREATE TABLE demandes_service (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journee_id      UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    numero_ds       VARCHAR(20) UNIQUE,
    urgence         SMALLINT CHECK (urgence BETWEEN 1 AND 4),
    description     TEXT NOT NULL,
    cree_le         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE MATERIELS DEFECTUEUX
-- ============================================================

CREATE TABLE materiels_defectueux (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kks_equipement      VARCHAR(50) NOT NULL,
    description         TEXT NOT NULL,
    zone                zone_materiel NOT NULL,
    date_declaration    DATE NOT NULL,
    date_cloture        DATE,
    commentaires        TEXT,
    statut              statut_defaut DEFAULT 'ouvert',
    actif               BOOLEAN GENERATED ALWAYS AS (date_cloture IS NULL) STORED,
    cree_le             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modifie_le          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLE SEUILS D'ALERTE
-- ============================================================

CREATE TABLE seuils_alarme (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parametre       VARCHAR(100) NOT NULL UNIQUE,
    valeur_min      NUMERIC(10,3),
    valeur_max      NUMERIC(10,3),
    unite           VARCHAR(20),
    description     TEXT,
    actif           BOOLEAN DEFAULT TRUE,
    modifie_par     UUID REFERENCES utilisateurs(id),
    modifie_le      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO seuils_alarme (parametre, valeur_min, valeur_max, unite, description) VALUES
('spread_echappement',    NULL,   50,    '°C',   'Ecart max entre thermocouples echappement'),
('vibration_maxi',        NULL,   25,    'mm/s', 'Vibration maximale admissible paliers'),
('temp_metal_blanc_max',  NULL,   110,   '°C',   'Temperature metal blanc paliers'),
('temp_inter_roue_ecart', NULL,   30,    '°C',   'Ecart temperature inter-roues'),
('pression_gaz_min',      10,     NULL,  'bar',  'Pression gaz minimale skid'),
('puissance_max_tg',      NULL,   130,   'MW',   'Puissance maximale turbine');

-- ============================================================
-- INDEX DE PERFORMANCE
-- ============================================================

CREATE INDEX idx_releves_bloc_journee    ON releves_chef_bloc(journee_id);
CREATE INDEX idx_releves_bloc_heure      ON releves_chef_bloc(heure_releve);
CREATE INDEX idx_releves_op_journee      ON releves_operateur(journee_id);
CREATE INDEX idx_releves_op_heure        ON releves_operateur(heure_releve);
CREATE INDEX idx_postes_journee          ON postes(journee_id);
CREATE INDEX idx_manouvres_journee       ON manouvres(journee_id);
CREATE INDEX idx_alarmes_journee         ON alarmes(journee_id);
CREATE INDEX idx_alarmes_tag             ON alarmes(tag);
CREATE INDEX idx_ot_journee              ON ordres_travaux(journee_id);
CREATE INDEX idx_defauts_actif           ON materiels_defectueux(actif);
CREATE INDEX idx_journees_jour           ON journees(jour);

-- ============================================================
-- VUE RECAPITULATIF JOURNALIER CHEF DE QUART
-- ============================================================

CREATE VIEW vue_section9_chef_quart AS
SELECT
    j.jour,
    j.id AS journee_id,
    cj.puissance_max_mw,
    cj.heure_puissance_max,
    cj.nature_puissance_max,
    cj.h_flamme_24h - cj.h_flamme_00h           AS heures_flamme_jour,
    cj.dem_total_24h - cj.dem_total_00h          AS demarrages_24h,
    cj.h_pms_24h - cj.h_pms_00h                 AS heures_pms_jour,
    cj.declenchement_24h - cj.declenchement_00h  AS declenchements_24h,
    cj.gaz_24h_nm3 - cj.gaz_00h_nm3             AS conso_gaz_nm3,
    cj.gasoil_24h_l - cj.gasoil_00h_l           AS conso_gasoil_l,
    cj.energie_active_24h - cj.energie_active_00h AS production_brute_mwh,
    (cj.auxiliaires_24h - cj.auxiliaires_00h) / 1000.0 AS conso_aux_mwh,
    (cj.energie_active_24h - cj.energie_active_00h)
        - (cj.auxiliaires_24h - cj.auxiliaires_00h) / 1000.0 AS production_nette_mwh
FROM journees j
LEFT JOIN compteurs_journaliers cj ON cj.journee_id = j.id;
