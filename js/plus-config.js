// Réglages de vente de Cadran+. Avant salesOpenAt, les ventes sont fermées et Cadran+ est offert
// à tous ceux qui installent Cadran, pour toujours (voir js/plus.js).
export const PLUS_CONFIG = {
  /** Ouverture des ventes (minuit, heure suisse). Les installations antérieures gardent Cadran+ offert. */
  salesOpenAt: '2026-10-15T00:00:00+02:00',
  /** Prix affiché dans Cadran : le même que celui du produit sur Polar (TVA incluse). */
  price: { amount: 5, currency: 'EUR' },
  /** Lien de paiement Polar (Checkout Links). */
  checkoutUrl: 'https://buy.polar.sh/polar_cl_XbdXKj7C0K5NqjO5uxWk4sIeVAM49CcpKza0R0oFdXp',
  /** Identifiant de l'organisation Polar (Settings), qui sert à vérifier les clés. */
  organizationId: '6a0ec52f-666d-4ae8-871b-2d6fa68bf3f4',
  /** true : utiliser le bac à sable de Polar (sandbox.polar.sh), pour tester sans vrai paiement. */
  sandbox: false,
  /** Espace client Polar, où l'acheteur trouve sa clé (lien « Retrouver ma clé ») : https://polar.sh/<slug>/portal. */
  portalUrl: 'https://polar.sh/specular/portal',
};

// Aperçu de développement (dev/mock-chrome.js) : valeurs de secours si un réglage est vide.
for (const [k, v] of Object.entries(globalThis.__CADRAN_DEV__?.fallback || {})) PLUS_CONFIG[k] ||= v;
