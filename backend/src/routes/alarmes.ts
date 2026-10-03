import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/journee/:journeeId', async (req, res) => {
  try {
    const alarmes = await prisma.alarme.findMany({
      where: { journee_id: req.params.journeeId },
      orderBy: { heure: 'asc' },
    });

    // Date de première apparition : normalement saisie à la main, mais si elle
    // n'a jamais été renseignée pour cette alarme (même tag, ou même désignation si
    // pas de tag) on retombe sur la plus ancienne occurrence connue, tous journées confondues.
    const sansDate = alarmes.filter(a => !a.premiere_apparition);
    const tags = sansDate.filter(a => a.tag).map(a => a.tag as string);
    const designationsSansTag = sansDate.filter(a => !a.tag).map(a => a.designation);

    const candidats = (tags.length || designationsSansTag.length)
      ? await prisma.alarme.findMany({
          where: {
            OR: [
              ...(tags.length ? [{ tag: { in: tags } }] : []),
              ...(designationsSansTag.length ? [{ tag: null, designation: { in: designationsSansTag } }] : []),
            ],
          },
          select: { tag: true, designation: true, premiere_apparition: true, journee: { select: { jour: true } } },
          orderBy: { journee: { jour: 'asc' as const } },
        })
      : [];

    const premiereApparitionCalculee = new Map<string, Date>();
    for (const c of candidats) {
      const cle = c.tag || c.designation;
      const date = c.premiere_apparition ?? c.journee.jour;
      if (!premiereApparitionCalculee.has(cle)) premiereApparitionCalculee.set(cle, date);
    }

    const result = alarmes.map(a => ({
      ...a,
      premiere_apparition: a.premiere_apparition ?? premiereApparitionCalculee.get(a.tag || a.designation) ?? null,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { journee_id, poste_id, tag, designation, equipement, heure, origine, repetitive, premiere_apparition } = req.body;
    const alarme = await prisma.alarme.create({
      data: {
        journee_id,
        poste_id,
        tag,
        designation,
        equipement,
        heure: heure ? new Date(heure) : undefined,
        origine: origine || 'HMI',
        repetitive: repetitive || false,
        premiere_apparition: premiere_apparition ? new Date(premiere_apparition) : undefined,
      },
    });
    res.status(201).json(alarme);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { tag, designation, equipement, heure, origine, repetitive, premiere_apparition } = req.body;
    const alarme = await prisma.alarme.update({
      where: { id: req.params.id },
      data: {
        tag,
        designation,
        equipement,
        heure: heure ? new Date(heure) : undefined,
        origine,
        repetitive,
        premiere_apparition: premiere_apparition ? new Date(premiere_apparition) : premiere_apparition === null ? null : undefined,
      },
    });
    res.json(alarme);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.alarme.delete({ where: { id: req.params.id } });
    res.json({ message: 'Alarme supprimée' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
