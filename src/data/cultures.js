import { Carrot, Wheat, Apple } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const cropIconUrl = (filename) => `${API_BASE}/static/crop-icons/${filename}`;

export const CULTURES = [
  {
    id: 1,

    // ───────────── IDENTITY ─────────────
    name: "Vegetable Crops",
    nameShort: "Vegetables",

    icon: Carrot,
    iconColor: "#e68a00",
    iconEmoji: "🥕",

    // ───────────── DESIGN ─────────────
    color: "#4a7c2f",
    colorLight: "rgba(74,124,47,0.1)",

    // ───────────── INFO ─────────────
    examples: "Tomatoes, carrots, potatoes, vegetables...",
    desc: "Tomatoes · Carrots · Zucchini · Potatoes",

    // ───────────── DEPTHS ─────────────
    depths: [
      {
        label: "0 – 20 cm",
        color: "#5C3D1E",
        desc: "Horizon A - Main root zone",
        priority: true,
      },
      {
        label: "20 – 40 cm",
        color: "#8B6045",
        desc: "Horizon B - Nutrient reserves",
        priority: false,
      },
    ],

    // ───────────── METHODOLOGY ─────────────
    timing: "2-4 weeks before planting",
    freq: "Each season",

    gear: [
      "Soil auger or soil probe",
      "Numbered kraft bags",
      "Labels and marker",
      "GPS (Smartphone)",
      "Protective gloves",
    ],

    steps: [
      {
        title: "Required equipment",
        text: "Soil auger or soil probe, kraft bags, labels, GPS.",
      },
      {
        title: "Number of samples",
        text: "Minimum 8 samples per hectare.",
      },
      {
        title: "Depth",
        text: "0-20 cm (primary), 20-40 cm if needed.",
      },
      {
        title: "Timing",
        text: "2-4 weeks before planting.",
      },
      {
        title: "Composition",
        text: "Mix 20-25 subsamples.",
      },
      {
        title: "Shipping",
        text: "Air-dry for 24h and send within 5 days.",
      },
    ],

    alerts: [
      "Avoid sampling after recent fertilization (<3 weeks)",
      "Do not sample in atypical zones",
    ],
  },

  {
    id: 2,

    name: "Cereal Crops",
    nameShort: "Cereals",

    icon: Wheat,
    iconColor: "#a39e00",
    iconEmoji: "🌾",

    color: "#c8a84b",
    colorLight: "rgba(200,168,75,0.12)",

    examples: "Wheat, barley, maize, sorghum...",
    desc: "Durum wheat · Barley · Maize · Oat",

    depths: [
      {
        label: "0 – 30 cm",
        color: "#5C3A1E",
        desc: "Tilled layer",
        priority: true,
      },
      {
        label: "30 – 60 cm",
        color: "#8B5E3A",
        desc: "Subsoil",
        priority: false,
      },
    ],

    timing: "After harvest",
    freq: "Yearly",

    gear: ["Soil auger or soil probe", "Kraft bags", "GPS", "Marker"],

    steps: [
      {
        title: "Number of samples",
        text: "3-5 points per hectare.",
      },
      {
        title: "Pattern",
        text: "Walk in an X or W pattern.",
      },
      {
        title: "Timing",
        text: "After harvest or before sowing.",
      },
    ],

    alerts: ["Avoid storage zones", "Record recent fertilization"],
  },

  {
    id: 3,

    name: "Permanent Crops",
    nameShort: "Permanent",

    icon: Apple,
    iconColor: "#db3700",
    iconEmoji: "🫒",

    color: "#2d5a8e",
    colorLight: "rgba(45,90,142,0.1)",

    examples: "Olives, citrus, vines...",
    desc: "Olive trees · Citrus · Vines · Fig trees",

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
        desc: "Roots",
        priority: true,
      },
      {
        label: "40 – 80 cm",
        color: "#9E6A42",
        desc: "Deep roots",
        priority: false,
      },
    ],

    timing: "Every 3-5 years",
    freq: "Multi-year",

    gear: ["Deep auger", "Separate bags", "GPS", "Field sheet"],

    steps: [
      {
        title: "Position",
        text: "Under the tree canopy projection.",
      },
      {
        title: "Depth",
        text: "0-20, 20-40, 40-80 cm separated.",
      },
      {
        title: "Frequency",
        text: "Every 3-5 years.",
      },
    ],

    alerts: ["Do not mix layers", "Avoid localized irrigation zones"],
  },
];

// ───────────── UTILITAIRES ─────────────

export const CULTURE_MAP = Object.fromEntries(CULTURES.map((c) => [c.id, c]));

export const getCultureById = (id) => CULTURE_MAP[id];
