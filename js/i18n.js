// Traductions. Les textes sont dans _locales/<langue>/messages.json ; le navigateur choisit
// le fichier selon sa langue d'interface (Brave ou Chrome), avec repli sur l'anglais.

/** Texte traduit ; $1, $2… sont remplacés par les valeurs passées. */
export function t(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

/** Langue des textes réellement affichés (fr, en, es, de, it ou pt). */
export const LANG = chrome.i18n.getMessage('lang') || 'en';

/**
 * Langue des dates et des nombres : celle du navigateur si elle correspond aux textes
 * (fr-CA, en-GB, pt-PT…), sinon celle des textes (repli cohérent en anglais).
 */
const uiLanguage = (chrome.i18n.getUILanguage?.() || navigator.language || 'en').replace('_', '-');
export const LOCALE = uiLanguage.split('-')[0].toLowerCase() === LANG ? uiLanguage : LANG;

const pluralRules = new Intl.PluralRules(LOCALE);
const numbers = new Intl.NumberFormat(LOCALE);

/** Texte au pluriel selon les règles de la langue : clés <clé>_one, <clé>_other… ; le nombre est $1. */
export function tp(key, n, ...subs) {
  const args = [numbers.format(n), ...subs.map(String)];
  return chrome.i18n.getMessage(`${key}_${pluralRules.select(n)}`, args)
    || chrome.i18n.getMessage(`${key}_other`, args)
    || key;
}

/** Traduit les textes fixes de la page : data-i18n (contenu), data-i18n-title, -placeholder, -aria-label. */
export function localizePage(root = document) {
  document.documentElement.lang = LANG;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
  }
}
