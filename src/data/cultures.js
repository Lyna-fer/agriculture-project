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

export const getCultureById = (id) => CULTURE_MAP[id];
