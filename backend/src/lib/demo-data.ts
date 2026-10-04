import prisma from './prisma';

// Jeu de données de démonstration — ~60 jours d'historique fictif, pensé pour
// que toutes les pages de l'application (dashboard, analyse, essais, réclamations,
// chat...) aient de quoi afficher une démo convaincante. Aucune valeur n'est
// recopiée d'un relevé réel — tout est généré (bruit + cycle jour/nuit).
const DAYS_BACK = 60;
const DETAIL_DAYS = 14; // relevés toutes les 2h sur les N derniers jours ; au-delà, 2 relevés/jour

function rnd(min: number, max: number) { return min + Math.random() * (max - min); }
function rint(min: number, max: number) { return Math.floor(rnd(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[rint(0, arr.length - 1)]; }
function round(n: number, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }

function dayDate(daysAgo: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
}
function dateAt(daysAgo: number, hour: number, minute = 0) {
  const jour = dayDate(daysAgo).toISOString().slice(0, 10);
  return new Date(`${jour}T${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`);
}

// Puissance active avec cycle jour/nuit (pointe en journée) + bruit
function puissanceAt(hour: number) {
  const base = 96;
  const amp = 20;
  const cycle = Math.sin(((hour - 7) / 24) * 2 * Math.PI) * amp;
  return round(base + cycle + rnd(-3, 3), 1);
}

const PHRASES_MANOEUVRE = [
  'Ordre de démarrage',
  'Allumage de flamme 15,9% TNH',
  'FSNL et couplage de groupe',
  'AGC EN SERVICE',
  'Groupe en production',
  'Groupe sur virage et disponible',
  "Ordre d'arrêt TG",
  'Extinction de flamme 25,3% TNH',
  'FSNL',
  'Couplage de groupe et 20 MW',
  'Groupe sur virage',
  'AGC Hors service',
  'AGC Hors service et PMC',
  'AGC Hors service et PMS',
  'Montée en PMS',
  'Montée en PMC',
  'Baisse de charge à PMC',
];

const TAGS_ALARME = [
  { tag: 'VIB-BB3-HH', designation: 'Vibration palier 3 seuil haut', equipement: 'Turbine', repetitive: false },
  { tag: 'GAZ-FPGI-L', designation: 'Pression gaz skid basse', equipement: 'Skid gaz', repetitive: true },
  { tag: 'TEMP-ECH-H', designation: 'Température échappement seuil haut', equipement: 'Échappement', repetitive: false },
  { tag: 'HUILE-NIV-L', designation: 'Niveau bac huile bas', equipement: 'Graissage', repetitive: true },
  { tag: 'EXC-TENS-H', designation: "Tension d'excitation seuil haut", equipement: 'Alternateur', repetitive: false },
  { tag: 'GAZ-DET-TG', designation: 'Détecteur gaz zone TG — défaut capteur', equipement: 'Détection gaz', repetitive: true },
];

const TRANCHES: { tranche: any; debut: number; fin: number }[] = [
  { tranche: 'h00_07h', debut: 0, fin: 7 },
  { tranche: 'h07_14h', debut: 7, fin: 14 },
  { tranche: 'h14_20h', debut: 14, fin: 20 },
  { tranche: 'h20_00h', debut: 20, fin: 24 },
];

export async function genererDonneesDemo(): Promise<void> {
  const existing = await prisma.journee.count();
  if (existing > 0) throw new Error('DONNEES_PRESENTES');

  const users = await prisma.utilisateur.findMany();
  const byMatricule = Object.fromEntries(users.map((u) => [u.matricule, u]));
  const chefsQuart = users.filter((u) => u.role === 'chef_quart');
  const chefsBloc = users.filter((u) => u.role === 'chef_bloc');
  const operateurs = users.filter((u) => u.role === 'operateur');
  const chefExploitation = byMatricule['80014'];
  const chefMaintenance = byMatricule['80017'];
  const chefCentrale = byMatricule['80013'];
  const mdAssistant = byMatricule['80016'];

  if (!chefExploitation || !mdAssistant || chefsQuart.length === 0 || chefsBloc.length === 0) {
    throw new Error('UTILISATEURS_MANQUANTS');
  }

  console.log(`Génération de ${DAYS_BACK + 1} jours de données de démonstration...`);

  let energieCumulee = 452000; // MWh cumulés, point de départ fictif
  const journeeIds: { id: string; daysAgo: number }[] = [];

  for (let daysAgo = DAYS_BACK; daysAgo >= 0; daysAgo--) {
    const jour = dayDate(daysAgo);
    const isToday = daysAgo === 0;
    const detailed = daysAgo <= DETAIL_DAYS;

    const journee = await prisma.journee.upsert({
      where: { jour },
      update: {},
      create: { jour, statut: isToday ? 'en_cours' : 'transmis' },
    });
    journeeIds.push({ id: journee.id, daysAgo });

    // Rotation des équipes par journée
    const cq = chefsQuart[daysAgo % chefsQuart.length];
    const cb = chefsBloc[daysAgo % chefsBloc.length];
    const op1 = operateurs[daysAgo % operateurs.length];
    const op2 = operateurs[(daysAgo + 1) % operateurs.length];

    const postes: Record<string, string> = {};
    for (const t of TRANCHES) {
      const poste = await prisma.poste.upsert({
        where: { journee_id_tranche: { journee_id: journee.id, tranche: t.tranche } },
        update: {},
        create: {
          journee_id: journee.id,
          tranche: t.tranche,
          debut: dateAt(daysAgo, t.debut),
          fin: dateAt(daysAgo, t.fin === 24 ? 23 : t.fin, t.fin === 24 ? 59 : 0),
          chef_quart_id: cq.id,
          chef_bloc_id: cb.id,
          operateur1_id: op1.id,
          operateur2_id: op2.id,
          statut: isToday ? 'en_cours' : 'valide',
        },
      });
      postes[t.tranche] = poste.id;
    }
    function posteForHour(h: number) {
      const t = TRANCHES.find((t) => h >= t.debut && h < t.fin) ?? TRANCHES[0];
      return postes[t.tranche];
    }

    const slots = detailed ? [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] : [6, 14];
    for (const h of slots) {
      if (isToday && h > new Date().getUTCHours() + 1) continue; // pas de relevés "futurs" pour aujourd'hui

      const puissance = puissanceAt(h);
      const tempAmbiante = round(18 + Math.sin(((h - 13) / 24) * 2 * Math.PI) * 9 + rnd(-1.5, 1.5), 1);

      const releve = await prisma.relevesChefBloc.upsert({
        where: { journee_id_heure_releve: { journee_id: journee.id, heure_releve: dateAt(daysAgo, h) } },
        update: {},
        create: {
          journee_id: journee.id,
          poste_id: posteForHour(h),
          saisi_par: cb.id,
          heure_releve: dateAt(daysAgo, h),
          temp_ambiante_ctim: tempAmbiante,
          pression_atm_afpap: round(rnd(1008, 1016), 1),
          humidite_rhum: round(rnd(40, 70), 0),
          dp_filtre_totale_tfdp: round(rnd(3.5, 5), 2),
          vitesse_turbine_rpm: round(3000 + rnd(-1, 1), 1),
          position_igv_deg: round(rnd(70, 86), 1),
          tension_ligne_kv: round(rnd(224, 227), 2),
          temp_gaz_ftg_tkg: round(rnd(535, 550), 1),
          press_skid_gaz_fpgi: round(rnd(22, 25), 2),
          press_refoul_cpd: round(rnd(10.5, 12), 2),
          temp_entree_comp_ctifr: tempAmbiante,
        },
      });
      await prisma.relevesGenerateur.upsert({
        where: { releve_id: releve.id },
        update: {},
        create: {
          releve_id: releve.id,
          puissance_active_mw: puissance,
          puissance_reactive_mvar: round(rnd(18, 28), 1),
          frequence_hz: round(49.95 + rnd(0, 0.1), 3),
          cos_phi: round(rnd(0.88, 0.95), 3),
          tension_alt_dvx_kv: round(rnd(11, 11.8), 2),
          temp_stator_e_gst1: round(rnd(74, 82), 1),
          temp_stator_f_gst2: round(rnd(74, 82), 1),
        },
      });
      await prisma.relevesVibrations.upsert({
        where: { releve_id: releve.id },
        update: {},
        create: {
          releve_id: releve.id,
          palier1_bb1: round(rnd(1.8, 3.2), 2),
          palier1_bb2: round(rnd(1.8, 3.2), 2),
          palier2_bb3: round(rnd(2.2, 3.8), 2),
          palier3_bb5: round(rnd(2.5, 4.2), 2),
          vibration_maxi: round(rnd(3, 5), 2),
        },
      });
      const ttxm = round(508 + (puissance - 96) * 0.6 + rnd(-3, 3), 1);
      await prisma.relevesEchappement.upsert({
        where: { releve_id: releve.id },
        update: {},
        create: {
          releve_id: releve.id,
          ttxm_moyenne: ttxm,
          ttxspl_ecart: round(rnd(12, 20), 1),
          ttxsp1: round(ttxm + rnd(2, 9), 1),
          ttxsp2: round(ttxm - rnd(2, 9), 1),
          ttxsp3: round(ttxm + rnd(-3, 3), 1),
          ttxd_01: round(ttxm + rnd(-12, 12), 1),
          ttxd_02: round(ttxm + rnd(-12, 12), 1),
        },
      });

      await prisma.relevesOperateur.upsert({
        where: { journee_id_heure_releve: { journee_id: journee.id, heure_releve: dateAt(daysAgo, h) } },
        update: {},
        create: {
          journee_id: journee.id,
          poste_id: posteForHour(h),
          saisi_par: op1.id,
          heure_releve: dateAt(daysAgo, h),
          choix_pompe: pick(['P1', 'P2']),
          pression_refoul_pompe_bar: round(rnd(5.8, 6.6), 2),
          nb_ventilateurs_service: rint(2, 4),
          temp_gaz_ftg_tkg: round(rnd(538, 548), 1),
          pression_gaz_fpgi_bar: round(rnd(23, 25), 2),
          stock_gasoil_l: round(8000 + rnd(-800, 800), 0),
          detecteurs_gaz: { zone_tg: 'normal', zone_aux: 'normal' },
        },
      });
    }

    // Compteurs journaliers — énergie cumulée croissante jour après jour
    const energieJour = round(puissanceAt(13) * 20, 1);
    const e00 = energieCumulee;
    const e24 = energieCumulee + energieJour;
    energieCumulee = e24;
    await prisma.compteursJournaliers.upsert({
      where: { journee_id: journee.id },
      update: {},
      create: {
        journee_id: journee.id,
        energie_active_00h: round(e00, 3),
        energie_active_24h: round(e24, 3),
        auxiliaires_00h: round(e00 * 0.026, 3),
        auxiliaires_24h: round(e24 * 0.026, 3),
        gaz_00h_nm3: round(e00 * 2.13, 2),
        gaz_24h_nm3: round(e24 * 2.13, 2),
        h_flamme_00h: round(45000 + (DAYS_BACK - daysAgo) * 23, 1),
        h_flamme_24h: round(45000 + (DAYS_BACK - daysAgo) * 23 + 24, 1),
        dem_total_00h: 800 + (DAYS_BACK - daysAgo),
        dem_total_24h: 800 + (DAYS_BACK - daysAgo) + 1,
        energie_jour_mwh: round(energieJour * 0.55, 3),
        energie_pointe_mwh: round(energieJour * 0.2, 3),
        energie_nuit_mwh: round(energieJour * 0.25, 3),
        puissance_max_mw: puissanceAt(13),
        heure_puissance_max: '13:00',
        nature_puissance_max: 'BASE',
      },
    });

    // Manœuvres (1 à 3 par jour)
    const nbManoeuvres = rint(1, 3);
    for (let i = 0; i < nbManoeuvres; i++) {
      const h = rint(0, 23);
      await prisma.manouvre.create({
        data: {
          journee_id: journee.id,
          poste_id: posteForHour(h),
          saisi_par: cq.id,
          heure_manouvre: dateAt(daysAgo, h, rint(0, 59)),
          description: pick(PHRASES_MANOEUVRE),
          type_manouvre: 'exploitation',
        },
      });
    }

    // Alarmes (0 à 2 par jour, ~1 jour sur 3)
    if (daysAgo % 3 === 0) {
      const nbAlarmes = rint(1, 2);
      for (let i = 0; i < nbAlarmes; i++) {
        const a = pick(TAGS_ALARME);
        const h = rint(0, 23);
        await prisma.alarme.create({
          data: {
            journee_id: journee.id,
            poste_id: posteForHour(h),
            tag: a.tag,
            designation: a.designation,
            equipement: a.equipement,
            heure: dateAt(daysAgo, h, rint(0, 59)),
            origine: 'HMI',
            repetitive: a.repetitive,
          },
        });
      }
    }

    // Ordres de travaux / demandes de service (environ 1 tous les 5 jours)
    if (daysAgo % 5 === 0) {
      const termine = daysAgo > 10;
      await prisma.ordreTravaux.create({
        data: {
          journee_id: journee.id,
          numero_ot: `OT-26-${String(1000 - daysAgo).padStart(4, '0')}`,
          kks_equipement: `10M${pick(['BA', 'KA', 'BL'])}${rint(10, 40)}AA${rint(100, 999)}`,
          description: pick([
            'Contrôle vibratoire approfondi palier + graissage',
            'Remplacement filtre gaz skid',
            "Vérification armoire d'excitation alternateur",
            'Resserrage connexions électriques auxiliaires',
            'Contrôle détecteurs gaz zone TG',
          ]),
          date_debut: dayDate(daysAgo),
          date_fin: termine ? dayDate(Math.max(daysAgo - 1, 0)) : null,
          etat: termine ? 'termine' : 'en_cours',
          discipline: pick(['mec', 'elec', 'inst']),
          type_maintenance: pick(['curatif', 'systematique', 'preventif']),
        },
      });
    }
    if (daysAgo % 11 === 0) {
      await prisma.demandeService.create({
        data: {
          journee_id: journee.id,
          numero_ds: `DS-26-${String(100 - Math.floor(daysAgo / 11)).padStart(4, '0')}`,
          urgence: rint(1, 3),
          description: pick([
            "Intervention électricité — vérification armoire d'excitation",
            'Appui instrumentation — recalibrage capteur pression',
            'Renfort mécanique — fuite mineure circuit huile',
          ]),
        },
      });
    }
  }

  // Matériels défectueux (indépendants des journées)
  await prisma.materielDefectueux.createMany({
    data: [
      { kks_equipement: '10MBA30CP002', description: 'Fuite mineure huile de graissage palier 4', zone: 'tg', date_declaration: dayDate(6), statut: 'ouvert' },
      { kks_equipement: '10MKA10AA010', description: 'Ventilateur auxiliaire n°1 bruit anormal au démarrage', zone: 'auxiliaires', date_declaration: dayDate(28), date_cloture: dayDate(20), statut: 'cloture' },
      { kks_equipement: '10MBL20CP005', description: "Capteur de niveau réservoir d'expansion dérive", zone: 'auxiliaires', date_declaration: dayDate(45), date_cloture: dayDate(38), statut: 'cloture' },
      { kks_equipement: '10GAA10AA001', description: 'Échauffement anormal enroulement transformateur principal', zone: 'alternateur', date_declaration: dayDate(3), statut: 'ouvert' },
    ],
  });
  console.log('Matériels défectueux : 4 créés.');

  // ── Essais périodiques ──
  const essaisConfig = [
    {
      nom: 'Essai Incendie',
      frequence: 'hebdomadaire' as const,
      jours_semaine: [1], // lundi
      releves: [
        { nom: 'Pression réseau incendie', type: 'valeur' as const, unite: 'bar' },
        { nom: 'Démarrage pompe jockey', type: 'selection' as const, options: ['OK', 'Défaut'] },
        { nom: 'Démarrage pompe principale', type: 'selection' as const, options: ['OK', 'Défaut'] },
      ],
    },
    {
      nom: 'Essai Détection Gaz',
      frequence: 'hebdomadaire' as const,
      jours_semaine: [3], // mercredi
      releves: [
        { nom: 'Détecteur zone TG', type: 'selection' as const, options: ['Normal', 'Alarme simulée OK', 'Défaut'] },
        { nom: 'Détecteur zone auxiliaires', type: 'selection' as const, options: ['Normal', 'Alarme simulée OK', 'Défaut'] },
      ],
    },
    {
      nom: 'Essai Groupe Électrogène de Secours',
      frequence: 'mensuelle' as const,
      jours_semaine: [] as number[],
      releves: [
        { nom: 'Démarrage automatique', type: 'selection' as const, options: ['OK', 'Défaut'] },
        { nom: 'Tension de sortie', type: 'valeur' as const, unite: 'V' },
        { nom: 'Temps de prise de charge', type: 'valeur' as const, unite: 's' },
      ],
    },
    {
      nom: 'Essai Alarme Sonore Générale',
      frequence: 'hebdomadaire' as const,
      jours_semaine: [5], // vendredi
      releves: [
        { nom: 'Niveau sonore perçu', type: 'potentiometre' as const, unite: '%' },
        { nom: 'Fonctionnement déclenché depuis salle de commande', type: 'selection' as const, options: ['OK', 'Défaut'] },
      ],
    },
  ];

  let totalInstances = 0;
  for (const cfg of essaisConfig) {
    const created = await prisma.essaiConfig.create({
      data: {
        nom: cfg.nom,
        frequence: cfg.frequence,
        jours_semaine: cfg.jours_semaine,
        actif: true,
        releves: {
          create: cfg.releves.map((r, i) => ({
            nom: r.nom,
            type: r.type,
            unite: (r as any).unite ?? null,
            options: (r as any).options ?? undefined,
            ordre: i,
          })),
        },
      },
      include: { releves: true },
    });

    for (const { id: journeeId, daysAgo } of journeeIds) {
      const jourDate = dayDate(daysAgo);
      const weekday = jourDate.getUTCDay();
      let due = false;
      if (cfg.frequence === 'hebdomadaire') due = cfg.jours_semaine.includes(weekday);
      else if (cfg.frequence === 'mensuelle') due = jourDate.getUTCDate() <= 7 && weekday === 1;
      if (!due) continue;

      const isToday = daysAgo === 0;
      const statut = isToday ? 'a_faire' : pick(['effectue', 'effectue', 'effectue', 'annule'] as const);
      const valeurs: Record<string, string> = {};
      if (statut === 'effectue') {
        for (const r of created.releves) {
          if (r.type === 'valeur') valeurs[r.id] = String(round(rnd(1, 10), 1));
          else if (r.type === 'potentiometre') valeurs[r.id] = String(rint(60, 100));
          else if (r.type === 'selection') valeurs[r.id] = pick((r.options as string[]) ?? ['OK']);
        }
      }
      await prisma.essaiInstance.create({
        data: {
          essai_id: created.id,
          journee_id: journeeId,
          statut,
          motif_annulation: statut === 'annule' ? 'Reporté — équipe mobilisée sur intervention prioritaire' : null,
          effectue_par: statut === 'effectue' ? chefsQuart[daysAgo % chefsQuart.length].id : null,
          effectue_le: statut === 'effectue' ? dateAt(daysAgo, rint(8, 18)) : null,
          valeurs,
        },
      });
      totalInstances++;
    }
    await prisma.essaiConfig.update({ where: { id: created.id }, data: { derniere_execution: dayDate(0) } });
  }
  console.log(`Essais : ${essaisConfig.length} configurés, ${totalInstances} occurrences historisées.`);

  // ── Consignes ──
  const consignesData = [
    { texte: 'RAS. Maintenir puissance selon programme de charge.', daysAgo: 25, terminee: true },
    { texte: 'Vigilance vibrations palier 3 — surveillance renforcée.', daysAgo: 18, terminee: true },
    { texte: 'Prévenir le chef de bloc avant toute manœuvre sur le skid gaz.', daysAgo: 12, terminee: false },
    { texte: "Ne pas dépasser 110 MW tant que l'OT sur le transformateur n'est pas clôturé.", daysAgo: 3, terminee: false },
    { texte: 'Double vérification du stock gasoil à chaque relève.', daysAgo: 7, terminee: true },
    { texte: 'Signaler toute anomalie détecteur gaz immédiatement au chef de quart.', daysAgo: 1, terminee: false },
  ];
  for (const c of consignesData) {
    await prisma.consigne.create({
      data: {
        texte: c.texte,
        terminee: c.terminee,
        cree_par: chefExploitation.id,
        date: dateAt(c.daysAgo, 8),
      },
    });
  }
  console.log(`Consignes : ${consignesData.length} créées.`);

  // ── Réclamations & Assistance MD Center ──
  const reclamationsData: {
    titre: string; description: string; daysAgo: number; cloturee: boolean;
    echanges: { md: boolean; texte: string }[]; motifCloture?: string;
  }[] = [
    {
      titre: 'Vanne de régulation gaz bloquée en position intermédiaire',
      description: "La vanne de régulation sur le skid gaz ne répond plus correctement aux consignes — position figée observée depuis le dernier relevé. Besoin d'une assistance pour diagnostic à distance avant intervention sur site.",
      daysAgo: 9,
      cloturee: true,
      echanges: [
        { md: true, texte: "Pouvez-vous vérifier l'alimentation pneumatique de l'actionneur et nous envoyer la courbe de position sur les dernières 24h ?" },
        { md: false, texte: "Alimentation pneumatique nominale. Courbe transmise par ailleurs — la vanne décroche vers 40% d'ouverture." },
        { md: true, texte: "Ça ressemble à un positionneur défaillant. Programmez un remplacement, pas de risque immédiat si vous restez en dessous de 60% de charge." },
      ],
      motifCloture: 'Positionneur remplacé, vanne re-testée et fonctionnelle.',
    },
    {
      titre: 'Dérive capteur de niveau réservoir expansion',
      description: 'Le capteur de niveau indique une valeur incohérente avec le contrôle visuel. Demande de validation avant de lancer un appoint.',
      daysAgo: 5,
      cloturee: false,
      echanges: [
        { md: true, texte: 'Merci de nous envoyer la référence exacte du capteur, on vérifie si un recalibrage à distance est possible.' },
        { md: false, texte: 'Référence envoyée par e-mail. En attente de votre retour avant de toucher au réglage.' },
      ],
    },
    {
      titre: 'Demande de retour sur plan de maintenance préventive T4',
      description: 'Avant de valider le planning du prochain trimestre, nous aimerions un avis MD Center sur les priorités compte tenu des heures de fonctionnement actuelles.',
      daysAgo: 15,
      cloturee: true,
      echanges: [
        { md: true, texte: 'Plan reçu. Priorisez le contrôle vibratoire palier 3 et le remplacement filtre gaz — le reste peut glisser sans risque.' },
        { md: false, texte: 'Bien reçu, plan ajusté en conséquence. Merci.' },
      ],
      motifCloture: 'Plan de maintenance validé avec les ajustements proposés.',
    },
    {
      titre: 'Échauffement anormal transformateur principal',
      description: "Température enroulement en hausse constante sur les derniers relevés, sans cause identifiée côté charge. Besoin d'un avis rapide.",
      daysAgo: 2,
      cloturee: false,
      echanges: [
        { md: true, texte: 'Surveillez toutes les heures et envoyez les valeurs. Vérifiez aussi le fonctionnement des ventilateurs de refroidissement.' },
        { md: false, texte: 'Ventilateurs OK. Température stable depuis 3h, on continue la surveillance rapprochée.' },
        { md: true, texte: "Bien. Si ça dépasse le seuil d'alarme, déclenchez la procédure de délestage préventif sans attendre notre retour." },
      ],
    },
    {
      titre: 'Bruit anormal ventilateur auxiliaire n°1',
      description: "Bruit inhabituel au démarrage, intermittent. Pas d'impact mesuré sur les paramètres pour l'instant.",
      daysAgo: 30,
      cloturee: true,
      echanges: [
        { md: true, texte: 'Pouvez-vous enregistrer un court extrait audio et le joindre ici ?' },
        { md: false, texte: 'Fait — ça semble venir du roulement. On programme un contrôle.' },
      ],
      motifCloture: 'Roulement contrôlé et graissé, bruit disparu.',
    },
  ];

  for (const r of reclamationsData) {
    const reclamation = await prisma.reclamation.create({
      data: {
        titre: r.titre,
        description: r.description,
        demandeur_id: chefExploitation.id,
        statut: r.cloturee ? 'cloturee' : r.echanges.length > 0 ? 'en_cours' : 'ouverte',
        cree_le: dateAt(r.daysAgo, 9),
        modifie_le: dateAt(Math.max(r.daysAgo - 1, 0), 9),
        ...(r.cloturee && {
          cloture_par: pick([chefExploitation.id, mdAssistant.id]),
          cloture_le: dateAt(Math.max(r.daysAgo - 2, 0), 16),
          motif_cloture: r.motifCloture,
        }),
      },
    });
    let h = 10;
    for (const e of r.echanges) {
      await prisma.reclamationCommentaire.create({
        data: {
          reclamation_id: reclamation.id,
          auteur_id: e.md ? mdAssistant.id : chefExploitation.id,
          contenu: e.texte,
          cree_le: dateAt(Math.max(r.daysAgo - 1, 0), (h += 2)),
        },
      });
    }
  }
  console.log(`Réclamations : ${reclamationsData.length} créées avec fils de discussion.`);

  // ── Messagerie interne ──
  const messagesData: { from: string; to: string; daysAgo: number; hour: number; texte: string }[] = [
    { from: chefExploitation.id, to: chefMaintenance.id, daysAgo: 4, hour: 9, texte: 'Bonjour, où en est le remplacement du positionneur sur la vanne gaz ?' },
    { from: chefMaintenance.id, to: chefExploitation.id, daysAgo: 4, hour: 9, texte: 'Pièce reçue ce matin, intervention prévue demain en poste du matin.' },
    { from: chefExploitation.id, to: chefMaintenance.id, daysAgo: 4, hour: 10, texte: 'Parfait, merci pour le retour rapide.' },
    { from: chefCentrale.id, to: chefExploitation.id, daysAgo: 2, hour: 15, texte: 'Peux-tu me faire un point rapide sur la charge de la semaine avant le comité ?' },
    { from: chefExploitation.id, to: chefCentrale.id, daysAgo: 2, hour: 15, texte: "Oui, je t'envoie ça en fin de journée avec les chiffres des compteurs." },
    { from: chefsQuart[0].id, to: chefsBloc[0].id, daysAgo: 1, hour: 6, texte: 'RAS pour la relève, rien à signaler de la nuit.' },
    { from: chefsBloc[0].id, to: chefsQuart[0].id, daysAgo: 1, hour: 6, texte: 'Bien reçu, bonne journée.' },
  ];
  for (const m of messagesData) {
    await prisma.message.create({
      data: { expediteur_id: m.from, destinataire_id: m.to, contenu: m.texte, cree_le: dateAt(m.daysAgo, m.hour), lu: m.daysAgo > 0 },
    });
  }
  console.log(`Messagerie : ${messagesData.length} messages créés.`);

  console.log(`\nDonnées de démonstration générées avec succès (${DAYS_BACK + 1} jours, du ${dayDate(DAYS_BACK).toISOString().slice(0, 10)} à aujourd'hui).`);
}

