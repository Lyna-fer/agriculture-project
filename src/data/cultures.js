import { Carrot, Wheat, Apple } from "lucide-react";

export const CULTURES = [
  {
    id: 1,

    // ───────────── IDENTITÉ ─────────────
    name: "Cultures Maraîchères",
    nameShort: "Maraîchères",

    icon: Carrot,
    iconColor: "#e68a00",
    iconEmoji: "🥕",

    // ───────────── DESIGN ─────────────
    color: "#4a7c2f",
    colorLight: "rgba(74,124,47,0.1)",

    // ───────────── INFOS ─────────────
    examples: "Tomates, carottes, pommes de terre, légumes...",
    desc: "Tomates · Carottes · Courgettes · Pommes de terre",

    // ───────────── ÉCHANTILLONNAGE ─────────────
    sampleFormula: (ha) => {
      const calcul = Math.ceil(8 + 3 * Math.sqrt(ha));
      return Math.min(25, calcul);
    },
    sampleNote: "Précision renforcée — Max 25 points",

    // ───────────── PATTERN ─────────────
    pattern: "zigzag",
    patternLabel: "Zigzag",
    patternAlt: "grille",
    patternAltLabel: "Grille",

    // ───────────── PROFONDEURS ─────────────
    depths: [
      {
        label: "0 – 20 cm",
        color: "#5C3D1E",
        desc: "Horizon A — Zone racinaire principale",
        priority: true,
      },
      {
        label: "20 – 40 cm",
        color: "#8B6045",
        desc: "Horizon B — Réservoirs nutritifs",
        priority: false,
      },
    ],

    // ───────────── MÉTHODOLOGIE ─────────────
    timing: "2–4 semaines avant plantation",
    freq: "Chaque saison",

    gear: [
      "Tarière ou sonde pédologique",
      "Sacs kraft numérotés",
      "Étiquettes et marqueur",
      "GPS (Smartphone)",
      "Gants de protection",
    ],

    steps: [
      {
        title: "Matériel requis",
        text: "Tarière ou sonde pédologique, sacs kraft, étiquettes, GPS.",
      },
      {
        title: "Nombre d'échantillons",
        text: "Minimum 8 prélèvements par hectare.",
      },
      {
        title: "Profondeur",
        text: "0–20 cm (principal), 20–40 cm si nécessaire.",
      },
      {
        title: "Timing",
        text: "2–4 semaines avant plantation.",
      },
      {
        title: "Composition",
        text: "Mélanger 20–25 sous-prélèvements.",
      },
      {
        title: "Envoi",
        text: "Sécher 24h et envoyer sous 5 jours.",
      },
    ],

    alerts: [
      "Évitez après fertilisation récente (<3 semaines)",
      "Ne pas prélever dans zones atypiques",
    ],
  },

  {
    id: 2,

    name: "Cultures Céréalières",
    nameShort: "Céréalières",

    icon: Wheat,
    iconColor: "#a39e00",
    iconEmoji: "🌾",

    color: "#c8a84b",
    colorLight: "rgba(200,168,75,0.12)",

    examples: "Blé, orge, maïs, sorgho...",
    desc: "Blé dur · Orge · Maïs · Avoine",

    sampleFormula: (ha) => {
      const calcul = Math.ceil(5 + 2 * Math.sqrt(ha));
      return Math.min(20, calcul);
    },
    sampleNote: "Gestion fertilisants — Max 20 points",

    pattern: "x",
    patternLabel: "Schéma X/W",
    patternAlt: "diagonal",
    patternAltLabel: "Diagonal",

    depths: [
      {
        label: "0 – 30 cm",
        color: "#5C3A1E",
        desc: "Horizon labouré",
        priority: true,
      },
      {
        label: "30 – 60 cm",
        color: "#8B5E3A",
        desc: "Sous-sol",
        priority: false,
      },
    ],

    timing: "Après récolte",
    freq: "Annuel",

    gear: ["Tarière ou sonde pédologique", "Sacs kraft", "GPS", "Marqueur"],

    steps: [
      {
        title: "Nombre d'échantillons",
        text: "3–5 points par hectare.",
      },
      {
        title: "Pattern",
        text: "Parcours en X ou W.",
      },
      {
        title: "Timing",
        text: "Après récolte ou avant semis.",
      },
    ],

    alerts: ["Éviter zones de stockage", "Noter fertilisation récente"],
  },

  {
    id: 3,

    name: "Cultures Permanentes",
    nameShort: "Permanentes",

    icon: Apple,
    iconColor: "#db3700",
    iconEmoji: "🫒",

    color: "#2d5a8e",
    colorLight: "rgba(45,90,142,0.1)",

    examples: "Oliviers, agrumes, vignes...",
    desc: "Oliviers · Agrumes · Vignes · Figuiers",

    sampleFormula: (ha) => {
      const calcul = Math.ceil(4 + 1.5 * Math.sqrt(ha));
      return Math.min(15, calcul);
    },
    sampleNote: "Suivi par zone — Max 15 points",

    pattern: "radial",
    patternLabel: "Radial / Couronnes",
    patternAlt: "transect",
    patternAltLabel: "Transect",

    depths: [
      {
        label: "0 – 20 cm",
        color: "#4A2E0E",
        desc: "Surface",
        priority: true,
      },
      {
        label: "20 – 40 cm",
        color: "#7A5230",
        desc: "Racines",
        priority: true,
      },
      {
        label: "40 – 80 cm",
        color: "#9E6A42",
        desc: "Racines profondes",
        priority: false,
      },
    ],

    timing: "Tous les 3–5 ans",
    freq: "Pluriannuel",

    gear: ["Tarière profonde", "Sacs séparés", "GPS", "Fiche terrain"],

    steps: [
      {
        title: "Position",
        text: "Sous la projection du feuillage.",
      },
      {
        title: "Profondeur",
        text: "0–20, 20–40, 40–80 cm séparés.",
      },
      {
        title: "Fréquence",
        text: "Tous les 3–5 ans.",
      },
    ],

    alerts: ["Ne pas mélanger les horizons", "Éviter irrigation localisée"],
  },
];

// ───────────── UTILITAIRES ─────────────

export const CULTURE_MAP = Object.fromEntries(CULTURES.map((c) => [c.id, c]));

export const computeSamples = (culture, ha) => {
  if (!culture || !culture.sampleFormula) return 0;
  return culture.sampleFormula(ha || 1);
};

export const getCultureById = (id) => CULTURE_MAP[id];

// ───────────── MAP LOGIC ─────────────

export const getPatternPoints = (type, n, bounds) => {
  const { minLat, maxLat, minLng, maxLng } = bounds;

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;

  const points = [];

  if (type === "zigzag") {
    const rows = Math.ceil(Math.sqrt(n));
    const cols = Math.ceil(n / rows);

    for (let r = 0; r < rows && points.length < n; r++) {
      const lat = minLat + ((r + 0.5) * latRange) / rows;

      for (let c = 0; c < cols && points.length < n; c++) {
        const ci = r % 2 === 0 ? c : cols - 1 - c;
        const lng = minLng + ((ci + 0.5) * lngRange) / cols;

        points.push([lat, lng]);
      }
    }
  } else if (type === "x") {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;

      points.push([
        minLat + t * latRange,
        minLng + (i % 2 === 0 ? t : 1 - t) * lngRange,
      ]);
    }
  } else if (type === "radial") {
    points.push([cLat, cLng]);

    for (let i = 1; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;

      points.push([
        cLat + 0.3 * latRange * Math.sin(angle),
        cLng + 0.3 * lngRange * Math.cos(angle),
      ]);
    }
  }

  return points;
};
