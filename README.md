# SellerBot
AI-powered POS system for Bangladeshi F-commerce sellers.

## Features
- Chat-to-Invoice: Paste customer chat -> auto generate invoice
- Multi-layer parsing: structured parser + Groq AI formatting + RAG search
- Supports Bangla, English, and Banglish
- PDF and image invoice download
- Sales analytics dashboard
- All 64 Bangladesh districts for delivery zones
- PWA - installable on Android

## Tech Stack
- React + Vite + Tailwind CSS
- Firebase (Auth + Firestore)
- Groq API (AI chat parsing)
- Cohere (multilingual embeddings)
- Supabase pgvector (RAG vector search)
- Fuse.js (fuzzy product matching)
- jsPDF + html2canvas (invoice generation)
- Vite PWA Plugin (Android installable)
- Vercel (deployment)

## Setup
1. Clone the repo
2. Copy .env.example to .env and fill in your keys
3. npm install
4. npm run dev

## Team
Built for The Infinity AI BuildFest 2026
